alter role authenticator set pgrst.db_schemas = 'public, storage, graphql_public, palpite';

grant usage on schema palpite to anon, authenticated, service_role;
grant all on all tables in schema palpite to anon, authenticated, service_role;
grant all on all routines in schema palpite to anon, authenticated, service_role;
grant all on all sequences in schema palpite to anon, authenticated, service_role;

alter default privileges for role postgres in schema palpite
grant all on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema palpite
grant all on routines to anon, authenticated, service_role;

alter default privileges for role postgres in schema palpite
grant all on sequences to anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
