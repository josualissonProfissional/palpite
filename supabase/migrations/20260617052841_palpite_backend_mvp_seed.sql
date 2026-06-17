insert into palpite.competitions (name, season, api_season, start_date, end_date)
values ('FIFA World Cup', '2026', 2026, '2026-06-11', '2026-07-19')
on conflict (name, season) do update set
  api_season = excluded.api_season,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  updated_at = now();

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from anon, authenticated;
  end if;
end;
$$;
