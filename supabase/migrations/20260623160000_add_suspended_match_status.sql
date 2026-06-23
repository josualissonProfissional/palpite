-- Add "suspended" to the match_status enum so the sync-live function
-- can represent weather-delayed matches without treating them as cancelled.
alter type palpite.match_status add value if not exists 'suspended';
