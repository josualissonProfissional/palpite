-- Permite que administradores decidam se membros comuns podem gerar convites.
alter table palpite.groups
add column if not exists allow_member_invites boolean not null default false;

