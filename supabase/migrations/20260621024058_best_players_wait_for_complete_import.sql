create or replace function palpite_private.require_complete_best_player_import()
returns trigger
language plpgsql
set search_path = palpite, public
as $$
begin
  if old.kind = 'daily'
    and old.status = 'scheduled'
    and new.status = 'open'
    and exists (
      select 1
      from palpite.best_player_window_matches wm
      join palpite.matches m on m.id = wm.match_id
      where wm.window_id = old.id
        and m.status = 'finished'
        and m.best_players_imported_at is null
    )
  then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function palpite_private.require_complete_best_player_import()
from public, anon, authenticated;

create trigger require_complete_best_player_import_before_open
before update of status on palpite.best_player_voting_windows
for each row execute function palpite_private.require_complete_best_player_import();

update palpite.best_player_voting_windows w
set status = 'scheduled', opened_at = null, closes_at = null, eligibility_source = null
where w.kind = 'daily'
  and w.status = 'open'
  and not exists (
    select 1 from palpite.best_player_ballots b where b.window_id = w.id
  )
  and exists (
    select 1
    from palpite.best_player_window_matches wm
    join palpite.matches m on m.id = wm.match_id
    where wm.window_id = w.id
      and m.status = 'finished'
      and m.best_players_imported_at is null
  );

delete from palpite.best_player_window_players wp
using palpite.best_player_voting_windows w
where w.id = wp.window_id and w.kind = 'daily' and w.status = 'scheduled';
