create or replace function palpite.coerce_scheduled_match_live_window()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'scheduled'
    and new.match_date <= now()
    and new.match_date > now() - interval '3 hours'
    and new.home_score is null
    and new.away_score is null
  then
    new.status := 'live';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_coerce_scheduled_match_live_window on palpite.matches;

create trigger trg_coerce_scheduled_match_live_window
before insert or update of status, home_score, away_score, match_date
on palpite.matches
for each row
execute function palpite.coerce_scheduled_match_live_window();

update palpite.matches
set status = 'live'
where status = 'scheduled'
  and match_date <= now()
  and match_date > now() - interval '3 hours'
  and home_score is null
  and away_score is null;
