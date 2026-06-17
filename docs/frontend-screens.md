# Telas do Frontend

Este documento define as telas que o frontend precisa implementar para consumir o backend Supabase do Palpite.

## Regra de Requests

O frontend nao deve consultar API externa de futebol.

Fluxo correto:

```txt
football-data.org -> sync backend/script -> Supabase Postgres -> Supabase Realtime -> UI
```

Na UI:

- Buscar dados iniciais uma vez por tela.
- Usar Supabase Realtime para atualizacoes ao vivo.
- Evitar polling por usuario.
- Nao chamar `sync-matches` pelo cliente.
- Nao expor `service_role`, `sb_secret` ou chaves de API de futebol.

## Auth

Objetivo: criar conta, entrar e recuperar sessao.

Usar Supabase Auth diretamente:

- `signUp`
- `signInWithPassword`
- `signOut`
- `getUser`

Tabelas relacionadas:

- `palpite.profiles`

Comportamento:

- Ao criar usuario, o trigger `on_auth_user_created` cria `profiles`.
- Usuario sem sessao nao pode criar grupo, entrar em grupo ou salvar palpite.

## Home / Selecionar Grupo

Objetivo: mostrar grupos do usuario e permitir entrar no bolao.

Leitura:

- `palpite.groups`
- `palpite.group_members`
- `palpite.competitions`

Realtime:

- `groups`
- `group_members`

Estados:

- Sem grupo: mostrar CTA para criar grupo ou entrar por convite.
- Com grupo: abrir dashboard do grupo ativo.

## Criar Grupo

Objetivo: criar bolao, owner, regras padrao e convite inicial.

Endpoint:

```txt
POST /functions/v1/create-group
```

Body:

```json
{
  "name": "Familia da Copa",
  "slug": "familia-da-copa",
  "description": "Bolao da familia",
  "competition_id": "uuid opcional"
}
```

Resposta:

```json
{
  "group": {
    "id": "uuid",
    "name": "Familia da Copa",
    "slug": "familia-da-copa",
    "invite_code": "PAL-ABC123"
  }
}
```

## Entrar por Convite

Objetivo: entrar em grupo existente.

Endpoint:

```txt
POST /functions/v1/join-group
```

Body:

```json
{
  "code": "PAL-ABC123"
}
```

Realtime:

- `group_members`

## Convites

Objetivo: owner/admin gerar links ou codigos de convite.

Endpoint:

```txt
POST /functions/v1/create-invite
```

Body:

```json
{
  "group_id": "uuid",
  "role": "member",
  "max_uses": 20,
  "expires_at": "2026-06-30T23:59:59Z"
}
```

Tabelas:

- `palpite.group_invites`

## Dashboard do Grupo

Objetivo: resumo do bolao.

Leitura inicial:

- `palpite.groups`
- `palpite.group_members`
- `palpite.scoring_rules`
- `palpite.matches`
- `palpite.predictions`
- `palpite.prediction_scores`

Realtime:

- `matches`
- `predictions`
- `prediction_scores`
- `group_members`
- `scoring_rules`

Cards sugeridos:

- Proximo jogo com palpite aberto.
- Jogos ao vivo.
- Posicao do usuario no ranking.
- Palpites pendentes.
- Membros ativos.

## Jogos / Palpites

Objetivo: listar jogos e permitir palpite apenas quando aberto.

Leitura:

- `palpite.matches`
- `palpite.teams`
- `palpite.predictions`
- `palpite.prediction_scores`

Salvar palpite:

```txt
POST /functions/v1/save-prediction
```

Body:

```json
{
  "group_id": "uuid",
  "match_id": "uuid",
  "predicted_home_score": 2,
  "predicted_away_score": 1
}
```

Regras de UI:

- `match.status = finished`: mostrar placar final e desabilitar palpite.
- `match.status = live` ou `halftime`: desabilitar palpite e mostrar feedback parcial.
- `match.status = scheduled`: permitir palpite somente antes do bloqueio.
- Se backend retornar `423`, mostrar "Palpite bloqueado para este jogo".

Regra de jogos passados:

- Jogos ja finalizados ficam preenchidos com placar.
- Usuario nao consegue enviar palpite.
- Jogos anteriores à criacao do grupo nao entram na pontuacao daquele grupo.

## Jogo Ao Vivo

Objetivo: mostrar placar ao vivo e feedback do palpite do usuario.

Leitura:

- `palpite.matches`
- `palpite.predictions`
- `palpite.prediction_scores`

Realtime:

- `matches` filtrado por `id`
- `prediction_scores` filtrado por `group_id` e `user_id`

Campos importantes em `prediction_scores`:

- `points`
- `status`
- `score_reason`
- `is_final`
- `calculated_at`

Estados de feedback:

- `is_final = false` e `status = correct`: acertando placar agora.
- `is_final = false` e `status = partial`: acertando parcialmente agora.
- `is_final = false` e `status = wrong`: errando por enquanto.
- `is_final = false` e `status = inverse_penalty`: placar contrario no momento.
- `is_final = true`: pontuacao definitiva.

## Ranking

Objetivo: ranking do grupo com filtros.

Endpoint:

```txt
GET /functions/v1/get-ranking?group_id=uuid
```

ou:

```txt
POST /functions/v1/get-ranking
```

Body:

```json
{
  "group_id": "uuid",
  "round_name": "Matchday 1",
  "match_date": "2026-06-17",
  "stage": "group_stage",
  "from": "2026-06-11",
  "to": "2026-06-20"
}
```

Realtime:

- Escutar `prediction_scores`.
- Ao receber evento, atualizar a lista local ou chamar `get-ranking` novamente com debounce.

Economia:

- Nao chamar ranking a cada segundo.
- Usar debounce de 300-1000 ms quando varios eventos chegarem juntos.

## Classificacao da Copa

Objetivo: mostrar tabela de grupos da Copa.

Leitura:

- `palpite.standings`
- `palpite.teams`
- `palpite.competitions`

Realtime:

- `standings`

Observacao:

- A classificacao da Copa 2026 e calculada no backend a partir dos jogos finalizados importados da football-data.org.

## Configuracoes de Pontuacao

Objetivo: owner/admin configurar regra do grupo.

Tabela:

- `palpite.scoring_rules`

Campos:

- `exact_score_points`
- `correct_winner_points`
- `correct_draw_points`
- `correct_goal_home_points`
- `correct_goal_away_points`
- `wrong_prediction_points`
- `inverse_score_policy`
- `inverse_score_penalty`
- `allow_negative_score`
- `lock_prediction_minutes_before`
- `show_predictions_before_lock`
- `show_predictions_after_lock`

Realtime:

- `scoring_rules`

Permissao:

- Apenas `owner` e `admin` podem alterar.
- Membros podem visualizar.

## Membros do Grupo

Objetivo: listar participantes e status.

Tabelas:

- `palpite.group_members`
- `palpite.profiles`

Realtime:

- `group_members`

Permissoes:

- Membro ativo ve participantes do mesmo grupo.
- Owner/admin gerencia status e cargo.

## Canais Realtime Sugeridos

Canal global da Copa:

```ts
supabase
  .channel("worldcup-2026")
  .on("postgres_changes", { event: "*", schema: "palpite", table: "matches" }, handler)
  .on("postgres_changes", { event: "*", schema: "palpite", table: "standings" }, handler)
  .subscribe();
```

Canal do grupo:

```ts
supabase
  .channel(`group:${groupId}`)
  .on("postgres_changes", { event: "*", schema: "palpite", table: "predictions", filter: `group_id=eq.${groupId}` }, handler)
  .on("postgres_changes", { event: "*", schema: "palpite", table: "prediction_scores", filter: `group_id=eq.${groupId}` }, handler)
  .on("postgres_changes", { event: "*", schema: "palpite", table: "group_members", filter: `group_id=eq.${groupId}` }, handler)
  .on("postgres_changes", { event: "*", schema: "palpite", table: "scoring_rules", filter: `group_id=eq.${groupId}` }, handler)
  .subscribe();
```

Limpeza:

```ts
supabase.removeChannel(channel);
```

## Checklist de UX

- Mostrar loading skeleton na primeira carga.
- Mostrar estado offline/reconectando no Realtime.
- Desabilitar botao de salvar para jogos bloqueados.
- Exibir resposta `423` como "Palpite bloqueado".
- Exibir jogos passados com placar final.
- Nao mostrar campo de palpite em jogo finalizado.
- Nao recalcular ranking no frontend; usar backend.
