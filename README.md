# Palpite

Backend inicial do app de palpites da Copa.

## Stack Atual

- Supabase Auth
- Supabase Postgres
- Row Level Security
- Edge Functions
- Supabase Realtime para jogos, classificacao, grupos, palpites e pontuacao ao vivo

Projeto Supabase oficial:

```txt
https://zhlpxcdvsbfvjhmospbx.supabase.co
```

## Estrutura

```txt
supabase/migrations/   schema, funcoes e RLS
supabase/functions/    Edge Functions internas
docs/                  documentacao viva do projeto
bin/                   utilitarios locais, incluindo MCP
```

Guia de telas do frontend:

```txt
docs/frontend-screens.md
```

## Edge Functions Publicadas

- `create-group`: cria grupo, owner, regras padrao e convite inicial.
- `create-invite`: cria convite para owner/admin.
- `join-group`: entra em um grupo por codigo.
- `save-prediction`: cria/atualiza palpite antes do bloqueio.
- `get-ranking`: consulta ranking do grupo.
- `sync-matches`: sincronizacao interna de jogos.
- `recalculate-scores`: recalculo interno de pontuacao.

## Tempo Real

As tabelas centrais estao publicadas no `supabase_realtime`:

- `matches`
- `standings`
- `groups`
- `group_members`
- `scoring_rules`
- `predictions`
- `prediction_scores`

Quando um jogo recebe placar parcial ou final, o banco recalcula `prediction_scores` automaticamente. A UI deve escutar `matches`, `prediction_scores` e `standings` para mostrar placar, feedback do palpite, ranking e classificacao ao vivo.

## Validacao Local

```bash
npx supabase start
npx supabase db reset --local
npx supabase db lint --local
npx supabase db advisors --local
npx deno check --config supabase/functions/sync-matches/deno.json supabase/functions/sync-matches/index.ts
npx deno check --config supabase/functions/recalculate-scores/deno.json supabase/functions/recalculate-scores/index.ts
```

## Importacao Copa 2026

As fontes externas sao usadas pelo backend; a interface nunca as acessa diretamente.

| Fonte | Responsabilidade na Copa 2026 | Situacao |
| --- | --- | --- |
| [football-data.org](https://www.football-data.org/) | Calendario, placares, status ao vivo, elenco dos times e base para calcular a classificacao dos grupos. | Fonte principal. |
| [API-Football / API-Sports](https://www.api-football.com/) | Escalacoes (titulares e banco) de jogos finalizados quando a football-data.org nao disponibiliza as escalacoes da Copa. Tambem pode ser usada como contingencia de placar/status. | Integracao disponivel, atualmente em standby para a Copa 2026. |
| [WorldCup26](https://worldcup26.ir/) | Contingencia de placar e status para partidas ja iniciadas que ainda estejam pendentes no banco, inclusive encerramento. | Usada somente quando houver resposta valida; nao importa eventos individuais de gol. |

A `football-data.org` e a fonte atual para os jogos da Copa 2026:

```bash
FOOTBALL_DATA_API_KEY='sua-chave' FOOTBALL_DATA_SEASON=2026 \
  node scripts/import-worldcup-football-data-org.mjs > /tmp/palpite_worldcup_2026_import.sql

npx supabase db query --linked --file /tmp/palpite_worldcup_2026_import.sql
```

O script importa os jogos e calcula a classificacao dos grupos no banco. Embora a sincronizacao ao vivo solicite escalações a `football-data.org`, a cobertura da Copa nao as disponibiliza; por isso, as escalações devem vir da API-Football.

Para ativar a importacao alternativa de escalacoes, configure `FOOTBALL_API_KEY` e deixe `API_SPORTS_STANDBY` diferente de `true`. A sincronizacao consulta `fixtures/lineups` somente para jogos finalizados que ainda nao tenham titulares suficientes registrados.

Para economizar requests, a UI busca o estado inicial no Supabase e recebe atualizacoes via Realtime.

## MCP Supabase do Projeto

O MCP registrado para este repo chama:

```txt
bin/supabase-mcp-palpite
```

Ele trava o projeto `zhlpxcdvsbfvjhmospbx` e se recusa a rodar fora de `/home/josue/palpite`.

Configure um Supabase Personal Access Token localmente:

```bash
mkdir -p ~/.config/palpite
chmod 700 ~/.config/palpite
printf '%s' 'SEU_SUPABASE_PAT' > ~/.config/palpite/supabase_access_token
chmod 600 ~/.config/palpite/supabase_access_token
```

Nao use `service_role`, `sb_secret`, `anon` ou publishable key como token do MCP.
