-- Finaliza janelas de votação diárias (Time do Dia) que fecharam,
-- computando o time médio da galera e a pontuação de cada jogador.
create or replace function palpite_private.finalize_best_player_daily_window(p_window_id uuid)
returns integer
language plpgsql
security definer
set search_path = palpite, public
as $$
declare
  v_window palpite.best_player_voting_windows%rowtype;
  v_ballot_count integer;
  v_formation palpite.best_player_formation;
  v_df integer;
  v_mf integer;
  v_fw integer;
  v_slot integer := 0;
  v_role palpite.best_player_position;
  v_limit integer;
  rec record;
begin
  select * into v_window from palpite.best_player_voting_windows
  where id = p_window_id for update;
  if not found or v_window.kind <> 'daily' or v_window.status = 'finalized' then return 0; end if;
  if v_window.closes_at is null or v_window.closes_at > now() then return 0; end if;

  select count(*) into v_ballot_count from palpite.best_player_ballots where window_id = p_window_id;
  delete from palpite.best_player_results where window_id = p_window_id;
  delete from palpite.best_player_scores where window_id = p_window_id;

  if v_ballot_count < 2 then
    update palpite.best_player_voting_windows
    set status = 'finalized', finalized_at = now() where id = p_window_id;
    return 0;
  end if;

  -- Formação mais votada entre os participantes
  select formation into v_formation
  from palpite.best_player_ballots where window_id = p_window_id
  group by formation
  order by count(*) desc,
    case formation when '4-3-3' then 1 when '4-4-2' then 2 when '3-5-2' then 3 else 4 end
  limit 1;

  v_df := case v_formation when '4-3-3' then 4 when '4-4-2' then 4 when '3-5-2' then 3 else 10 end;
  v_mf := case v_formation when '4-3-3' then 3 when '4-4-2' then 4 when '3-5-2' then 5 else 0 end;
  v_fw := case v_formation when '4-3-3' then 3 when '4-4-2' then 2 when '3-5-2' then 2 else 0 end;

  -- Candidatos com contagem de votos diários
  create temp table if not exists pg_temp.best_player_daily_candidates (
    player_id uuid, selected_role palpite.best_player_position,
    daily_votes integer, player_name text
  ) on commit drop;
  truncate pg_temp.best_player_daily_candidates;

  insert into pg_temp.best_player_daily_candidates
  select bp.player_id, bp.selected_role, count(*)::integer daily_votes, p.name player_name
  from palpite.best_player_ballot_players bp
  join palpite.best_player_ballots b on b.id = bp.ballot_id
  join palpite.players p on p.id = bp.player_id
  where b.window_id = p_window_id
  group by bp.player_id, bp.selected_role, p.name;

  -- Seleciona os 11 mais votados respeitando posições
  foreach v_role in array array['gk', 'df', 'mf', 'fw']::palpite.best_player_position[] loop
    v_limit := case v_role when 'gk' then 1 when 'df' then v_df when 'mf' then v_mf else v_fw end;
    if v_formation = 'free-11' and v_role <> 'gk' then
      if v_role <> 'df' then continue; end if;
      for rec in
        select c.* from pg_temp.best_player_daily_candidates c
        where c.selected_role <> 'gk'
          and not exists (select 1 from palpite.best_player_results r where r.window_id = p_window_id and r.player_id = c.player_id)
        order by c.daily_votes desc, c.player_name asc limit 10
      loop
        insert into palpite.best_player_results
          (window_id, player_id, slot_index, selected_role, round_votes, daily_votes_tiebreak)
        values (p_window_id, rec.player_id, v_slot, rec.selected_role, rec.daily_votes, 0);
        v_slot := v_slot + 1;
      end loop;
      continue;
    end if;
    if v_limit = 0 then continue; end if;
    for rec in
      select c.* from pg_temp.best_player_daily_candidates c
      where c.selected_role = v_role
        and not exists (select 1 from palpite.best_player_results r where r.window_id = p_window_id and r.player_id = c.player_id)
      order by c.daily_votes desc, c.player_name asc limit v_limit
    loop
      insert into palpite.best_player_results
        (window_id, player_id, slot_index, selected_role, round_votes, daily_votes_tiebreak)
      values (p_window_id, rec.player_id, v_slot, rec.selected_role, rec.daily_votes, 0);
      v_slot := v_slot + 1;
    end loop;
  end loop;

  -- Calcula acertos e pontos de cada participante contra o time médio
  insert into palpite.best_player_scores (window_id, group_id, user_id, hits, points)
  select p_window_id, v_window.group_id, b.user_id,
    count(r.player_id)::smallint,
    (count(r.player_id) * v_window.points_per_hit_snapshot)::integer
  from palpite.best_player_ballots b
  left join palpite.best_player_ballot_players bp on bp.ballot_id = b.id
  left join palpite.best_player_results r on r.window_id = p_window_id
    and r.player_id = bp.player_id and r.selected_role = bp.selected_role
  where b.window_id = p_window_id
  group by b.user_id;

  update palpite.best_player_voting_windows
  set status = 'finalized', result_formation = v_formation, finalized_at = now()
  where id = p_window_id;
  return v_ballot_count;
end;
$$;

revoke all on function palpite_private.finalize_best_player_daily_window(uuid) from public, anon, authenticated;
grant execute on function palpite_private.finalize_best_player_daily_window(uuid) to service_role;

-- Substitui process_best_player_windows() para incluir finalização de janelas diárias
create or replace function palpite.process_best_player_windows()
returns jsonb
language plpgsql
security definer
set search_path = palpite, public
as $$
declare
  rec record;
  v_opened integer := 0;
  v_closed integer := 0;
  v_finalized integer := 0;
  v_source palpite.best_player_eligibility_source;
  v_next_match timestamptz;
begin
  -- Cria janelas diárias para datas com jogos
  insert into palpite.best_player_voting_windows (
    group_id, competition_id, kind, vote_date, open_mode, points_per_hit_snapshot,
    allow_edit_snapshot, respect_position_snapshot
  )
  select distinct g.id, g.competition_id, 'daily'::palpite.best_player_vote_kind,
    (m.match_date at time zone 'America/Recife')::date, 'automatic'::palpite.best_player_open_mode,
    r.points_per_average_hit, r.allow_daily_vote_edit_before_close, r.respect_player_position
  from palpite.groups g
  join palpite.best_player_rules r on r.group_id = g.id and r.daily_voting_enabled
  join palpite.matches m on m.competition_id = g.competition_id
  where g.competition_id is not null
    and (m.match_date at time zone 'America/Recife')::date <= (now() at time zone 'America/Recife')::date
    and m.match_date >= g.created_at
  on conflict do nothing;

  -- Vincula partidas às janelas
  insert into palpite.best_player_window_matches (window_id, match_id)
  select w.id, m.id
  from palpite.best_player_voting_windows w
  join palpite.matches m on m.competition_id = w.competition_id
   and ((w.kind = 'daily' and (m.match_date at time zone 'America/Recife')::date = w.vote_date)
     or (w.kind = 'round' and m.round_name = w.round_name))
  on conflict do nothing;

  -- Abre janelas diárias cujos jogos do dia já terminaram
  for rec in
    select w.* from palpite.best_player_voting_windows w
    where w.status = 'scheduled' and w.kind = 'daily'
      and not exists (
        select 1 from palpite.best_player_window_matches wm
        join palpite.matches m on m.id = wm.match_id
        where wm.window_id = w.id and m.status not in ('finished', 'cancelled', 'postponed')
      )
  loop
    delete from palpite.best_player_window_players where window_id = rec.id;
    insert into palpite.best_player_window_players (window_id, player_id, position, source)
    select distinct rec.id, a.player_id, a.position, 'appearances'::palpite.best_player_eligibility_source
    from palpite.best_player_window_matches wm
    join palpite.match_player_appearances a on a.match_id = wm.match_id
    where wm.window_id = rec.id and (a.started or a.entered)
    on conflict do nothing;

    if (select count(*) from palpite.best_player_window_players where window_id = rec.id) >= 11
      and exists (select 1 from palpite.best_player_window_players where window_id = rec.id and position = 'gk') then
      v_source := 'appearances';
    else
      delete from palpite.best_player_window_players where window_id = rec.id;
      insert into palpite.best_player_window_players (window_id, player_id, position, source)
      select distinct rec.id, p.id, p.position, 'squad'::palpite.best_player_eligibility_source
      from palpite.best_player_window_matches wm
      join palpite.matches m on m.id = wm.match_id
      join palpite.players p on p.team_id in (m.home_team_id, m.away_team_id) and p.active
      where wm.window_id = rec.id
      on conflict do nothing;
      v_source := 'squad';
    end if;

    if (select count(*) from palpite.best_player_window_players where window_id = rec.id) >= 11
      and exists (select 1 from palpite.best_player_window_players where window_id = rec.id and position = 'gk') then
      select min(m.match_date) into v_next_match
      from palpite.matches m
      where m.competition_id = rec.competition_id
        and (m.match_date at time zone 'America/Recife')::date > rec.vote_date
        and m.status not in ('cancelled', 'postponed');
      update palpite.best_player_voting_windows
      set status = 'open', opened_at = now(),
        closes_at = coalesce(v_next_match - interval '10 minutes', now() + interval '24 hours'),
        eligibility_source = v_source
      where id = rec.id;
      v_opened := v_opened + 1;
    end if;
  end loop;

  -- Abre janelas de rodada agendadas
  for rec in
    select w.* from palpite.best_player_voting_windows w
    where w.status = 'scheduled' and w.kind = 'round'
      and not exists (
        select 1 from palpite.best_player_window_matches wm
        join palpite.matches m on m.id = wm.match_id
        where wm.window_id = w.id and m.status not in ('finished', 'cancelled')
      )
      and (w.open_mode = 'automatic' or w.scheduled_open_at <= now())
  loop
    update palpite.best_player_voting_windows
    set status = 'open', opened_at = now(), closes_at = now() + make_interval(mins => rec.duration_minutes)
    where id = rec.id;
    v_opened := v_opened + 1;
  end loop;

  -- Fecha janelas diárias que passaram do prazo
  update palpite.best_player_voting_windows
  set status = 'closed'
  where status = 'open' and closes_at <= now() and kind = 'daily';
  get diagnostics v_closed = row_count;

  -- Finaliza janelas diárias fechadas
  for rec in
    select id from palpite.best_player_voting_windows
    where kind = 'daily' and status = 'closed' and closes_at <= now()
  loop
    perform palpite_private.finalize_best_player_daily_window(rec.id);
    v_finalized := v_finalized + 1;
  end loop;

  -- Finaliza janelas de rodada fechadas
  for rec in
    select id from palpite.best_player_voting_windows
    where kind = 'round' and status in ('open', 'closed') and closes_at <= now()
  loop
    perform palpite_private.finalize_best_player_window(rec.id);
    v_finalized := v_finalized + 1;
  end loop;

  return jsonb_build_object('opened', v_opened, 'closed', v_closed, 'finalized', v_finalized);
end;
$$;

revoke all on function palpite.process_best_player_windows() from public, anon, authenticated;
grant execute on function palpite.process_best_player_windows() to service_role;
