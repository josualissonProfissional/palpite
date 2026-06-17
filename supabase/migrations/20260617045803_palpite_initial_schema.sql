create schema if not exists palpite;
create schema if not exists palpite_private;

create extension if not exists pgcrypto with schema extensions;

revoke all on schema palpite from public;
revoke all on schema palpite_private from public;

grant usage on schema palpite to anon, authenticated, service_role;
grant usage on schema palpite_private to authenticated, service_role;

create type palpite.member_role as enum ('owner', 'admin', 'member');
create type palpite.member_status as enum ('pending', 'active', 'blocked', 'left');
create type palpite.group_invite_status as enum ('active', 'revoked', 'expired');
create type palpite.match_stage as enum (
  'group_stage',
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final'
);
create type palpite.match_status as enum (
  'scheduled',
  'live',
  'halftime',
  'finished',
  'postponed',
  'cancelled'
);
create type palpite.inverse_score_policy as enum ('no_points', 'penalty', 'zero');
create type palpite.prediction_score_status as enum (
  'pending',
  'correct',
  'partial',
  'wrong',
  'inverse_penalty'
);
create type palpite.match_event_type as enum (
  'goal',
  'own_goal',
  'penalty',
  'missed_penalty',
  'yellow_card',
  'red_card',
  'substitution',
  'var',
  'other'
);
create type palpite.sync_status as enum ('running', 'success', 'skipped', 'failed');

create table palpite.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  nickname text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table palpite.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season text not null,
  api_league_id integer,
  api_season integer,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, season)
);

create table palpite.teams (
  id uuid primary key default gen_random_uuid(),
  api_team_id integer unique,
  name text not null,
  country text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table palpite.matches (
  id uuid primary key default gen_random_uuid(),
  api_fixture_id bigint unique,
  competition_id uuid not null references palpite.competitions(id) on delete cascade,
  home_team_id uuid references palpite.teams(id),
  away_team_id uuid references palpite.teams(id),
  group_name text,
  round_name text,
  stage palpite.match_stage not null default 'group_stage',
  match_date timestamptz not null,
  status palpite.match_status not null default 'scheduled',
  elapsed smallint,
  home_score smallint,
  away_score smallint,
  winner_team_id uuid references palpite.teams(id),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_elapsed_check check (elapsed is null or elapsed between 0 and 130),
  constraint matches_home_score_check check (home_score is null or home_score >= 0),
  constraint matches_away_score_check check (away_score is null or away_score >= 0),
  constraint matches_distinct_teams_check check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id)
);

create table palpite.standings (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references palpite.competitions(id) on delete cascade,
  team_id uuid not null references palpite.teams(id) on delete cascade,
  group_name text,
  position smallint not null,
  played smallint not null default 0,
  won smallint not null default 0,
  drawn smallint not null default 0,
  lost smallint not null default 0,
  goals_for smallint not null default 0,
  goals_against smallint not null default 0,
  goal_difference smallint not null default 0,
  points smallint not null default 0,
  synced_at timestamptz not null default now(),
  unique (competition_id, team_id, group_name)
);

create table palpite.match_statistics (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references palpite.matches(id) on delete cascade,
  possession_home smallint,
  possession_away smallint,
  shots_home smallint,
  shots_away smallint,
  shots_on_goal_home smallint,
  shots_on_goal_away smallint,
  corners_home smallint,
  corners_away smallint,
  yellow_cards_home smallint,
  yellow_cards_away smallint,
  red_cards_home smallint,
  red_cards_away smallint,
  synced_at timestamptz not null default now(),
  unique (match_id)
);

create table palpite.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references palpite.matches(id) on delete cascade,
  team_id uuid references palpite.teams(id),
  player_name text,
  event_type palpite.match_event_type not null default 'other',
  minute smallint,
  extra_minute smallint,
  description text,
  created_at timestamptz not null default now()
);

create table palpite.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_by uuid not null references auth.users(id) on delete restrict,
  competition_id uuid references palpite.competitions(id) on delete restrict,
  is_private boolean not null default true,
  invite_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_name_not_blank check (length(btrim(name)) > 0),
  constraint groups_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table palpite.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references palpite.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role palpite.member_role not null default 'member',
  status palpite.member_status not null default 'active',
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table palpite.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references palpite.groups(id) on delete cascade,
  code text not null unique,
  role palpite.member_role not null default 'member',
  invited_by uuid not null references auth.users(id) on delete restrict,
  max_uses integer,
  uses_count integer not null default 0,
  expires_at timestamptz,
  status palpite.group_invite_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_invites_no_owner check (role <> 'owner'),
  constraint group_invites_uses_check check (max_uses is null or max_uses > 0),
  constraint group_invites_uses_count_check check (uses_count >= 0)
);

create table palpite.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references palpite.groups(id) on delete cascade,
  exact_score_points integer not null default 5,
  correct_winner_points integer not null default 3,
  correct_draw_points integer not null default 3,
  correct_goal_home_points integer not null default 1,
  correct_goal_away_points integer not null default 1,
  wrong_prediction_points integer not null default 0,
  inverse_score_policy palpite.inverse_score_policy not null default 'penalty',
  inverse_score_penalty integer not null default -1,
  allow_negative_score boolean not null default true,
  lock_prediction_minutes_before integer not null default 10,
  show_predictions_before_lock boolean not null default false,
  show_predictions_after_lock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id),
  constraint scoring_rules_lock_check check (lock_prediction_minutes_before >= 0)
);

create table palpite.predictions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references palpite.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references palpite.matches(id) on delete cascade,
  predicted_home_score smallint not null,
  predicted_away_score smallint not null,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id, match_id),
  constraint predictions_home_score_check check (predicted_home_score >= 0),
  constraint predictions_away_score_check check (predicted_away_score >= 0)
);

create table palpite.prediction_scores (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references palpite.predictions(id) on delete cascade,
  group_id uuid not null references palpite.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references palpite.matches(id) on delete cascade,
  points integer not null default 0,
  status palpite.prediction_score_status not null default 'pending',
  score_reason text,
  is_final boolean not null default false,
  calculated_at timestamptz not null default now(),
  unique (prediction_id),
  unique (group_id, user_id, match_id)
);

create table palpite.sync_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  provider text not null default 'api-football',
  status palpite.sync_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  request_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  error text
);

create table palpite.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  group_id uuid references palpite.groups(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index profiles_nickname_idx on palpite.profiles (nickname);
create index matches_competition_date_idx on palpite.matches (competition_id, match_date);
create index matches_stage_idx on palpite.matches (stage);
create index standings_competition_group_idx on palpite.standings (competition_id, group_name, position);
create index group_members_user_status_idx on palpite.group_members (user_id, status);
create index group_members_group_status_idx on palpite.group_members (group_id, status);
create index group_invites_group_status_idx on palpite.group_invites (group_id, status);
create index predictions_group_match_idx on palpite.predictions (group_id, match_id);
create index predictions_user_group_idx on palpite.predictions (user_id, group_id);
create index prediction_scores_group_points_idx on palpite.prediction_scores (group_id, points desc);
create index prediction_scores_match_idx on palpite.prediction_scores (match_id);
create index audit_logs_group_created_idx on palpite.audit_logs (group_id, created_at desc);

create or replace function palpite.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on palpite.profiles for each row execute function palpite.set_updated_at();
create trigger set_competitions_updated_at before update on palpite.competitions for each row execute function palpite.set_updated_at();
create trigger set_teams_updated_at before update on palpite.teams for each row execute function palpite.set_updated_at();
create trigger set_matches_updated_at before update on palpite.matches for each row execute function palpite.set_updated_at();
create trigger set_groups_updated_at before update on palpite.groups for each row execute function palpite.set_updated_at();
create trigger set_group_members_updated_at before update on palpite.group_members for each row execute function palpite.set_updated_at();
create trigger set_group_invites_updated_at before update on palpite.group_invites for each row execute function palpite.set_updated_at();
create trigger set_scoring_rules_updated_at before update on palpite.scoring_rules for each row execute function palpite.set_updated_at();
create trigger set_predictions_updated_at before update on palpite.predictions for each row execute function palpite.set_updated_at();

create or replace function palpite_private.is_active_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = palpite, public
as $$
  select exists (
    select 1
    from palpite.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = (select auth.uid())
      and gm.status = 'active'
  );
$$;

revoke all on function palpite_private.is_active_member(uuid) from public;

create or replace function palpite_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = palpite, public
as $$
begin
  insert into palpite.profiles (id, full_name, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    nullif(split_part(new.email, '@', 1), ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function palpite_private.handle_new_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function palpite_private.handle_new_user();

create or replace function palpite.get_group_ranking(
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
  with member_rows as (
    select gm.user_id, coalesce(p.nickname, p.full_name, 'Participante') as display_name, p.avatar_url
    from palpite.group_members gm
    left join palpite.profiles p on p.id = gm.user_id
    where gm.group_id = p_group_id
      and gm.status = 'active'
      and palpite_private.is_active_member(p_group_id)
  ),
  filtered_scores as (
    select ps.*
    from palpite.prediction_scores ps
    join palpite.matches m on m.id = ps.match_id
    where ps.group_id = p_group_id
      and (p_round_name is null or m.round_name = p_round_name)
      and (p_match_date is null or m.match_date::date = p_match_date)
      and (p_stage is null or m.stage::text = p_stage)
      and (p_from is null or m.match_date::date >= p_from)
      and (p_to is null or m.match_date::date <= p_to)
  ),
  totals as (
    select
      user_id,
      coalesce(sum(points), 0)::integer as total_points,
      count(*) filter (where status = 'correct')::integer as exact_scores,
      count(*) filter (where status = 'partial')::integer as partial_hits,
      count(*) filter (where status = 'wrong')::integer as wrong_predictions,
      count(*) filter (where points < 0 or status = 'inverse_penalty')::integer as penalties,
      count(*)::integer as predicted_matches
    from filtered_scores
    group by user_id
  )
  select
    row_number() over (
      order by coalesce(t.total_points, 0) desc, coalesce(t.exact_scores, 0) desc, mr.display_name asc
    )::integer as rank_position,
    mr.user_id,
    mr.display_name,
    mr.avatar_url,
    coalesce(t.total_points, 0)::integer as total_points,
    coalesce(t.exact_scores, 0)::integer as exact_scores,
    coalesce(t.partial_hits, 0)::integer as partial_hits,
    coalesce(t.wrong_predictions, 0)::integer as wrong_predictions,
    coalesce(t.penalties, 0)::integer as penalties,
    coalesce(t.predicted_matches, 0)::integer as predicted_matches
  from member_rows mr
  left join totals t on t.user_id = mr.user_id
  order by rank_position;
$$;

create or replace function palpite.recalculate_match_scores(p_match_id uuid, p_group_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = palpite, public
as $$
declare
  rec record;
  v_points integer;
  v_status palpite.prediction_score_status;
  v_reason text;
  v_predicted_winner text;
  v_result_winner text;
  v_changed integer := 0;
begin
  for rec in
    select
      p.id as prediction_id,
      p.group_id,
      p.user_id,
      p.match_id,
      p.predicted_home_score,
      p.predicted_away_score,
      m.home_score,
      m.away_score,
      m.status as match_status,
      sr.exact_score_points,
      sr.correct_winner_points,
      sr.correct_draw_points,
      sr.correct_goal_home_points,
      sr.correct_goal_away_points,
      sr.wrong_prediction_points,
      sr.inverse_score_policy,
      sr.inverse_score_penalty,
      sr.allow_negative_score
    from palpite.predictions p
    join palpite.matches m on m.id = p.match_id
    join palpite.scoring_rules sr on sr.group_id = p.group_id
    where p.match_id = p_match_id
      and (p_group_id is null or p.group_id = p_group_id)
      and m.home_score is not null
      and m.away_score is not null
  loop
    v_points := 0;
    v_status := 'wrong';
    v_reason := 'Errou o palpite';

    if rec.predicted_home_score = rec.home_score and rec.predicted_away_score = rec.away_score then
      v_points := rec.exact_score_points;
      v_status := 'correct';
      v_reason := 'Placar exato';
    elsif rec.predicted_home_score = rec.predicted_away_score and rec.home_score = rec.away_score then
      v_points := rec.correct_draw_points;
      v_status := 'partial';
      v_reason := 'Acertou empate';
    elsif rec.predicted_home_score = rec.away_score and rec.predicted_away_score = rec.home_score then
      if rec.inverse_score_policy = 'penalty' then
        v_points := case when rec.allow_negative_score then rec.inverse_score_penalty else 0 end;
        v_status := 'inverse_penalty';
        v_reason := 'Placar contrário';
      else
        v_points := 0;
        v_status := 'wrong';
        v_reason := 'Placar contrário zerado';
      end if;
    else
      v_predicted_winner := case
        when rec.predicted_home_score > rec.predicted_away_score then 'home'
        when rec.predicted_away_score > rec.predicted_home_score then 'away'
        else 'draw'
      end;
      v_result_winner := case
        when rec.home_score > rec.away_score then 'home'
        when rec.away_score > rec.home_score then 'away'
        else 'draw'
      end;

      if v_predicted_winner = v_result_winner then
        v_points := rec.correct_winner_points;
        if rec.predicted_home_score = rec.home_score then
          v_points := v_points + rec.correct_goal_home_points;
        end if;
        if rec.predicted_away_score = rec.away_score then
          v_points := v_points + rec.correct_goal_away_points;
        end if;
        v_status := 'partial';
        v_reason := 'Acertou o vencedor';
      else
        v_points := case when rec.allow_negative_score then rec.wrong_prediction_points else greatest(0, rec.wrong_prediction_points) end;
        v_status := 'wrong';
        v_reason := 'Errou o palpite';
      end if;
    end if;

    insert into palpite.prediction_scores (
      prediction_id,
      group_id,
      user_id,
      match_id,
      points,
      status,
      score_reason,
      is_final,
      calculated_at
    )
    values (
      rec.prediction_id,
      rec.group_id,
      rec.user_id,
      rec.match_id,
      v_points,
      v_status,
      v_reason,
      rec.match_status = 'finished',
      now()
    )
    on conflict (group_id, user_id, match_id)
    do update set
      prediction_id = excluded.prediction_id,
      points = excluded.points,
      status = excluded.status,
      score_reason = excluded.score_reason,
      is_final = excluded.is_final,
      calculated_at = excluded.calculated_at;

    v_changed := v_changed + 1;
  end loop;

  return v_changed;
end;
$$;

revoke all on function palpite.recalculate_match_scores(uuid, uuid) from public, anon, authenticated;
grant execute on function palpite.recalculate_match_scores(uuid, uuid) to service_role;
grant execute on function palpite.get_group_ranking(uuid, text, date, text, date, date) to authenticated;

grant select on
  palpite.competitions,
  palpite.teams,
  palpite.matches,
  palpite.standings,
  palpite.match_statistics,
  palpite.match_events
to authenticated;

grant select, insert, update, delete on
  palpite.profiles,
  palpite.groups,
  palpite.group_members,
  palpite.group_invites,
  palpite.scoring_rules,
  palpite.predictions,
  palpite.prediction_scores
to authenticated;

grant select, insert on palpite.audit_logs to authenticated;
grant all privileges on all tables in schema palpite to service_role;
grant all privileges on all functions in schema palpite to service_role;
