-- Reseta janelas diarias que foram finalizadas com dados incompletos
-- (antes do ajuste do match_day) para que sejam reprocessadas corretamente.
-- Remove resultados e cedulas antigas, e volta o status para 'scheduled'.
delete from palpite.best_player_results
where window_id in (
  select id from palpite.best_player_voting_windows
  where kind = 'daily' and status in ('finalized', 'closed')
);

delete from palpite.best_player_scores
where window_id in (
  select id from palpite.best_player_voting_windows
  where kind = 'daily' and status in ('finalized', 'closed')
);

update palpite.best_player_voting_windows
set status = 'scheduled',
    opened_at = null,
    closes_at = null,
    finalized_at = null,
    result_formation = null,
    eligibility_source = null
where kind = 'daily' and status in ('finalized', 'closed');
