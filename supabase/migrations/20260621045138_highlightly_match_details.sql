alter table palpite.matches
  add column highlightly_match_id bigint unique,
  add column highlightly_imported_at timestamptz,
  add column highlightly_last_attempt_at timestamptz,
  add column highlightly_import_attempts integer not null default 0;

alter table palpite.players
  add column highlightly_player_id bigint unique;

alter table palpite.match_events
  add column highlightly_event_key text unique,
  add column assist_player_name text,
  add column substituted_player_name text;

create index matches_highlightly_pending_idx
  on palpite.matches (status, match_date)
  where highlightly_imported_at is null;
