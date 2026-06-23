create type palpite.goal_assist_scoring_mode as enum ('separate', 'pair_only');

alter table palpite.scoring_rules
  add column goal_scorer_points integer not null default 1,
  add column goal_assist_points integer not null default 1,
  add column goal_assist_scoring_mode palpite.goal_assist_scoring_mode not null default 'separate',
  add constraint scoring_rules_goal_scorer_points_check check (goal_scorer_points between 0 and 100),
  add constraint scoring_rules_goal_assist_points_check check (goal_assist_points between 0 and 100);

alter table palpite.players
  add column api_sports_player_id bigint unique;

alter table palpite.teams
  add column api_sports_team_id bigint unique;

alter table palpite.matches
  add column api_sports_fixture_id bigint unique;

alter table palpite.match_events
  add column scorer_player_id uuid references palpite.players(id) on delete set null,
  add column assist_player_id uuid references palpite.players(id) on delete set null,
  add column is_cancelled boolean not null default false,
  add column source_event_key text unique;

create table palpite.prediction_goal_selections (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references palpite.predictions(id) on delete cascade,
  team_id uuid not null references palpite.teams(id) on delete cascade,
  goal_index smallint not null,
  scorer_player_id uuid not null references palpite.players(id) on delete restrict,
  assist_player_id uuid references palpite.players(id) on delete restrict,
  is_own_goal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prediction_id, team_id, goal_index),
  constraint prediction_goal_selections_goal_index_check check (goal_index > 0),
  constraint prediction_goal_selections_own_goal_assist_check check (not is_own_goal or assist_player_id is null)
);

create index prediction_goal_selections_prediction_idx
  on palpite.prediction_goal_selections (prediction_id);

alter table palpite.prediction_scores
  add column score_points integer not null default 0,
  add column goal_assist_points integer not null default 0;

update palpite.prediction_scores
set score_points = points;

alter table palpite.prediction_goal_selections enable row level security;

create policy prediction_goal_selections_select_members
on palpite.prediction_goal_selections for select
to authenticated
using (
  exists (
    select 1
    from palpite.predictions p
    where p.id = prediction_id
      and palpite_private.can_view_prediction(p.group_id, p.match_id, p.user_id)
  )
);

create or replace function palpite_private.recalculate_goal_assist_points(
  p_match_id uuid,
  p_group_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = palpite, public
as $$
declare
  rec record;
  v_goal_assist_points integer;
  v_changed integer := 0;
begin
  for rec in
    select
      ps.id as prediction_score_id,
      ps.points as base_points,
      ps.score_reason,
      p.id as prediction_id,
      p.match_id,
      sr.goal_scorer_points,
      sr.goal_assist_points,
      sr.goal_assist_scoring_mode
    from palpite.prediction_scores ps
    join palpite.predictions p on p.id = ps.prediction_id
    join palpite.scoring_rules sr on sr.group_id = ps.group_id
    where ps.match_id = p_match_id
      and (p_group_id is null or ps.group_id = p_group_id)
  loop
    with actual_goals as (
      select
        e.team_id,
        e.scorer_player_id,
        e.assist_player_id,
        row_number() over (
          partition by e.team_id
          order by coalesce(e.minute, 999), coalesce(e.extra_minute, 0), e.created_at, e.id
        )::smallint as goal_index
      from palpite.match_events e
      where e.match_id = rec.match_id
        and e.event_type in ('goal', 'own_goal', 'penalty')
        and not e.is_cancelled
        and e.scorer_player_id is not null
    )
    select coalesce(sum(
      case
        when rec.goal_assist_scoring_mode = 'pair_only'
          and s.scorer_player_id = a.scorer_player_id
          and s.assist_player_id is not distinct from a.assist_player_id
          then rec.goal_scorer_points + rec.goal_assist_points
        when rec.goal_assist_scoring_mode = 'separate' then
          case when s.scorer_player_id = a.scorer_player_id then rec.goal_scorer_points else 0 end
          + case when s.assist_player_id is not distinct from a.assist_player_id then rec.goal_assist_points else 0 end
        else 0
      end
    ), 0)::integer
    into v_goal_assist_points
    from palpite.prediction_goal_selections s
    join actual_goals a
      on a.team_id = s.team_id
      and a.goal_index = s.goal_index
    where s.prediction_id = rec.prediction_id;

    update palpite.prediction_scores
    set
      score_points = rec.base_points,
      goal_assist_points = v_goal_assist_points,
      points = rec.base_points + v_goal_assist_points,
      score_reason = case
        when v_goal_assist_points > 0 then concat_ws(' · ', rec.score_reason, format('+%s pts em gols e assistências', v_goal_assist_points))
        else rec.score_reason
      end,
      calculated_at = now()
    where id = rec.prediction_score_id;
    v_changed := v_changed + 1;
  end loop;

  return v_changed;
end;
$$;

revoke all on function palpite_private.recalculate_goal_assist_points(uuid, uuid) from public, anon, authenticated;
grant execute on function palpite_private.recalculate_goal_assist_points(uuid, uuid) to service_role;

create or replace function palpite_private.recalculate_scores_after_event_change()
returns trigger
language plpgsql
security definer
set search_path = palpite, public
as $$
declare
  v_match_id uuid := coalesce(new.match_id, old.match_id);
begin
  perform palpite.recalculate_match_scores(v_match_id, null);
  perform palpite_private.recalculate_goal_assist_points(v_match_id, null);
  return coalesce(new, old);
end;
$$;

revoke all on function palpite_private.recalculate_scores_after_event_change() from public;

create trigger recalculate_scores_after_match_event_change
after insert or update or delete on palpite.match_events
for each row execute function palpite_private.recalculate_scores_after_event_change();

create or replace function palpite_private.recalculate_scores_after_match_change()
returns trigger
language plpgsql
security definer
set search_path = palpite, public
as $$
begin
  if new.home_score is not null
    and new.away_score is not null
    and new.status in ('live', 'halftime', 'finished')
  then
    perform palpite.recalculate_match_scores(new.id, null);
    perform palpite_private.recalculate_goal_assist_points(new.id, null);
  elsif tg_op = 'UPDATE'
    and old.status in ('live', 'halftime')
    and new.status in ('scheduled', 'postponed', 'cancelled')
  then
    delete from palpite.prediction_scores
    where match_id = new.id
      and is_final = false;
  end if;
  return new;
end;
$$;

create or replace function palpite.save_prediction_with_goal_selections(
  p_group_id uuid,
  p_user_id uuid,
  p_match_id uuid,
  p_predicted_home_score smallint,
  p_predicted_away_score smallint,
  p_goal_selections jsonb
)
returns table (
  id uuid,
  group_id uuid,
  user_id uuid,
  match_id uuid,
  predicted_home_score smallint,
  predicted_away_score smallint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = palpite, public
as $$
declare
  v_prediction_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_match_date timestamptz;
  v_match_status palpite.match_status;
  v_group_created_at timestamptz;
  v_lock_minutes integer;
  v_item jsonb;
  v_team_id uuid;
  v_scorer_player_id uuid;
  v_assist_player_id uuid;
  v_goal_index smallint;
  v_is_own_goal boolean;
  v_expected integer;
begin
  if p_predicted_home_score < 0 or p_predicted_away_score < 0 or p_predicted_home_score > 99 or p_predicted_away_score > 99 then
    raise exception 'Invalid predicted score';
  end if;
  if jsonb_typeof(p_goal_selections) <> 'array' then
    raise exception 'goal_selections must be an array';
  end if;
  if not exists (
    select 1 from palpite.group_members gm
    where gm.group_id = p_group_id and gm.user_id = p_user_id and gm.status = 'active'
  ) then
    raise exception 'User is not an active member of this group';
  end if;

  select m.home_team_id, m.away_team_id, m.match_date, m.status, g.created_at, sr.lock_prediction_minutes_before
  into v_home_team_id, v_away_team_id, v_match_date, v_match_status, v_group_created_at, v_lock_minutes
  from palpite.matches m
  join palpite.groups g on g.id = p_group_id
  join palpite.scoring_rules sr on sr.group_id = p_group_id
  where m.id = p_match_id;
  if not found then raise exception 'Match or scoring rules not found'; end if;
  if v_match_status <> 'scheduled' or v_match_date < v_group_created_at or now() >= v_match_date - make_interval(mins => v_lock_minutes) then
    raise exception 'Prediction is locked for this match';
  end if;
  if jsonb_array_length(p_goal_selections) <> p_predicted_home_score + p_predicted_away_score then
    raise exception 'A selection is required for each predicted goal';
  end if;

  insert into palpite.predictions (group_id, user_id, match_id, predicted_home_score, predicted_away_score)
  values (p_group_id, p_user_id, p_match_id, p_predicted_home_score, p_predicted_away_score)
  on conflict on constraint predictions_group_id_user_id_match_id_key do update
    set predicted_home_score = excluded.predicted_home_score,
        predicted_away_score = excluded.predicted_away_score
  returning predictions.id into v_prediction_id;

  delete from palpite.prediction_goal_selections where prediction_id = v_prediction_id;

  for v_item in select value from jsonb_array_elements(p_goal_selections)
  loop
    v_team_id := (v_item->>'team_id')::uuid;
    v_scorer_player_id := (v_item->>'scorer_player_id')::uuid;
    v_assist_player_id := nullif(v_item->>'assist_player_id', '')::uuid;
    v_goal_index := (v_item->>'goal_index')::smallint;
    v_is_own_goal := coalesce((v_item->>'is_own_goal')::boolean, false);
    v_expected := case when v_team_id = v_home_team_id then p_predicted_home_score when v_team_id = v_away_team_id then p_predicted_away_score else -1 end;
    if v_expected < 0 or v_goal_index < 1 or v_goal_index > v_expected then raise exception 'Invalid goal selection'; end if;
    if v_is_own_goal then
      if v_assist_player_id is not null or not exists (select 1 from palpite.players pl where pl.id = v_scorer_player_id and pl.team_id = case when v_team_id = v_home_team_id then v_away_team_id else v_home_team_id end) then
        raise exception 'Invalid own goal selection';
      end if;
    elsif not exists (select 1 from palpite.players pl where pl.id = v_scorer_player_id and pl.team_id = v_team_id)
      or (v_assist_player_id is not null and not exists (select 1 from palpite.players pl where pl.id = v_assist_player_id and pl.team_id = v_team_id)) then
      raise exception 'Selected players must belong to the scoring team';
    end if;
    insert into palpite.prediction_goal_selections (prediction_id, team_id, goal_index, scorer_player_id, assist_player_id, is_own_goal)
    values (v_prediction_id, v_team_id, v_goal_index, v_scorer_player_id, v_assist_player_id, v_is_own_goal);
  end loop;

  return query select p.id, p.group_id, p.user_id, p.match_id, p.predicted_home_score, p.predicted_away_score, p.updated_at
  from palpite.predictions p where p.id = v_prediction_id;
end;
$$;

revoke all on function palpite.save_prediction_with_goal_selections(uuid, uuid, uuid, smallint, smallint, jsonb) from public, anon, authenticated;
grant execute on function palpite.save_prediction_with_goal_selections(uuid, uuid, uuid, smallint, smallint, jsonb) to service_role;

create trigger set_prediction_goal_selections_updated_at
before update on palpite.prediction_goal_selections
for each row execute function palpite.set_updated_at();
