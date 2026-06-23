-- Permite que membros do grupo vejam as cédulas uns dos outros
-- em janelas DIÁRIAS finalizadas (antes só funcionava para rodadas).
create policy best_player_ballots_select_finalized_daily_members
on palpite.best_player_ballots
for select
to authenticated
using (
  exists (
    select 1
    from palpite.best_player_voting_windows w
    join palpite.group_members gm
      on gm.group_id = w.group_id
     and gm.user_id = (select auth.uid())
     and gm.status = 'active'
    where w.id = window_id
      and w.kind = 'daily'
      and w.status = 'finalized'
  )
);

create policy best_player_ballot_players_select_finalized_daily_members
on palpite.best_player_ballot_players
for select
to authenticated
using (
  exists (
    select 1
    from palpite.best_player_ballots b
    join palpite.best_player_voting_windows w on w.id = b.window_id
    join palpite.group_members gm
      on gm.group_id = w.group_id
     and gm.user_id = (select auth.uid())
     and gm.status = 'active'
    where b.id = ballot_id
      and w.kind = 'daily'
      and w.status = 'finalized'
  )
);
