# Banco de Dados

## Schema

Todas as tabelas do app ficam no schema `palpite`. Funcoes auxiliares sensiveis ficam em `palpite_private`.

## Tabelas Globais

- `competitions`
- `teams`
- `matches`
- `standings`
- `match_statistics`
- `match_events`

Essas tabelas representam dados oficiais da Copa e sao compartilhadas por todos os grupos.

## Tabelas por Grupo

- `groups`
- `group_members`
- `group_invites`
- `scoring_rules`
- `predictions`
- `prediction_scores`

Toda tabela de bolao tem `group_id` e politicas RLS baseadas em membros ativos.

## RPCs

- `palpite.get_group_ranking(...)`: retorna ranking filtrado.
- `palpite.recalculate_match_scores(...)`: recalcula pontuacao final ou parcial; liberada apenas para `service_role`.

## Tempo Real

As seguintes tabelas estao na publicacao `supabase_realtime`:

- `matches`
- `standings`
- `groups`
- `group_members`
- `scoring_rules`
- `predictions`
- `prediction_scores`

Quando `matches.status`, `matches.home_score` ou `matches.away_score` muda, o trigger `recalculate_scores_after_match_change` atualiza `prediction_scores`.

Durante jogo ao vivo, `prediction_scores.is_final = false` e `score_reason` informa se o usuario esta acertando, acertando parcialmente, invertido ou errando naquele momento.

Quando o jogo termina, `prediction_scores.is_final = true` e os pontos entram no ranking definitivo.

## Jogos Passados

Jogos importados com status `finished` ficam visiveis para historico e tabela da Copa, mas nao aceitam palpite.

Para grupos criados depois de jogos ja realizados, o ranking considera apenas jogos com `matches.match_date >= groups.created_at`. Assim, jogos passados nao geram pontuacao retroativa para grupos novos.

## Indices Principais

- `group_members(group_id, user_id)` unico.
- `predictions(group_id, user_id, match_id)` unico.
- `prediction_scores(group_id, user_id, match_id)` unico.
- `matches(competition_id, match_date)`.
- `matches(api_fixture_id)` unico.
