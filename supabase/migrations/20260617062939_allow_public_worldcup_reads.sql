create policy competitions_select_anon
on palpite.competitions for select
to anon
using (true);

create policy teams_select_anon
on palpite.teams for select
to anon
using (true);

create policy matches_select_anon
on palpite.matches for select
to anon
using (true);

create policy standings_select_anon
on palpite.standings for select
to anon
using (true);
