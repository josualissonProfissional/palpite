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

create or replace function palpite_private.has_group_role(p_group_id uuid, p_roles text[])
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
      and gm.role::text = any (p_roles)
  );
$$;

create or replace function palpite_private.shares_active_group(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = palpite, public
as $$
  select p_user_id = (select auth.uid())
    or exists (
      select 1
      from palpite.group_members mine
      join palpite.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = (select auth.uid())
        and mine.status = 'active'
        and theirs.user_id = p_user_id
        and theirs.status = 'active'
    );
$$;

create or replace function palpite_private.prediction_lock_at(p_group_id uuid, p_match_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = palpite, public
as $$
  select m.match_date - make_interval(mins => coalesce(sr.lock_prediction_minutes_before, 0))
  from palpite.matches m
  join palpite.scoring_rules sr on sr.group_id = p_group_id
  where m.id = p_match_id;
$$;

create or replace function palpite_private.can_change_prediction(p_group_id uuid, p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = palpite, public
as $$
  select palpite_private.is_active_member(p_group_id)
    and now() < coalesce(palpite_private.prediction_lock_at(p_group_id, p_match_id), '-infinity'::timestamptz);
$$;

create or replace function palpite_private.can_view_prediction(p_group_id uuid, p_match_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = palpite, public
as $$
  select case
    when not palpite_private.is_active_member(p_group_id) then false
    when p_user_id = (select auth.uid()) then true
    else exists (
      select 1
      from palpite.scoring_rules sr
      join palpite.matches m on m.id = p_match_id
      where sr.group_id = p_group_id
        and (
          (now() < (m.match_date - make_interval(mins => sr.lock_prediction_minutes_before)) and sr.show_predictions_before_lock)
          or
          (now() >= (m.match_date - make_interval(mins => sr.lock_prediction_minutes_before)) and sr.show_predictions_after_lock)
        )
    )
  end;
$$;

revoke all on function palpite_private.is_active_member(uuid) from public;
revoke all on function palpite_private.has_group_role(uuid, text[]) from public;
revoke all on function palpite_private.shares_active_group(uuid) from public;
revoke all on function palpite_private.prediction_lock_at(uuid, uuid) from public;
revoke all on function palpite_private.can_change_prediction(uuid, uuid) from public;
revoke all on function palpite_private.can_view_prediction(uuid, uuid, uuid) from public;

grant execute on function palpite_private.is_active_member(uuid) to authenticated, service_role;
grant execute on function palpite_private.has_group_role(uuid, text[]) to authenticated, service_role;
grant execute on function palpite_private.shares_active_group(uuid) to authenticated, service_role;
grant execute on function palpite_private.prediction_lock_at(uuid, uuid) to authenticated, service_role;
grant execute on function palpite_private.can_change_prediction(uuid, uuid) to authenticated, service_role;
grant execute on function palpite_private.can_view_prediction(uuid, uuid, uuid) to authenticated, service_role;

alter table palpite.profiles enable row level security;
alter table palpite.competitions enable row level security;
alter table palpite.teams enable row level security;
alter table palpite.matches enable row level security;
alter table palpite.standings enable row level security;
alter table palpite.match_statistics enable row level security;
alter table palpite.match_events enable row level security;
alter table palpite.groups enable row level security;
alter table palpite.group_members enable row level security;
alter table palpite.group_invites enable row level security;
alter table palpite.scoring_rules enable row level security;
alter table palpite.predictions enable row level security;
alter table palpite.prediction_scores enable row level security;
alter table palpite.sync_runs enable row level security;
alter table palpite.audit_logs enable row level security;

create policy profiles_select_own_or_shared_group
on palpite.profiles for select
to authenticated
using (palpite_private.shares_active_group(id));

create policy profiles_insert_own
on palpite.profiles for insert
to authenticated
with check (id = (select auth.uid()));

create policy profiles_update_own
on palpite.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy competitions_select_authenticated
on palpite.competitions for select
to authenticated
using (true);

create policy teams_select_authenticated
on palpite.teams for select
to authenticated
using (true);

create policy matches_select_authenticated
on palpite.matches for select
to authenticated
using (true);

create policy standings_select_authenticated
on palpite.standings for select
to authenticated
using (true);

create policy match_statistics_select_authenticated
on palpite.match_statistics for select
to authenticated
using (true);

create policy match_events_select_authenticated
on palpite.match_events for select
to authenticated
using (true);

create policy groups_select_active_members
on palpite.groups for select
to authenticated
using (palpite_private.is_active_member(id));

create policy groups_insert_creator
on palpite.groups for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy groups_update_admins
on palpite.groups for update
to authenticated
using (palpite_private.has_group_role(id, array['owner', 'admin']))
with check (palpite_private.has_group_role(id, array['owner', 'admin']));

create policy group_members_select_same_group
on palpite.group_members for select
to authenticated
using (palpite_private.is_active_member(group_id));

create policy group_members_insert_group_creator_owner
on palpite.group_members for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'owner'
  and status = 'active'
  and exists (
    select 1
    from palpite.groups g
    where g.id = group_id
      and g.created_by = (select auth.uid())
  )
);

create policy group_members_update_admins
on palpite.group_members for update
to authenticated
using (palpite_private.has_group_role(group_id, array['owner', 'admin']))
with check (palpite_private.has_group_role(group_id, array['owner', 'admin']));

create policy group_members_delete_admins
on palpite.group_members for delete
to authenticated
using (palpite_private.has_group_role(group_id, array['owner', 'admin']));

create policy group_invites_select_admins
on palpite.group_invites for select
to authenticated
using (palpite_private.has_group_role(group_id, array['owner', 'admin']));

create policy group_invites_insert_admins
on palpite.group_invites for insert
to authenticated
with check (
  invited_by = (select auth.uid())
  and palpite_private.has_group_role(group_id, array['owner', 'admin'])
);

create policy group_invites_update_admins
on palpite.group_invites for update
to authenticated
using (palpite_private.has_group_role(group_id, array['owner', 'admin']))
with check (palpite_private.has_group_role(group_id, array['owner', 'admin']));

create policy group_invites_delete_admins
on palpite.group_invites for delete
to authenticated
using (palpite_private.has_group_role(group_id, array['owner', 'admin']));

create policy scoring_rules_select_members
on palpite.scoring_rules for select
to authenticated
using (palpite_private.is_active_member(group_id));

create policy scoring_rules_insert_admins
on palpite.scoring_rules for insert
to authenticated
with check (palpite_private.has_group_role(group_id, array['owner', 'admin']));

create policy scoring_rules_update_admins
on palpite.scoring_rules for update
to authenticated
using (palpite_private.has_group_role(group_id, array['owner', 'admin']))
with check (palpite_private.has_group_role(group_id, array['owner', 'admin']));

create policy predictions_select_by_visibility
on palpite.predictions for select
to authenticated
using (palpite_private.can_view_prediction(group_id, match_id, user_id));

create policy predictions_insert_own_before_lock
on palpite.predictions for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and palpite_private.can_change_prediction(group_id, match_id)
);

create policy predictions_update_own_before_lock
on palpite.predictions for update
to authenticated
using (
  user_id = (select auth.uid())
  and palpite_private.can_change_prediction(group_id, match_id)
)
with check (
  user_id = (select auth.uid())
  and palpite_private.can_change_prediction(group_id, match_id)
);

create policy predictions_delete_own_before_lock
on palpite.predictions for delete
to authenticated
using (
  user_id = (select auth.uid())
  and palpite_private.can_change_prediction(group_id, match_id)
);

create policy prediction_scores_select_members
on palpite.prediction_scores for select
to authenticated
using (palpite_private.is_active_member(group_id));

create policy audit_logs_insert_own
on palpite.audit_logs for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy audit_logs_select_admins
on palpite.audit_logs for select
to authenticated
using (
  group_id is not null
  and palpite_private.has_group_role(group_id, array['owner', 'admin'])
);
