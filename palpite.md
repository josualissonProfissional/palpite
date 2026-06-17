# LOUSA ATUALIZADA — App de Palpites da Copa com Turso, Multi-Tenant, WebSocket e Login

> Atualizacao de arquitetura: o projeto migrou a decisao inicial de Turso para Supabase.
> O backend/banco inicial agora esta implementado com Supabase Auth, Postgres, RLS,
> Edge Functions e schema isolado `palpite`. A documentacao viva fica em `docs/`.

## 1. Visão geral do projeto

O projeto será um site/app de palpites da Copa para vários grupos de amigos.

Cada usuário poderá:

* criar conta;
* criar um grupo de amigos;
* entrar em grupos por convite;
* configurar regras de pontuação por grupo;
* palpitar nos jogos;
* acompanhar jogos ao vivo;
* ver tabela da Copa;
* ver mata-mata até a final;
* ver estatísticas dos jogos;
* ver se está acertando ou errando durante o jogo;
* acompanhar ranking geral;
* filtrar ranking por rodada, dia, fase ou período.

---

# 2. Stack recomendada com Turso

## Stack principal

```txt
Frontend:
- Next.js
- React
- Tailwind
- Shadcn UI

Banco:
- Turso Database / libSQL / SQLite

ORM:
- Drizzle ORM

Login:
- Clerk
ou
- Auth.js / Better Auth

WebSocket:
- Socket.IO
ou
- Pusher
ou
- Ably
ou
- servidor WebSocket próprio

Cron:
- Vercel Cron
ou
- GitHub Actions
ou
- Render Cron Job
ou
- Supabase Edge Function apenas para cron, se desejar

API de futebol:
- API-Football / API-Sports
```

## Decisão principal

Para o MVP, usar:

```txt
Turso com banco único
+
group_id em todas as tabelas do bolão
+
dados globais da Copa compartilhados
+
backend protegendo acesso aos dados
```

---

# 3. Estratégia multi-tenant

## O que é tenant nesse projeto?

Cada grupo de amigos será um tenant.

Exemplos:

```txt
Grupo 1: Família
Grupo 2: Amigos da igreja
Grupo 3: Trabalho
Grupo 4: Bolão dos primos
```

Um mesmo usuário pode participar de vários grupos:

```txt
Usuário Josué
 ├── Grupo Família
 ├── Grupo Amigos da Igreja
 └── Grupo Trabalho
```

## Estratégia recomendada para o MVP

Usar **um único banco Turso** com separação por `group_id`.

```txt
turso_database
 ├── users
 ├── groups
 ├── group_members
 ├── scoring_rules
 ├── predictions
 ├── prediction_scores
 ├── matches
 ├── teams
 ├── standings
 ├── match_statistics
 └── events
```

## Por que não começar com um banco por grupo?

Porque os dados da Copa são globais.

Exemplo:

```txt
Brasil x Alemanha
Argentina x França
Tabela do Grupo A
Mata-mata
Estatísticas oficiais
```

Esses dados são iguais para todos os grupos.

Se cada grupo tivesse um banco separado desde o início, você poderia acabar duplicando muitos dados.

## Estratégia futura se crescer muito

Depois, se virar um produto maior, dá para evoluir para:

```txt
Banco global:
- competitions
- teams
- matches
- standings
- match_statistics
- events

Banco por grupo:
- group_members
- scoring_rules
- predictions
- prediction_scores
- leaderboard
```

Mas para começar, a melhor escolha é:

```txt
1 banco Turso
+
group_id
+
validação no backend
```

---

# 4. Login proposto

## Melhor opção para MVP

Usar Clerk.

Motivos:

```txt
- fácil de integrar com Next.js;
- login com e-mail e senha;
- login com Google;
- gerenciamento de sessão pronto;
- JWT para validar usuário no backend;
- boa integração com apps modernos.
```

## Alternativas

```txt
Auth.js:
- mais flexível;
- mais controle;
- exige mais configuração.

Better Auth:
- boa opção moderna;
- interessante se quiser mais controle no próprio backend.

Auth0:
- robusto;
- pode ser exagerado para MVP pequeno.
```

## Fluxo de login

```txt
1. Usuário acessa o app.
2. Faz login com e-mail/senha ou Google.
3. Frontend recebe sessão/token.
4. Frontend chama sua API.
5. Backend valida o usuário.
6. Backend consulta Turso.
7. Backend retorna apenas dados permitidos.
```

## Importante

Com Turso, eu não deixaria o frontend acessar dados sensíveis diretamente.

Fluxo recomendado:

```txt
Frontend
  ↓
Backend/API Routes
  ↓
Valida usuário e permissões
  ↓
Turso
```

---

# 5. Modelo de permissões

## Regras

```txt
- Usuário só vê grupos onde é membro.
- Usuário só cria palpite em grupo onde é membro.
- Usuário só edita regras se for owner/admin.
- Usuário só vê ranking do grupo onde participa.
- Usuário não pode editar palpite depois do horário de bloqueio.
```

## Tabela group_members

```txt
id
group_id
user_id
role
status
joined_at
```

## Roles

```txt
owner
admin
member
```

## Status

```txt
active
pending
blocked
left
```

## Validação no backend

Antes de qualquer operação sensível, verificar:

```txt
Esse usuário pertence a esse grupo?
Esse usuário está ativo?
Esse usuário tem permissão para essa ação?
```

Exemplo conceitual:

```ts
async function ensureGroupMember(userId: string, groupId: string) {
  const member = await db.execute({
    sql: `
      SELECT id
      FROM group_members
      WHERE user_id = ?
      AND group_id = ?
      AND status = 'active'
    `,
    args: [userId, groupId],
  });

  if (member.rows.length === 0) {
    throw new Error("Usuário não pertence a este grupo");
  }
}
```

---

# 6. Banco de dados — tabelas principais

## users

```txt
id
auth_provider_id
name
email
nickname
avatar_url
created_at
updated_at
```

## groups

```txt
id
name
slug
description
created_by
competition_id
is_private
invite_code
created_at
updated_at
```

## group_members

```txt
id
group_id
user_id
role
status
joined_at
```

## scoring_rules

```txt
id
group_id
exact_score_points
correct_winner_points
correct_draw_points
correct_goal_home_points
correct_goal_away_points
wrong_prediction_points
inverse_score_policy
inverse_score_penalty
allow_negative_score
lock_prediction_minutes_before
show_predictions_before_lock
show_predictions_after_lock
created_at
updated_at
```

## competitions

```txt
id
name
season
api_league_id
api_season
start_date
end_date
```

## teams

```txt
id
api_team_id
name
country
logo_url
created_at
updated_at
```

## matches

```txt
id
api_fixture_id
competition_id
home_team_id
away_team_id
group_name
round_name
stage
match_date
status
elapsed
home_score
away_score
winner_team_id
last_synced_at
created_at
updated_at
```

## predictions

```txt
id
group_id
user_id
match_id
predicted_home_score
predicted_away_score
locked_at
created_at
updated_at
```

## prediction_scores

```txt
id
prediction_id
group_id
user_id
match_id
points
status
score_reason
calculated_at
```

## match_statistics

```txt
id
match_id
possession_home
possession_away
shots_home
shots_away
shots_on_goal_home
shots_on_goal_away
corners_home
corners_away
yellow_cards_home
yellow_cards_away
red_cards_home
red_cards_away
synced_at
```

## events

```txt
id
match_id
team_id
player_name
event_type
minute
extra_minute
description
created_at
```

---

# 7. Regras de pontuação configuráveis

Cada grupo poderá configurar suas próprias regras.

## Regras possíveis

```txt
Placar exato:
- Exemplo: +5 pontos

Acertou vencedor:
- Exemplo: +3 pontos

Acertou empate:
- Exemplo: +3 pontos

Acertou gols do time da casa:
- Exemplo: +1 ponto

Acertou gols do visitante:
- Exemplo: +1 ponto

Errou tudo:
- Exemplo: 0 pontos ou -1 ponto

Placar contrário:
- Exemplo:
  Palpite: Brasil 2 x 1 Argentina
  Resultado: Brasil 1 x 2 Argentina

Pode configurar:
- não pontua;
- perde ponto;
- zera;
- aplica penalidade específica.
```

## Exemplo de configuração

```json
{
  "exact_score_points": 5,
  "correct_winner_points": 3,
  "correct_draw_points": 3,
  "correct_goal_home_points": 1,
  "correct_goal_away_points": 1,
  "wrong_prediction_points": 0,
  "inverse_score_policy": "penalty",
  "inverse_score_penalty": -1,
  "allow_negative_score": true,
  "lock_prediction_minutes_before": 10,
  "show_predictions_before_lock": false,
  "show_predictions_after_lock": true
}
```

---

# 8. Função de cálculo de pontos

```ts
type ScoringRules = {
  exactScorePoints: number;
  correctWinnerPoints: number;
  correctDrawPoints: number;
  correctGoalHomePoints: number;
  correctGoalAwayPoints: number;
  wrongPredictionPoints: number;
  inverseScorePolicy: "no_points" | "penalty" | "zero";
  inverseScorePenalty: number;
  allowNegativeScore: boolean;
};

function calculatePoints(prediction, result, rules: ScoringRules) {
  const predictedHome = prediction.home;
  const predictedAway = prediction.away;

  const resultHome = result.home;
  const resultAway = result.away;

  const exactScore =
    predictedHome === resultHome &&
    predictedAway === resultAway;

  if (exactScore) {
    return {
      points: rules.exactScorePoints,
      status: "correct",
      reason: "Placar exato"
    };
  }

  const predictedDraw = predictedHome === predictedAway;
  const resultDraw = resultHome === resultAway;

  if (predictedDraw && resultDraw) {
    return {
      points: rules.correctDrawPoints,
      status: "partial",
      reason: "Acertou empate"
    };
  }

  const predictedWinner =
    predictedHome > predictedAway ? "home" :
    predictedAway > predictedHome ? "away" :
    "draw";

  const resultWinner =
    resultHome > resultAway ? "home" :
    resultAway > resultHome ? "away" :
    "draw";

  const inverseScore =
    predictedHome === resultAway &&
    predictedAway === resultHome;

  if (inverseScore) {
    if (rules.inverseScorePolicy === "penalty") {
      return {
        points: rules.allowNegativeScore ? rules.inverseScorePenalty : 0,
        status: "inverse_penalty",
        reason: "Placar contrário"
      };
    }

    if (rules.inverseScorePolicy === "zero") {
      return {
        points: 0,
        status: "wrong",
        reason: "Placar contrário zerado"
      };
    }
  }

  if (predictedWinner === resultWinner) {
    let points = rules.correctWinnerPoints;

    if (predictedHome === resultHome) {
      points += rules.correctGoalHomePoints;
    }

    if (predictedAway === resultAway) {
      points += rules.correctGoalAwayPoints;
    }

    return {
      points,
      status: "partial",
      reason: "Acertou o vencedor"
    };
  }

  const wrongPoints = rules.allowNegativeScore
    ? rules.wrongPredictionPoints
    : Math.max(0, rules.wrongPredictionPoints);

  return {
    points: wrongPoints,
    status: "wrong",
    reason: "Errou o palpite"
  };
}
```

---

# 9. WebSocket com Turso

## Ideia principal

Turso será o banco.

O WebSocket ficará fora do Turso.

Fluxo:

```txt
API-Football
    ↓
Cron/Worker
    ↓
Atualiza Turso
    ↓
Backend recalcula pontuação
    ↓
Backend emite evento via WebSocket
    ↓
Usuários recebem atualização
```

## Eventos WebSocket

```txt
match.updated
prediction.updated
score.updated
leaderboard.updated
standings.updated
bracket.updated
statistics.updated
```

## Canais

```txt
group:{group_id}:matches
group:{group_id}:leaderboard
group:{group_id}:predictions
global:worldcup:matches
```

## Exemplo de payload

```json
{
  "event": "leaderboard.updated",
  "group_id": "grupo_123",
  "data": {
    "user_id": "user_456",
    "total_points": 32,
    "position": 1
  }
}
```

## Importante

WebSocket não deve buscar dados na API-Football.

O papel do WebSocket é apenas distribuir para os usuários as mudanças que já aconteceram no seu sistema.

---

# 10. Cron e economia de requests

## Cron global

A sincronização da Copa deve ser global, não por grupo.

Errado:

```txt
Grupo A busca placar
Grupo B busca placar
Grupo C busca placar
```

Certo:

```txt
Cron global busca placar uma vez
Salva no Turso
Todos os grupos usam o mesmo dado
```

## Durante o jogo

```txt
Buscar /fixtures?live=all a cada 3–5 minutos
Salvar placar e status
Recalcular pontuação parcial
Emitir evento WebSocket
```

## Depois do jogo

```txt
Buscar estatísticas da partida
Buscar eventos
Salvar resultado final
Calcular pontuação final
Atualizar ranking
Emitir leaderboard.updated
```

## Final do dia

```txt
Confirmar resultados finais
Atualizar standings
Atualizar mata-mata
Consolidar estatísticas
```

---

# 11. Ranking e filtros

## Ranking geral

```txt
/group/:id/ranking
```

Mostra:

```txt
posição
usuário
pontos totais
placares exatos
vencedores acertados
empates acertados
erros
penalidades
jogos palpitados
```

## Filtro por rodada

```txt
/group/:id/ranking?round=rodada-1
```

## Filtro por dia

```txt
/group/:id/ranking?date=2026-06-15
```

## Filtro por fase

```txt
/group/:id/ranking?stage=group_stage
/group/:id/ranking?stage=round_of_32
/group/:id/ranking?stage=round_of_16
/group/:id/ranking?stage=quarter_final
/group/:id/ranking?stage=semi_final
/group/:id/ranking?stage=final
```

## Filtro por período

```txt
/group/:id/ranking?from=2026-06-11&to=2026-06-20
```

---

# 12. Status individual do usuário

Em cada jogo, o usuário verá:

```txt
Brasil 2 x 1 Argentina

Seu palpite:
Brasil 2 x 0 Argentina

Status atual:
Você está acertando o vencedor

Pontuação atual:
+3 pontos
```

Se o placar mudar:

```txt
Brasil 2 x 2 Argentina

Status atual:
Você está errando

Pontuação atual:
0 pontos
```

Depois do jogo:

```txt
Resultado final:
Brasil 2 x 1 Argentina

Seu palpite:
Brasil 2 x 1 Argentina

Você acertou o placar exato:
+5 pontos
```

---

# 13. Telas do app

## Login

```txt
- Entrar com e-mail e senha
- Entrar com Google
- Criar conta
- Recuperar senha
```

## Home

```txt
- Meus grupos
- Criar grupo
- Entrar com código de convite
```

## Grupo

```txt
- Ranking do grupo
- Jogos de hoje
- Próximos jogos
- Meus palpites pendentes
- Últimos resultados
```

## Jogo

```txt
- Placar ao vivo
- Status do jogo
- Minuto
- Meu palpite
- Pontuação atual
- Estatísticas
- Eventos
- Palpites dos amigos, se permitido pelo grupo
```

## Palpites

```txt
- Lista de jogos futuros
- Campo para placar da casa
- Campo para placar do visitante
- Salvar palpite
- Editar até X minutos antes do jogo
```

## Ranking

```txt
- Ranking geral
- Filtro por rodada
- Filtro por dia
- Filtro por fase
- Filtro por período
```

## Configurações do grupo

```txt
- Nome do grupo
- Descrição
- Código de convite
- Regras de pontuação
- Bloqueio de palpites
- Mostrar ou ocultar palpites antes do jogo
- Permitir pontuação negativa
- Gerenciar membros
```

---

# 14. Turso: banco único agora, database per tenant depois

## MVP

```txt
1 banco Turso
+
tabelas globais
+
tabelas com group_id
```

## Futuro

Se o projeto crescer:

```txt
Banco global:
- jogos
- times
- placares
- estatísticas

Banco por grupo:
- membros
- palpites
- regras
- ranking
```

## Vantagem futura

Com database per tenant, cada grupo poderia ter isolamento maior.

Mas para agora isso é mais complexo do que necessário.

---

# 15. Possível uso de CDC do Turso no futuro

CDC significa Change Data Capture.

Ele pode registrar mudanças no banco, como:

```txt
insert
update
delete
```

No futuro, isso pode ajudar em:

```txt
- auditoria;
- histórico de alterações;
- sincronização;
- eventos reativos;
- debug de pontuação;
- fila de atualizações para WebSocket.
```

Para o MVP, não precisa começar com CDC.

Melhor começar simples:

```txt
Atualizou jogo → recalculou ranking → emitiu WebSocket
```

---

# 16. MVP recomendado

## Versão 1

```txt
- Login
- Criar grupo
- Entrar por convite
- Configurar regras de pontuação
- Listar jogos
- Criar palpites
- Bloquear palpites antes do jogo
- Calcular pontuação final
- Ranking geral
- Ranking por rodada/dia
```

## Versão 2

```txt
- WebSocket
- Placar ao vivo
- Status "você está acertando"
- Ranking ao vivo
- Filtro por fase/período
```

## Versão 3

```txt
- Estatísticas detalhadas
- Mata-mata visual
- Histórico de desempenho
- Notificações
- Comparativo entre amigos
- Auditoria com CDC
```

---

# 17. Decisão final

A arquitetura recomendada fica:

```txt
Next.js
+
Clerk/Auth.js
+
Turso/libSQL
+
Drizzle ORM
+
Socket.IO/Pusher/Ably
+
Cron global
+
API-Football
```

Resumo:

```txt
- Turso guarda os dados.
- Backend protege os dados.
- Clerk/Auth.js faz login.
- Cron busca os dados da Copa.
- WebSocket entrega atualizações.
- API-Football só é chamada pelo servidor.
- Usuários nunca chamam a API-Football diretamente.
- Grupos são separados por group_id.
- Dados da Copa são globais e reaproveitados por todos.
```
