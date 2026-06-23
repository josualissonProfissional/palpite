create or replace function palpite.debug_tied_roles(p_window_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = palpite, public
as $$
declare
  result jsonb;
begin
  -- Recria as candidates (mesmo que a funcao de finalizacao)
  create temp table if not exists pg_temp.bp_candidates (
    player_id uuid, selected_role palpite.best_player_position,
    daily_votes integer, player_name text
  ) on commit drop;
  truncate pg_temp.bp_candidates;

  insert into pg_temp.bp_candidates
  select bp.player_id, bp.selected_role, count(*)::integer, p.name
  from palpite.best_player_ballot_players bp
  join palpite.best_player_ballots b on b.id = bp.ballot_id
  join palpite.players p on p.id = bp.player_id
  where b.window_id = p_window_id
  group by bp.player_id, bp.selected_role, p.name;

  -- Quais posicoes sao empatadas?
  select jsonb_agg(jsonb_build_object(
    'role', selected_role,
    'max_votes', max_votes,
    'min_votes', min_votes,
    'is_tied', max_votes = min_votes
  )) into result
  from (
    select selected_role, max(daily_votes) as max_votes, min(daily_votes) as min_votes
    from pg_temp.bp_candidates
    group by selected_role
  ) sub;

  return result;
end;
$$;
