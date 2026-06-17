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

A fonte atual para os jogos da Copa 2026 e a football-data.org:

```bash
FOOTBALL_DATA_API_KEY='sua-chave' FOOTBALL_DATA_SEASON=2026 \
  node scripts/import-worldcup-football-data-org.mjs > /tmp/palpite_worldcup_2026_import.sql

npx supabase db query --linked --file /tmp/palpite_worldcup_2026_import.sql
```

O script importa os jogos e calcula a classificacao dos grupos no banco.

Para economizar requests, a UI nunca consulta a football-data.org. Ela busca o estado inicial no Supabase e recebe atualizacoes via Realtime.

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
