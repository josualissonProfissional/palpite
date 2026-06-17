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

## Economia de Requests

- A UI nao chama API de futebol.
- A sincronizacao externa roda no backend/script e grava no Supabase.
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
