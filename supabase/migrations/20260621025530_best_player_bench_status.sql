alter table palpite.match_player_appearances
  add column bench boolean not null default false;

alter table palpite.match_player_appearances
  drop constraint match_player_participated_check;

alter table palpite.match_player_appearances
  add constraint match_player_participated_check check (started or bench or entered);
