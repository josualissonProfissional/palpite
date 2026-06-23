-- Ajusta a data de votacao para que jogos entre 00:00 e 02:59 (America/Recife)
-- ainda contem como parte do dia anterior. Assim, um jogo as 01:00 do dia 22
-- sera contabilizado na janela do dia 21.
--
-- Exemplo: dia 21 tem jogos as 21h e 23h, e um jogo as 01:00 (ja no dia 22).
-- Com o ajuste de -3h, o jogo das 01:00 do dia 22 vira 22:00 do dia 21,
-- entrando na janela do dia 21. A janela so abre quando esse jogo terminar.

create or replace function palpite_private.match_day(match_date timestamptz)
returns date
language sql
immutable
as $$
  select ((match_date at time zone 'America/Recife') - interval '3 hours')::date;
$$;

-- Atualiza process_best_player_windows para usar a nova funcao match_day
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
  -- Cria janelas diarias para datas com jogos (usando match_day)
  insert into palpite.best_player_voting_windows (
    group_id, competition_id, kind, vote_date, open_mode, points_per_hit_snapshot,
    allow_edit_snapshot, respect_position_snapshot
  )
  select distinct g.id, g.competition_id, 'daily'::palpite.best_player_vote_kind,
    palpite_private.match_day(m.match_date), 'automatic'::palpite.best_player_open_mode,
    r.points_per_average_hit, r.allow_daily_vote_edit_before_close, r.respect_player_position
  from palpite.groups g
  join palpite.best_player_rules r on r.group_id = g.id and r.daily_voting_enabled
  join palpite.matches m on m.competition_id = g.competition_id
  where g.competition_id is not null
    and palpite_private.match_day(m.match_date) <= palpite_private.match_day(now())
    and m.match_date >= g.created_at
  on conflict do nothing;

  -- Vincula partidas as janelas (usando match_day)
  insert into palpite.best_player_window_matches (window_id, match_id)
  select w.id, m.id
  from palpite.best_player_voting_windows w
  join palpite.matches m on m.competition_id = w.competition_id
   and ((w.kind = 'daily' and palpite_private.match_day(m.match_date) = w.vote_date)
     or (w.kind = 'round' and m.round_name = w.round_name))
  on conflict do nothing;

  -- Abre janelas diarias cujos jogos do dia ja terminaram
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
      -- Proximo jogo: primeiro jogo cujo match_day > vote_date da janela
      select min(m.match_date) into v_next_match
      from palpite.matches m
      where m.competition_id = rec.competition_id
        and palpite_private.match_day(m.match_date) > rec.vote_date
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

  -- Fecha janelas diarias que passaram do prazo
  update palpite.best_player_voting_windows
  set status = 'closed'
  where status = 'open' and closes_at <= now() and kind = 'daily';
  get diagnostics v_closed = row_count;

  -- Finaliza janelas diarias fechadas
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
