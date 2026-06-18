create or replace function palpite.finalize_stale_live_match()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('live', 'halftime')
    and new.match_date <= now() - interval '3 hours'
    and new.home_score is not null
    and new.away_score is not null
  then
    new.status := 'finished';
    new.elapsed := coalesce(new.elapsed, 90);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_finalize_stale_live_match on palpite.matches;

create trigger trg_finalize_stale_live_match
before insert or update of status, home_score, away_score, match_date
on palpite.matches
for each row
execute function palpite.finalize_stale_live_match();

update palpite.matches
set status = 'finished',
    elapsed = coalesce(elapsed, 90)
where status in ('live', 'halftime')
  and match_date <= now() - interval '3 hours'
  and home_score is not null
  and away_score is not null;
