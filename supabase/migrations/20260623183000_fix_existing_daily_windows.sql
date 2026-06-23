-- Reconstroi os links de partidas das janelas diarias usando a nova
-- funcao match_day (subtrai 3h para jogos de madrugada)
delete from palpite.best_player_window_matches
where window_id in (
  select id from palpite.best_player_voting_windows where kind = 'daily'
);
