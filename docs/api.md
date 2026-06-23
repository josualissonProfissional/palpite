# API e Edge Functions

## Edge Functions

### `create-group`

Cria um grupo, o membro owner, as regras padrao e um convite inicial.

Requer usuario autenticado.

```json
{
  "name": "Familia",
  "slug": "familia",
  "description": "Bolao da familia",
  "competition_id": "uuid opcional"
}
```

### `create-invite`

Cria um convite para um grupo. Apenas `owner` e `admin`.

```json
{
  "group_id": "uuid",
  "role": "member",
  "max_uses": 20,
  "expires_at": "2026-06-30T23:59:59Z"
}
```

### `join-group`

Entra em um grupo por codigo de convite.

```json
{
  "code": "PAL-ABC123"
}
```

### `save-prediction`

Cria ou atualiza o palpite do usuario autenticado antes do horario de bloqueio.

```json
{
  "group_id": "uuid",
  "match_id": "uuid",
  "predicted_home_score": 2,
  "predicted_away_score": 1
}
```

### `get-ranking`

Retorna o ranking do grupo. Requer usuario autenticado e membro ativo.

Pode ser chamado por `GET` com query string ou `POST` com JSON:

```json
{
  "group_id": "uuid",
  "round_name": "Rodada 1",
  "match_date": "2026-06-15",
  "stage": "group_stage",
  "from": "2026-06-11",
  "to": "2026-06-20"
}
```

### `sync-matches`

Atualiza jogos globais no banco.

Entrada aceita:

```json
{
  "competition_id": "uuid",
  "fixtures": []
}
```

Se `fixtures` nao for enviado, a funcao tenta buscar na API-Football usando:

- `FOOTBALL_API_KEY`
- `FOOTBALL_API_LEAGUE_ID`
- `FOOTBALL_API_SEASON`

Para a Copa 2026, a fonte de importacao atual e a football-data.org via script:

```bash
FOOTBALL_DATA_API_KEY='chave-da-football-data-org' FOOTBALL_DATA_SEASON=2026 \
  node scripts/import-worldcup-football-data-org.mjs > /tmp/palpite_worldcup_2026_import.sql
```

Esse script importa partidas e recalcula a classificacao por grupo antes de gerar o SQL.

### `sync-live`

Atualiza os dados operacionais dos jogos no banco. E uma funcao interna e requer o header `x-internal-secret`.

#### Fontes de dados da Copa 2026

| Fonte | Dados consumidos | Observacao |
| --- | --- | --- |
| football-data.org | Jogos, horario, status, placar, elencos e classificacao calculada a partir dos resultados. | E a fonte principal. A sincronizacao pede os campos de escalação, mas a cobertura da Copa nao os fornece. |
| API-Football / API-Sports | Titulares e banco pelo endpoint `GET /fixtures/lineups`; contingencia de placar e status. | Usada para preencher escalacoes de jogos finalizados sem titulares registrados. Esta em standby enquanto `API_SPORTS_STANDBY=true`. |
| API-Football / API-Sports | Elenco atual e foto oficial do jogador pelo endpoint `GET /players/squads?team={id}`. | Importacao interna, paginada por selecao e limitada a 90 requisicoes por dia. |
| WorldCup26 | Contingencia de placar e status de partidas ja iniciadas que ainda estejam pendentes. | Atualiza tambem o resultado final quando a resposta traz placar valido, inclusive se a fonte principal falhar. Nao importa eventos individuais de gol. |

Nenhuma dessas APIs e chamada pelo frontend. A funcao grava os dados no Supabase, que os entrega a interface via Realtime.

Para habilitar a importacao de escalacoes pela API-Football, sao necessarios `FOOTBALL_API_KEY`, `FOOTBALL_API_LEAGUE_ID` e `FOOTBALL_API_SEASON`, alem de remover ou definir `API_SPORTS_STANDBY` como diferente de `true`.

### `recalculate-scores`

Recalcula a pontuacao de um jogo.

```json
{
  "match_id": "uuid",
  "group_id": "uuid opcional"
}
```

Normalmente nao precisa ser chamado pela UI. O banco recalcula automaticamente quando o placar/status do jogo muda em `matches`.

## Realtime/WebSocket

O frontend deve assinar o schema `palpite` via Supabase Realtime.

Tabelas principais:

- `matches`: placar, status e tempo do jogo.
- `standings`: classificacao dos grupos.
- `predictions`: palpites criados/alterados antes do bloqueio.
- `prediction_scores`: feedback parcial/final e ranking.
- `groups`, `group_members`, `scoring_rules`: mudancas de grupo e configuracao.

Feedback ao vivo:

- `prediction_scores.is_final = false`: jogo em andamento; mensagem parcial.
- `prediction_scores.is_final = true`: jogo finalizado; pontuacao definitiva.
- `prediction_scores.status`: `correct`, `partial`, `wrong` ou `inverse_penalty`.
- `prediction_scores.score_reason`: texto pronto para explicar o estado ao usuario.
- O placar sincronizado pode diminuir quando o provedor corrige um gol anulado pelo VAR; a resposta mais recente substitui o valor anterior.

## Economia de Requests

- A UI nao chama API de futebol.
- A sincronizacao externa roda no backend/script e grava no Supabase.
- A API-Football so consulta escalacoes pendentes de jogos finalizados e respeita um intervalo minimo entre tentativas.
- A WorldCup26 reconcilia partidas passadas ainda marcadas como agendadas, ao vivo ou no intervalo; partidas ja finalizadas no banco nao sao sobrescritas.
- A classificacao e calculada localmente a partir dos jogos importados.
- O frontend busca dados iniciais uma vez e depois usa Realtime.
- Ranking deve ser recarregado com debounce quando `prediction_scores` mudar.

## Jogos Passados

- Jogos finalizados ficam com placar preenchido em `matches`.
- `save-prediction` bloqueia qualquer palpite depois do horario de bloqueio.
- A regra de banco tambem bloqueia jogos com `status <> scheduled`.
- Jogos com `match_date < groups.created_at` nao entram no ranking daquele grupo.

## Protecao Interna

As Edge Functions internas `sync-matches` e `recalculate-scores` exigem o header:

```txt
x-internal-secret: valor-de-INTERNAL_FUNCTION_SECRET
```
