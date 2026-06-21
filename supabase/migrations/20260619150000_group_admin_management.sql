-- Permite que donos e administradores promovam membros e apaguem o grupo.
-- O cargo do dono continua protegido contra alterações feitas pela API.

drop policy if exists group_members_update_admins on palpite.group_members;

create policy group_members_update_admins
on palpite.group_members for update
to authenticated
using (
  role <> 'owner'
  and palpite_private.has_group_role(group_id, array['owner', 'admin'])
)
with check (
  role <> 'owner'
  and palpite_private.has_group_role(group_id, array['owner', 'admin'])
);

create policy groups_delete_admins
on palpite.groups for delete
to authenticated
using (palpite_private.has_group_role(id, array['owner', 'admin']));
