alter table palpite.players
  add column photo_url text,
  add column photo_source text,
  add column photo_synced_at timestamptz;

alter table palpite.teams
  add column api_sports_players_page integer not null default 1,
  add column api_sports_players_synced_at timestamptz,
  add column api_sports_players_sync_attempts integer not null default 0,
  add column api_sports_players_last_error text,
  add constraint teams_api_sports_players_page_check check (api_sports_players_page > 0);

alter table palpite.players
  drop constraint players_api_sports_player_id_key,
  add constraint players_team_api_sports_player_id_key unique (team_id, api_sports_player_id);

create index players_missing_photo_idx
  on palpite.players (team_id)
  where photo_url is null;

create index teams_api_sports_player_sync_idx
  on palpite.teams (api_sports_players_synced_at, api_sports_players_page)
  where api_sports_team_id is not null;
