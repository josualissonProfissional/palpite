begin;

do $$
declare
  v_group uuid;
  v_competition uuid;
  v_team uuid;
  v_user_one uuid;
  v_user_two uuid;
  v_daily_window uuid;
  v_round_window uuid;
  v_ballot_one uuid;
  v_ballot_two uuid;
  v_selections jsonb;
  v_count integer;
begin
  select g.id, g.competition_id into v_group, v_competition
  from palpite.groups g where g.competition_id is not null limit 1;
  select id into v_team from palpite.teams limit 1;
  select id into v_user_one from auth.users order by created_at limit 1;
  select id into v_user_two from auth.users where id <> v_user_one order by created_at limit 1;

  if v_group is null or v_team is null or v_user_one is null or v_user_two is null then
    raise exception 'Test requires one group, one team and two users';
  end if;

  insert into palpite.group_members (group_id, user_id, role, status, joined_at)
  values
    (v_group, v_user_one, 'member', 'active', now()),
    (v_group, v_user_two, 'member', 'active', now())
  on conflict (group_id, user_id) do update set status = 'active';

  insert into palpite.players (team_id, name, position, shirt_number)
  select v_team, 'Test Player ' || n,
    case when n = 1 then 'gk'::palpite.best_player_position
         when n <= 5 then 'df'::palpite.best_player_position
         when n <= 8 then 'mf'::palpite.best_player_position
         else 'fw'::palpite.best_player_position end,
    n
  from generate_series(1, 11) n;

  insert into palpite.best_player_voting_windows (
    group_id, competition_id, kind, vote_date, opened_at, closes_at, status,
    allow_edit_snapshot, respect_position_snapshot
  ) values (
    v_group, v_competition, 'daily', date '2099-01-01', now() - interval '1 minute',
    now() + interval '1 hour', 'open', true, true
  ) returning id into v_daily_window;

  insert into palpite.best_player_window_players (window_id, player_id, position, source)
  select v_daily_window, id, position, 'squad'
  from palpite.players where name like 'Test Player %';

  select jsonb_agg(jsonb_build_object(
    'player_id', id,
    'slot_index', slot_index,
    'selected_role', position
  ) order by slot_index)
  into v_selections
  from (
    select id, position, row_number() over (
      order by case position when 'gk' then 1 when 'df' then 2 when 'mf' then 3 else 4 end, shirt_number
    ) - 1 slot_index
    from palpite.players where name like 'Test Player %'
  ) selected;

  perform palpite.save_best_player_ballot_internal(
    v_daily_window, v_user_one, '4-3-3', v_selections
  );
  select count(*) into v_count from palpite.best_player_ballots where window_id = v_daily_window;
  if v_count <> 1 then raise exception 'Daily ballot was not saved'; end if;

  insert into palpite.best_player_voting_windows (
    group_id, competition_id, kind, round_name, stage, opened_at, closes_at,
    duration_minutes, status, points_per_hit_snapshot, minimum_ballots
  ) values (
    v_group, v_competition, 'round', 'TEST_ROUND', 'group_stage', now() - interval '2 hours',
    now() - interval '1 minute', 720, 'closed', 1, 2
  ) returning id into v_round_window;

  insert into palpite.best_player_ballots (window_id, user_id, formation)
  values (v_round_window, v_user_one, '4-3-3') returning id into v_ballot_one;
  insert into palpite.best_player_ballots (window_id, user_id, formation)
  values (v_round_window, v_user_two, '4-3-3') returning id into v_ballot_two;

  insert into palpite.best_player_ballot_players (ballot_id, player_id, slot_index, selected_role)
  select v_ballot_one, (item->>'player_id')::uuid, (item->>'slot_index')::smallint,
    (item->>'selected_role')::palpite.best_player_position
  from jsonb_array_elements(v_selections) item;
  insert into palpite.best_player_ballot_players (ballot_id, player_id, slot_index, selected_role)
  select v_ballot_two, (item->>'player_id')::uuid, (item->>'slot_index')::smallint,
    (item->>'selected_role')::palpite.best_player_position
  from jsonb_array_elements(v_selections) item;

  perform palpite_private.finalize_best_player_window(v_round_window);

  select count(*) into v_count from palpite.best_player_results where window_id = v_round_window;
  if v_count <> 11 then raise exception 'Expected 11 average-team players, got %', v_count; end if;
  select count(*) into v_count from palpite.best_player_scores
  where window_id = v_round_window and hits = 11 and points = 11;
  if v_count <> 2 then raise exception 'Expected two complete scores, got %', v_count; end if;
  if not exists (
    select 1 from palpite.best_player_voting_windows
    where id = v_round_window and status = 'finalized' and result_formation = '4-3-3'
  ) then raise exception 'Round window was not finalized'; end if;
end;
$$;

rollback;
