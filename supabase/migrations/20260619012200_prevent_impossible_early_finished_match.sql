create or replace function palpite.prevent_impossible_early_finished_match()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'finished'
    and new.match_date > now() - interval '105 minutes'
  then
    if tg_op = 'UPDATE' then
      new.status := old.status;
      new.home_score := old.home_score;
      new.away_score := old.away_score;
      new.elapsed := old.elapsed;
      new.winner_team_id := old.winner_team_id;
    else
      new.status := 'scheduled';
      new.home_score := null;
      new.away_score := null;
      new.elapsed := null;
      new.winner_team_id := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_impossible_early_finished_match on palpite.matches;
create trigger trg_prevent_impossible_early_finished_match
before insert or update on palpite.matches
for each row execute function palpite.prevent_impossible_early_finished_match();
