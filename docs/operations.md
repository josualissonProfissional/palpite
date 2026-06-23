# Operacao

## Configurar MCP Local

Crie um Supabase Personal Access Token no dashboard e salve localmente:

```bash
mkdir -p ~/.config/palpite
chmod 700 ~/.config/palpite
printf '%s' 'SEU_SUPABASE_PAT' > ~/.config/palpite/supabase_access_token
chmod 600 ~/.config/palpite/supabase_access_token
```

O wrapper local fica em:

```txt
bin/supabase-mcp-palpite
```

Ele fixa o projeto `zhlpxcdvsbfvjhmospbx` e falha fora deste repo.

## Migrations

Rodar localmente:

```bash
npx supabase start
npx supabase db reset
```

Aplicar no remoto somente depois de revisar:

```bash
npx supabase link --project-ref zhlpxcdvsbfvjhmospbx
npx supabase db push
```

## Edge Functions

Secrets necessarios:

```bash
npx supabase secrets set INTERNAL_FUNCTION_SECRET='valor-longo'
npx supabase secrets set FOOTBALL_API_KEY='chave-da-api'
npx supabase secrets set FOOTBALL_API_LEAGUE_ID='id-da-competicao'
npx supabase secrets set FOOTBALL_API_SEASON='2026'
npx supabase secrets set API_SPORTS_PLAYER_SYNC_ENABLED='true'
npx supabase secrets set FOOTBALL_DATA_API_KEY='chave-da-football-data-org'
npx supabase secrets set FOOTBALL_DATA_COMPETITION='WC'
npx supabase secrets set FOOTBALL_DATA_SEASON='2026'
```

Responsabilidades das fontes externas:

| Fonte | Uso |
| --- | --- |
| football-data.org | Fonte principal de calendario, placares, status e elencos; tambem alimenta o calculo local da classificacao. |
| API-Football / API-Sports | Escalacoes de titulares e banco quando a football-data.org nao as disponibiliza para a Copa; contingencia de placar/status. |
| WorldCup26 | Contingencia de placar, status e resultado final para partidas pendentes. Nao fornece eventos individuais ao projeto. |

A API-Football usa `FOOTBALL_API_KEY`, `FOOTBALL_API_LEAGUE_ID` e `FOOTBALL_API_SEASON`. Para permitir a importacao de escalacoes, nao configure `API_SPORTS_STANDBY=true`. Quando habilitada, ela consulta apenas jogos finalizados que ainda nao tenham titulares importados.

## Fotos dos jogadores

Com `API_SPORTS_PLAYER_SYNC_ENABLED=true`, a sincronizacao importa o elenco atual de cada selecao da Copa pela API-Football e grava a URL oficial da foto no banco. O processo usa no maximo 90 requisicoes por dia e avanca em pequenos lotes para respeitar o plano gratuito.

Fonte atual recomendada para Copa 2026:

```bash
FOOTBALL_DATA_API_KEY='chave-da-football-data-org' FOOTBALL_DATA_SEASON=2026 \
  node scripts/import-worldcup-football-data-org.mjs > /tmp/palpite_worldcup_2026_import.sql

npx supabase db query --linked --file /tmp/palpite_worldcup_2026_import.sql
```

O importador da football-data.org busca os 104 jogos da Copa 2026 e calcula a classificacao por grupo a partir dos jogos finalizados, porque o endpoint de standings retorna um ranking geral. A cobertura da Copa nao fornece as escalacoes necessarias, portanto elas sao preenchidas pela API-Football quando essa integracao estiver habilitada.

Deploy:

```bash
npx supabase functions deploy --project-ref zhlpxcdvsbfvjhmospbx --use-api
```

Funcoes atuais:

```txt
create-group
create-invite
join-group
save-prediction
get-ranking
sync-matches
recalculate-scores
```
