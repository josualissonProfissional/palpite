-- Aplica a mesma logica de pontuacao justa para o Time da Rodada:
-- 2 votos = intersecao, 3+ = maioria com empate.

create or replace function palpite_private.finalize_best_player_window(p_window_id uuid)
returns integer
language plpgsql
security definer
set search_path = palpite, public
as $$
declare
  v_window palpite.best_player_voting_windows%rowtype;
  v_ballot_count integer;
  v_formation palpite.best_player_formation;
  v_df integer; v_mf integer; v_fw integer;
  v_slot integer := 0;
  v_role palpite.best_player_position;
  v_limit integer;
  rec record;
begin
  select * into v_window from palpite.best_player_voting_windows
  where id = p_window_id for update;
  if not found or v_window.kind <> 'round' or v_window.status = 'finalized' then return 0; end if;
  if v_window.closes_at is null or v_window.closes_at > now() then return 0; end if;

  update palpite.best_player_voting_windows set status = 'closed' where id = p_window_id;
  select count(*) into v_ballot_count from palpite.best_player_ballots where window_id = p_window_id;
  delete from palpite.best_player_results where window_id = p_window_id;
  delete from palpite.best_player_scores where window_id = p_window_id;

  if v_ballot_count < v_window.minimum_ballots then
    update palpite.best_player_voting_windows
    set status = 'finalized', finalized_at = now() where id = p_window_id;
    return 0;
  end if;

  select formation into v_formation
  from palpite.best_player_ballots where window_id = p_window_id
  group by formation
  order by count(*) desc,
    case formation when '4-3-3' then 1 when '4-4-2' then 2 when '3-5-2' then 3 else 4 end
  limit 1;

  v_df := case v_formation when '4-3-3' then 4 when '4-4-2' then 4 when '3-5-2' then 3 else 10 end;
  v_mf := case v_formation when '4-3-3' then 3 when '4-4-2' then 4 when '3-5-2' then 5 else 0 end;
  v_fw := case v_formation when '4-3-3' then 3 when '4-4-2' then 2 when '3-5-2' then 2 else 0 end;

  create temp table if not exists pg_temp.bp_candidates (
    player_id uuid, selected_role palpite.best_player_position,
    round_votes integer, daily_votes integer, player_name text
  ) on commit drop;
  truncate pg_temp.bp_candidates;

  insert into pg_temp.bp_candidates
  with role_votes as (
    select bp.player_id, bp.selected_role, count(*)::integer round_votes
    from palpite.best_player_ballot_players bp
    join palpite.best_player_ballots b on b.id = bp.ballot_id
    where b.window_id = p_window_id
    group by bp.player_id, bp.selected_role
  ), daily_votes as (
    select dp.player_id, dp.selected_role, count(*)::integer daily_votes
    from palpite.best_player_ballot_players dp
    join palpite.best_player_ballots db on db.id = dp.ballot_id
    join palpite.best_player_voting_windows dw on dw.id = db.window_id and dw.kind = 'daily'
    where dw.group_id = v_window.group_id
      and exists (
        select 1 from palpite.best_player_window_matches dwm
        join palpite.best_player_window_matches rwm on rwm.match_id = dwm.match_id
        where dwm.window_id = dw.id and rwm.window_id = p_window_id
      )
    group by dp.player_id, dp.selected_role
  )
    select rv.player_id, rv.selected_role, rv.round_votes,
      coalesce(dv.daily_votes, 0) daily_votes, p.name player_name
    from role_votes rv
    join palpite.players p on p.id = rv.player_id
    left join daily_votes dv on dv.player_id = rv.player_id and dv.selected_role = rv.selected_role;

  foreach v_role in array array['gk','df','mf','fw']::palpite.best_player_position[] loop
    v_limit := case v_role when 'gk' then 1 when 'df' then v_df when 'mf' then v_mf else v_fw end;
    if v_formation = 'free-11' and v_role <> 'gk' then
      if v_role <> 'df' then continue; end if;
      for rec in select * from pg_temp.bp_candidates c where c.selected_role <> 'gk'
        and not exists (select 1 from palpite.best_player_results r where r.window_id = p_window_id and r.player_id = c.player_id)
        order by c.round_votes desc, c.daily_votes desc, c.player_name asc limit 10 loop
        insert into palpite.best_player_results (window_id,player_id,slot_index,selected_role,round_votes,daily_votes_tiebreak)
        values (p_window_id,rec.player_id,v_slot,rec.selected_role,rec.round_votes,rec.daily_votes);
        v_slot := v_slot + 1;
      end loop; continue;
    end if;
    if v_limit = 0 then continue; end if;
    for rec in select * from pg_temp.bp_candidates c where c.selected_role = v_role
      and not exists (select 1 from palpite.best_player_results r where r.window_id = p_window_id and r.player_id = c.player_id)
      order by c.round_votes desc, c.daily_votes desc, c.player_name asc limit v_limit loop
      insert into palpite.best_player_results (window_id,player_id,slot_index,selected_role,round_votes,daily_votes_tiebreak)
      values (p_window_id,rec.player_id,v_slot,rec.selected_role,rec.round_votes,rec.daily_votes);
      v_slot := v_slot + 1;
    end loop;
  end loop;

  -- PONTUACAO: 2 votos = intersecao, 3+ = maioria com empate
  if v_ballot_count = 2 then
    insert into palpite.best_player_scores (window_id, group_id, user_id, hits, points)
    with ballot_players as (
      select b.user_id, bp.player_id, bp.selected_role
      from palpite.best_player_ballots b
      join palpite.best_player_ballot_players bp on bp.ballot_id = b.id
      where b.window_id = p_window_id
    ),
    player_ballot_count as (
      select player_id, selected_role, count(distinct user_id) as voter_count
      from ballot_players group by player_id, selected_role
    ),
    common_players as (
      select player_id, selected_role from player_ballot_count where voter_count = 2
    ),
    scored as (
      select bp.user_id, bp.player_id, bp.selected_role,
        exists(select 1 from common_players cp
          where cp.player_id = bp.player_id and cp.selected_role = bp.selected_role) as is_hit
      from ballot_players bp
    )
    select p_window_id, v_window.group_id, user_id,
      count(*) filter (where is_hit)::smallint,
      (count(*) filter (where is_hit) * v_window.points_per_hit_snapshot)::integer
    from scored group by user_id;
  else
    insert into palpite.best_player_scores (window_id, group_id, user_id, hits, points)
    with tied_roles as (
      select selected_role from pg_temp.bp_candidates
      group by selected_role having max(round_votes) = min(round_votes)
    ),
    bp as (
      select b.user_id, bp.player_id, bp.selected_role
      from palpite.best_player_ballots b
      join palpite.best_player_ballot_players bp on bp.ballot_id = b.id
      where b.window_id = p_window_id
    ),
    scored as (
      select bp.user_id, bp.player_id, bp.selected_role,
        exists(select 1 from palpite.best_player_results r
          where r.window_id = p_window_id and r.player_id = bp.player_id and r.selected_role = bp.selected_role)
        or exists(select 1 from tied_roles tr where tr.selected_role = bp.selected_role) as is_hit
      from bp
    )
    select p_window_id, v_window.group_id, user_id,
      count(*) filter (where is_hit)::smallint,
      (count(*) filter (where is_hit) * v_window.points_per_hit_snapshot)::integer
    from scored group by user_id;
  end if;

  update palpite.best_player_voting_windows
  set status = 'finalized', result_formation = v_formation, finalized_at = now()
  where id = p_window_id;
  return v_ballot_count;
end;
$$;
