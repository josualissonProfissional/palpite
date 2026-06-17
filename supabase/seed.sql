insert into palpite.competitions (name, season, api_season, start_date, end_date)
values ('FIFA World Cup', '2026', 2026, '2026-06-11', '2026-07-19')
on conflict (name, season) do nothing;

