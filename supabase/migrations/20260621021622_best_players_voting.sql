create type palpite.best_player_position as enum ('gk', 'df', 'mf', 'fw');
create type palpite.best_player_vote_kind as enum ('daily', 'round');
create type palpite.best_player_window_status as enum ('scheduled', 'open', 'closed', 'finalized', 'cancelled');
create type palpite.best_player_open_mode as enum ('automatic', 'scheduled');
create type palpite.best_player_formation as enum ('4-3-3', '4-4-2', '3-5-2', 'free-11');
create type palpite.best_player_eligibility_source as enum ('appearances', 'squad');

alter table palpite.matches
  add column best_players_imported_at timestamptz,
  add column best_players_data_source palpite.best_player_eligibility_source,
  add column best_players_import_attempts integer not null default 0;

create table palpite.players (
  id uuid primary key default gen_random_uuid(),
  api_player_id bigint unique,
  team_id uuid not null references palpite.teams(id) on delete cascade,
  name text not null,
  position palpite.best_player_position not null,
  shirt_number smallint,
  active boolean not null default true,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_name_not_blank check (length(btrim(name)) > 0),
  constraint players_shirt_number_check check (shirt_number is null or shirt_number between 0 and 99)
);

create table palpite.match_player_appearances (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references palpite.matches(id) on delete cascade,
  player_id uuid not null references palpite.players(id) on delete cascade,
  team_id uuid not null references palpite.teams(id) on delete cascade,
  position palpite.best_player_position not null,
  started boolean not null default false,
  bench boolean not null default false,
  entered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id),
  constraint match_player_participated_check check (started or bench or entered)
);

create table palpite.best_player_rules (
  group_id uuid primary key references palpite.groups(id) on delete cascade,
  daily_voting_enabled boolean not null default true,
  round_team_voting_enabled boolean not null default false,
  points_per_average_hit integer not null default 1,
  allow_daily_vote_edit_before_close boolean not null default true,
  allow_round_vote_edit_before_close boolean not null default true,
  respect_player_position boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint best_player_points_check check (points_per_average_hit between 0 and 100)
);

create table palpite.best_player_voting_windows (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references palpite.groups(id) on delete cascade,
  competition_id uuid not null references palpite.competitions(id) on delete cascade,
  kind palpite.best_player_vote_kind not null,
  vote_date date,
  round_name text,
  stage palpite.match_stage,
  open_mode palpite.best_player_open_mode not null default 'automatic',
  scheduled_open_at timestamptz,
  opened_at timestamptz,
  closes_at timestamptz,
  duration_minutes integer,
  status palpite.best_player_window_status not null default 'scheduled',
  eligibility_source palpite.best_player_eligibility_source,
  points_per_hit_snapshot integer not null default 1,
  allow_edit_snapshot boolean not null default true,
  respect_position_snapshot boolean not null default true,
  minimum_ballots smallint not null default 2,
  result_formation palpite.best_player_formation,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint best_player_window_scope_check check (
    (kind = 'daily' and vote_date is not null and round_name is null)
    or (kind = 'round' and vote_date is null and round_name is not null)
  ),
  constraint best_player_window_duration_check check (
    (kind = 'daily' and duration_minutes is null)
    or (kind = 'round' and duration_minutes in (720, 1440, 2880))
  ),
  constraint best_player_window_schedule_check check (
    open_mode = 'automatic' or scheduled_open_at is not null
  ),
  constraint best_player_window_minimum_check check (minimum_ballots >= 2),
  constraint best_player_window_points_check check (points_per_hit_snapshot between 0 and 100)
);

create unique index best_player_daily_window_unique
on palpite.best_player_voting_windows (group_id, competition_id, vote_date)
where kind = 'daily';

create unique index best_player_round_window_unique
on palpite.best_player_voting_windows (group_id, competition_id, round_name)
where kind = 'round';

create table palpite.best_player_window_matches (
  window_id uuid not null references palpite.best_player_voting_windows(id) on delete cascade,
  match_id uuid not null references palpite.matches(id) on delete cascade,
  primary key (window_id, match_id)
);

create table palpite.best_player_window_players (
  window_id uuid not null references palpite.best_player_voting_windows(id) on delete cascade,
  player_id uuid not null references palpite.players(id) on delete cascade,
  position palpite.best_player_position not null,
  source palpite.best_player_eligibility_source not null,
  primary key (window_id, player_id)
);

create table palpite.best_player_ballots (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null references palpite.best_player_voting_windows(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  formation palpite.best_player_formation not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (window_id, user_id)
);

create table palpite.best_player_ballot_players (
  ballot_id uuid not null references palpite.best_player_ballots(id) on delete cascade,
  player_id uuid not null references palpite.players(id) on delete cascade,
  slot_index smallint not null,
  selected_role palpite.best_player_position not null,
  primary key (ballot_id, player_id),
  unique (ballot_id, slot_index),
  constraint best_player_slot_check check (slot_index between 0 and 10)
);

create table palpite.best_player_results (
  window_id uuid not null references palpite.best_player_voting_windows(id) on delete cascade,
  player_id uuid not null references palpite.players(id) on delete cascade,
  slot_index smallint not null,
  selected_role palpite.best_player_position not null,
  round_votes integer not null,
  daily_votes_tiebreak integer not null default 0,
  primary key (window_id, player_id),
  unique (window_id, slot_index)
);

create table palpite.best_player_scores (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null references palpite.best_player_voting_windows(id) on delete cascade,
  group_id uuid not null references palpite.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hits smallint not null default 0,
  points integer not null default 0,
  calculated_at timestamptz not null default now(),
  unique (window_id, user_id),
  constraint best_player_hits_check check (hits between 0 and 11),
  constraint best_player_score_points_check check (points >= 0)
);

create index players_team_idx on palpite.players (team_id, position);
create index match_player_appearances_match_idx on palpite.match_player_appearances (match_id, position);
create index best_player_windows_group_status_idx on palpite.best_player_voting_windows (group_id, status, kind);
create index best_player_ballots_window_idx on palpite.best_player_ballots (window_id, user_id);
create index best_player_scores_group_user_idx on palpite.best_player_scores (group_id, user_id);

create trigger set_players_updated_at before update on palpite.players
for each row execute function palpite.set_updated_at();
create trigger set_match_player_appearances_updated_at before update on palpite.match_player_appearances
for each row execute function palpite.set_updated_at();
create trigger set_best_player_rules_updated_at before update on palpite.best_player_rules
for each row execute function palpite.set_updated_at();
create trigger set_best_player_windows_updated_at before update on palpite.best_player_voting_windows
for each row execute function palpite.set_updated_at();
create trigger set_best_player_ballots_updated_at before update on palpite.best_player_ballots
for each row execute function palpite.set_updated_at();

insert into palpite.best_player_rules (group_id)
select id from palpite.groups
on conflict (group_id) do nothing;

create or replace function palpite_private.create_best_player_rules_for_group()
returns trigger
language plpgsql
security definer
set search_path = palpite, public
as $$
begin
  insert into palpite.best_player_rules (group_id) values (new.id)
  on conflict (group_id) do nothing;
  return new;
end;
$$;

revoke all on function palpite_private.create_best_player_rules_for_group() from public, anon, authenticated;

create trigger create_best_player_rules_after_group
after insert on palpite.groups
for each row execute function palpite_private.create_best_player_rules_for_group();

alter table palpite.players enable row level security;
alter table palpite.match_player_appearances enable row level security;
alter table palpite.best_player_rules enable row level security;
alter table palpite.best_player_voting_windows enable row level security;
alter table palpite.best_player_window_matches enable row level security;
alter table palpite.best_player_window_players enable row level security;
alter table palpite.best_player_ballots enable row level security;
alter table palpite.best_player_ballot_players enable row level security;
alter table palpite.best_player_results enable row level security;
alter table palpite.best_player_scores enable row level security;

grant select on palpite.players, palpite.match_player_appearances to authenticated;
grant select on palpite.best_player_rules, palpite.best_player_voting_windows,
  palpite.best_player_window_matches, palpite.best_player_window_players,
  palpite.best_player_ballots, palpite.best_player_ballot_players,
  palpite.best_player_results, palpite.best_player_scores to authenticated;
grant update on palpite.best_player_rules to authenticated;
grant all on palpite.players, palpite.match_player_appearances, palpite.best_player_rules,
  palpite.best_player_voting_windows, palpite.best_player_window_matches,
  palpite.best_player_window_players, palpite.best_player_ballots,
  palpite.best_player_ballot_players, palpite.best_player_results,
  palpite.best_player_scores to service_role;

create policy players_select_authenticated on palpite.players
for select to authenticated using (true);
create policy appearances_select_authenticated on palpite.match_player_appearances
for select to authenticated using (true);

create policy best_player_rules_select_members on palpite.best_player_rules
for select to authenticated using (palpite_private.is_active_member(group_id));
create policy best_player_rules_update_admins on palpite.best_player_rules
for update to authenticated
using (palpite_private.has_group_role(group_id, array['owner', 'admin']))
with check (palpite_private.has_group_role(group_id, array['owner', 'admin']));

create policy best_player_windows_select_members on palpite.best_player_voting_windows
for select to authenticated using (palpite_private.is_active_member(group_id));

create policy best_player_window_matches_select_members on palpite.best_player_window_matches
for select to authenticated using (
  exists (
    select 1 from palpite.best_player_voting_windows w
    where w.id = window_id and palpite_private.is_active_member(w.group_id)
  )
);

create policy best_player_window_players_select_members on palpite.best_player_window_players
for select to authenticated using (
  exists (
    select 1 from palpite.best_player_voting_windows w
    where w.id = window_id and palpite_private.is_active_member(w.group_id)
  )
);

create policy best_player_ballots_select_own on palpite.best_player_ballots
for select to authenticated using (
  user_id = (select auth.uid())
  and exists (
    select 1 from palpite.best_player_voting_windows w
    where w.id = window_id and palpite_private.is_active_member(w.group_id)
  )
);

create policy best_player_ballot_players_select_own on palpite.best_player_ballot_players
for select to authenticated using (
  exists (
    select 1
    from palpite.best_player_ballots b
    join palpite.best_player_voting_windows w on w.id = b.window_id
    where b.id = ballot_id
      and b.user_id = (select auth.uid())
      and palpite_private.is_active_member(w.group_id)
  )
);

create policy best_player_results_select_members on palpite.best_player_results
for select to authenticated using (
  exists (
    select 1 from palpite.best_player_voting_windows w
    where w.id = window_id
      and w.status = 'finalized'
      and palpite_private.is_active_member(w.group_id)
  )
);

create policy best_player_scores_select_members on palpite.best_player_scores
for select to authenticated using (
  palpite_private.is_active_member(group_id)
);

create or replace function palpite.save_best_player_ballot_internal(
  p_window_id uuid,
  p_user_id uuid,
  p_formation text,
  p_selections jsonb
)
returns uuid
language plpgsql
security definer
set search_path = palpite, public
as $$
declare
  v_window palpite.best_player_voting_windows%rowtype;
  v_ballot_id uuid;
  v_existing uuid;
  v_count integer;
  v_gk integer;
  v_df integer;
  v_mf integer;
  v_fw integer;
begin
  select * into v_window
  from palpite.best_player_voting_windows
  where id = p_window_id
  for update;

  if not found then raise exception 'Voting window not found'; end if;
  if v_window.status <> 'open' or v_window.opened_at > now() or v_window.closes_at <= now() then
    raise exception 'Voting window is closed';
  end if;
  if p_formation not in ('4-3-3', '4-4-2', '3-5-2', 'free-11') then
    raise exception 'Invalid formation';
  end if;
  if not exists (
    select 1 from palpite.group_members gm
    where gm.group_id = v_window.group_id and gm.user_id = p_user_id and gm.status = 'active'
  ) then raise exception 'User is not an active group member'; end if;

  select id into v_existing from palpite.best_player_ballots
  where window_id = p_window_id and user_id = p_user_id;
  if v_existing is not null and not v_window.allow_edit_snapshot then
    raise exception 'Vote editing is disabled';
  end if;

  if jsonb_typeof(p_selections) <> 'array' or jsonb_array_length(p_selections) <> 11 then
    raise exception 'Exactly 11 players are required';
  end if;

  with parsed as (
    select
      (item->>'player_id')::uuid as player_id,
      (item->>'slot_index')::smallint as slot_index,
      (item->>'selected_role')::palpite.best_player_position as selected_role
    from jsonb_array_elements(p_selections) item
  )
  select count(*), count(*) filter (where selected_role = 'gk'),
    count(*) filter (where selected_role = 'df'), count(*) filter (where selected_role = 'mf'),
    count(*) filter (where selected_role = 'fw')
  into v_count, v_gk, v_df, v_mf, v_fw
  from parsed;

  if v_count <> 11 or v_gk <> 1 then raise exception 'A team must contain exactly one goalkeeper'; end if;
  if p_formation = '4-3-3' and (v_df <> 4 or v_mf <> 3 or v_fw <> 3) then raise exception 'Invalid 4-3-3 formation'; end if;
  if p_formation = '4-4-2' and (v_df <> 4 or v_mf <> 4 or v_fw <> 2) then raise exception 'Invalid 4-4-2 formation'; end if;
  if p_formation = '3-5-2' and (v_df <> 3 or v_mf <> 5 or v_fw <> 2) then raise exception 'Invalid 3-5-2 formation'; end if;
  if p_formation = 'free-11' and (v_df + v_mf + v_fw <> 10) then raise exception 'Invalid free formation'; end if;

  if exists (
    with parsed as (
      select (item->>'player_id')::uuid player_id, (item->>'slot_index')::smallint slot_index
      from jsonb_array_elements(p_selections) item
    )
    select 1 from parsed
    group by player_id having count(*) > 1
  ) or exists (
    with parsed as (
      select (item->>'player_id')::uuid player_id, (item->>'slot_index')::smallint slot_index
      from jsonb_array_elements(p_selections) item
    )
    select 1 from parsed
    group by slot_index having count(*) > 1
  ) then raise exception 'Players and slots must be unique'; end if;

  if exists (
    with parsed as (
      select (item->>'player_id')::uuid player_id,
        (item->>'selected_role')::palpite.best_player_position selected_role
      from jsonb_array_elements(p_selections) item
    )
    select 1
    from parsed s
    left join palpite.players p on p.id = s.player_id
    where p.id is null
      or (s.selected_role = 'gk' and p.position <> 'gk')
      or (v_window.respect_position_snapshot and p.position <> s.selected_role)
  ) then raise exception 'A player was assigned to an invalid position'; end if;

  if v_window.kind = 'daily' and exists (
    with parsed as (
      select (item->>'player_id')::uuid player_id from jsonb_array_elements(p_selections) item
    )
    select 1 from parsed s
    where not exists (
      select 1 from palpite.best_player_window_players wp
      where wp.window_id = p_window_id and wp.player_id = s.player_id
    )
  ) then raise exception 'A player is not eligible for this daily vote'; end if;

  if v_window.kind = 'round' and exists (
    with parsed as (
      select (item->>'player_id')::uuid player_id from jsonb_array_elements(p_selections) item
    )
    select 1 from parsed s
    where not exists (
      select 1
      from palpite.best_player_ballot_players dp
      join palpite.best_player_ballots db on db.id = dp.ballot_id and db.user_id = p_user_id
      join palpite.best_player_voting_windows dw on dw.id = db.window_id and dw.kind = 'daily'
      join palpite.best_player_window_matches dwm on dwm.window_id = dw.id
      join palpite.best_player_window_matches rwm on rwm.window_id = p_window_id and rwm.match_id = dwm.match_id
      where dw.group_id = v_window.group_id and dp.player_id = s.player_id
    )
  ) then raise exception 'A player was not selected in the user daily teams for this round'; end if;

  insert into palpite.best_player_ballots (window_id, user_id, formation, submitted_at)
  values (p_window_id, p_user_id, p_formation::palpite.best_player_formation, now())
  on conflict (window_id, user_id) do update
  set formation = excluded.formation, submitted_at = now(), updated_at = now()
  returning id into v_ballot_id;

  delete from palpite.best_player_ballot_players where ballot_id = v_ballot_id;
  insert into palpite.best_player_ballot_players (ballot_id, player_id, slot_index, selected_role)
  select v_ballot_id, (item->>'player_id')::uuid, (item->>'slot_index')::smallint,
    (item->>'selected_role')::palpite.best_player_position
  from jsonb_array_elements(p_selections) item;

  return v_ballot_id;
end;
$$;

revoke all on function palpite.save_best_player_ballot_internal(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function palpite.save_best_player_ballot_internal(uuid, uuid, text, jsonb) to service_role;

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

  create temporary table if not exists pg_temp.best_player_candidates (
    player_id uuid, selected_role palpite.best_player_position,
    round_votes integer, daily_votes integer, player_name text
  ) on commit drop;
  truncate pg_temp.best_player_candidates;

  insert into pg_temp.best_player_candidates
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
    left join daily_votes dv on dv.player_id = rv.player_id and dv.selected_role = rv.selected_role
  ;

  foreach v_role in array array['gk', 'df', 'mf', 'fw']::palpite.best_player_position[] loop
    v_limit := case v_role when 'gk' then 1 when 'df' then v_df when 'mf' then v_mf else v_fw end;
    if v_formation = 'free-11' and v_role <> 'gk' then
      if v_role <> 'df' then continue; end if;
      for rec in
        select c.* from pg_temp.best_player_candidates c
        where c.selected_role <> 'gk'
          and not exists (select 1 from palpite.best_player_results r where r.window_id = p_window_id and r.player_id = c.player_id)
        order by c.round_votes desc, c.daily_votes desc, c.player_name asc limit 10
      loop
        insert into palpite.best_player_results
          (window_id, player_id, slot_index, selected_role, round_votes, daily_votes_tiebreak)
        values (p_window_id, rec.player_id, v_slot, rec.selected_role, rec.round_votes, rec.daily_votes);
        v_slot := v_slot + 1;
      end loop;
      continue;
    end if;
    if v_limit = 0 then continue; end if;
    for rec in
      select c.* from pg_temp.best_player_candidates c
      where c.selected_role = v_role
        and not exists (select 1 from palpite.best_player_results r where r.window_id = p_window_id and r.player_id = c.player_id)
      order by c.round_votes desc, c.daily_votes desc, c.player_name asc limit v_limit
    loop
      insert into palpite.best_player_results
        (window_id, player_id, slot_index, selected_role, round_votes, daily_votes_tiebreak)
      values (p_window_id, rec.player_id, v_slot, rec.selected_role, rec.round_votes, rec.daily_votes);
      v_slot := v_slot + 1;
    end loop;
  end loop;

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

revoke all on function palpite_private.finalize_best_player_window(uuid) from public, anon, authenticated;
grant execute on function palpite_private.finalize_best_player_window(uuid) to service_role;

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

  insert into palpite.best_player_window_matches (window_id, match_id)
  select w.id, m.id
  from palpite.best_player_voting_windows w
  join palpite.matches m on m.competition_id = w.competition_id
   and ((w.kind = 'daily' and (m.match_date at time zone 'America/Recife')::date = w.vote_date)
     or (w.kind = 'round' and m.round_name = w.round_name))
  on conflict do nothing;

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

  update palpite.best_player_voting_windows
  set status = 'closed'
  where status = 'open' and closes_at <= now() and kind = 'daily';
  get diagnostics v_closed = row_count;

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

drop function if exists palpite.get_group_ranking(uuid, text, date, text, date, date);

create function palpite.get_group_ranking(
  p_group_id uuid,
  p_round_name text default null,
  p_match_date date default null,
  p_stage text default null,
  p_from date default null,
  p_to date default null
)
returns table (
  rank_position integer,
  user_id uuid,
  display_name text,
  avatar_url text,
  total_points integer,
  best_players_points integer,
  exact_scores integer,
  partial_hits integer,
  wrong_predictions integer,
  penalties integer,
  predicted_matches integer
)
language sql
stable
set search_path = palpite, public
as $$
  with group_scope as (
    select g.id, g.created_at
    from palpite.groups g
    where g.id = p_group_id and palpite_private.is_active_member(p_group_id)
  ), member_rows as (
    select gm.user_id, coalesce(p.full_name, p.nickname, 'Participante') display_name, p.avatar_url
    from palpite.group_members gm join group_scope gs on gs.id = gm.group_id
    left join palpite.profiles p on p.id = gm.user_id
    where gm.group_id = p_group_id and gm.status = 'active'
  ), filtered_scores as (
    select ps.* from palpite.prediction_scores ps
    join palpite.matches m on m.id = ps.match_id
    join group_scope gs on gs.id = ps.group_id
    where ps.group_id = p_group_id and m.match_date >= gs.created_at
      and (p_round_name is null or m.round_name = p_round_name)
      and (p_match_date is null or m.match_date::date = p_match_date)
      and (p_stage is null or m.stage::text = p_stage)
      and (p_from is null or m.match_date::date >= p_from)
      and (p_to is null or m.match_date::date <= p_to)
  ), match_totals as (
    select user_id, coalesce(sum(points), 0)::integer match_points,
      count(*) filter (where status = 'correct')::integer exact_scores,
      count(*) filter (where status = 'partial')::integer partial_hits,
      count(*) filter (where status = 'wrong')::integer wrong_predictions,
      count(*) filter (where points < 0 or status = 'inverse_penalty')::integer penalties,
      count(*)::integer predicted_matches
    from filtered_scores group by user_id
  ), bonus_totals as (
    select s.user_id, coalesce(sum(s.points), 0)::integer best_players_points
    from palpite.best_player_scores s
    join palpite.best_player_voting_windows w on w.id = s.window_id
    where s.group_id = p_group_id
      and p_match_date is null
      and (p_round_name is null or w.round_name = p_round_name)
      and (p_stage is null or w.stage::text = p_stage)
      and (p_from is null or w.closes_at::date >= p_from)
      and (p_to is null or w.closes_at::date <= p_to)
    group by s.user_id
  )
  select row_number() over (
      order by coalesce(mt.match_points, 0) + coalesce(bt.best_players_points, 0) desc,
        coalesce(mt.exact_scores, 0) desc, mr.display_name asc
    )::integer,
    mr.user_id, mr.display_name, mr.avatar_url,
    (coalesce(mt.match_points, 0) + coalesce(bt.best_players_points, 0))::integer total_points,
    coalesce(bt.best_players_points, 0)::integer,
    coalesce(mt.exact_scores, 0)::integer, coalesce(mt.partial_hits, 0)::integer,
    coalesce(mt.wrong_predictions, 0)::integer, coalesce(mt.penalties, 0)::integer,
    coalesce(mt.predicted_matches, 0)::integer
  from member_rows mr
  left join match_totals mt on mt.user_id = mr.user_id
  left join bonus_totals bt on bt.user_id = mr.user_id
  order by 1;
$$;

grant execute on function palpite.get_group_ranking(uuid, text, date, text, date, date) to authenticated;

alter table palpite.players replica identity full;
alter table palpite.best_player_voting_windows replica identity full;
alter table palpite.best_player_ballots replica identity full;
alter table palpite.best_player_results replica identity full;
alter table palpite.best_player_scores replica identity full;

do $$
declare t text;
begin
  foreach t in array array['players', 'best_player_voting_windows', 'best_player_ballots', 'best_player_results', 'best_player_scores']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'palpite' and tablename = t
    ) then execute format('alter publication supabase_realtime add table palpite.%I', t); end if;
  end loop;
end;
$$;
