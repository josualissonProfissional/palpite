# Planejamento do Frontend - Palpite

## Objetivo

Construir o frontend do Palpite como app real de bolao da Copa, nao como landing page. A primeira tela apos login deve levar o usuario direto para grupos, jogos, palpites e ranking.

O produto precisa parecer um app de competicao entre amigos: rapido para palpitar no celular, claro para comparar ranking e confiavel para regras de pontuacao.

## Fonte Atual do Projeto

Documentos usados como base:

- `README.md`
- `docs/architecture.md`
- `docs/database.md`
- `docs/api.md`
- `docs/security.md`
- `supabase/migrations/20260617045803_palpite_initial_schema.sql`
- `supabase/migrations/20260617045804_palpite_rls_policies.sql`

Decisao atual do backend:

- Supabase Auth
- Supabase Postgres
- Schema `palpite`
- RLS em todas as tabelas do app
- Edge Functions para operacoes internas
- Realtime em fase futura

Observacao importante: `palpite.md` ainda contem a lousa antiga com Turso/Clerk. Para o frontend, a fonte viva deve ser `docs/architecture.md` e as migrations Supabase.

## Stack Frontend

Stack proposta e mantida:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- lucide-react para icones
- React Hook Form + Zod para formularios
- TanStack Table para rankings e tabelas complexas
- Recharts via shadcn Chart para graficos
- `@supabase/supabase-js`
- `@supabase/ssr`

Regra obrigatoria:

- Usar apenas as bibliotecas propostas nesta documentacao.
- Nao adicionar biblioteca nova sem decisao explicita do projeto.
- Nao inventar componente visual do zero quando existir equivalente em shadcn/ui, shadcn Blocks, Magic UI, React Bits ou shadcn.io backgrounds.
- A implementacao deve partir desses componentes/bibliotecas e adaptar ao produto Palpite.
- Componentes proprios so entram como composicao de componentes existentes ou como regra de negocio especifica do app.

Diretriz de uso:

- Buscar dados iniciais em Server Components sempre que possivel.
- Usar Server Actions para mutacoes de formulario simples.
- Usar Client Components apenas onde houver interacao local intensa, Realtime, formularios dinamicos ou componentes controlados.
- Proteger rotas no servidor com `supabase.auth.getClaims()`, nao com sessao client-side.

## MCP e Supabase

O projeto documenta um MCP local:

```txt
bin/supabase-mcp-palpite
Projeto esperado: zhlpxcdvsbfvjhmospbx
```

O MCP disponivel na sessao atual respondeu com outro projeto (`jkkmd...`) e nao listou tabelas do schema `palpite`. Portanto, para este planejamento, a fonte confiavel foi a migration local.

Antes de implementar a integracao real do frontend, corrigir a conexao MCP para o projeto certo e validar:

- `list_tables` no schema `palpite`, com colunas.
- `get_project_url` deve retornar `https://zhlpxcdvsbfvjhmospbx.supabase.co`.
- `get_publishable_keys` deve retornar uma chave publishable ativa.
- `list_edge_functions` deve mostrar as functions depois do deploy.
- `get_advisors` security/performance deve ser revisado antes de producao.

Variaveis esperadas no frontend:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Nunca usar no navegador:

```txt
SUPABASE_SERVICE_ROLE_KEY
sb_secret_*
INTERNAL_FUNCTION_SECRET
Supabase PAT do MCP
```

## Arquitetura de Rotas

### Publicas

- `/entrar`
  - login por email e senha
  - recuperacao de senha em fase posterior

- `/criar-conta`
  - cadastro simples
  - nome/apelido pode ser preenchido no primeiro acesso

- `/convite/[code]`
  - entrada por convite
  - se nao estiver logado, redireciona para login e volta ao convite

### App autenticado

- `/app`
  - painel inicial do usuario
  - grupos ativos
  - proximos jogos
  - palpites pendentes
  - atalhos para ranking e criar grupo

- `/app/grupos`
  - lista de grupos do usuario
  - criar grupo
  - entrar por codigo

- `/app/grupos/[groupSlug]`
  - resumo do grupo
  - ranking compacto
  - proximos jogos
  - atividade recente

- `/app/grupos/[groupSlug]/jogos`
  - calendario de jogos
  - filtros por dia, fase, grupo e status
  - cards de palpite

- `/app/grupos/[groupSlug]/jogos/[matchId]`
  - detalhe do jogo
  - placar ao vivo/final
  - palpite do usuario
  - estatisticas e eventos quando existirem

- `/app/grupos/[groupSlug]/ranking`
  - ranking completo
  - filtros por rodada, dia, fase e periodo
  - usa RPC `palpite.get_group_ranking`

- `/app/grupos/[groupSlug]/regras`
  - leitura para membros
  - edicao para owner/admin

- `/app/grupos/[groupSlug]/membros`
  - membros, cargos e convites
  - acoes administrativas apenas para owner/admin

- `/app/copa`
  - tabela da Copa
  - grupos, classificacao e mata-mata

- `/app/perfil`
  - nome, apelido e avatar

## Layout Base

Usar shadcn Sidebar como base do app.

Estrutura:

- sidebar esquerda em desktop
- bottom navigation compacta no mobile
- topo com seletor de grupo, status de sync e avatar
- conteudo com largura controlada, sem cards dentro de cards

Navegacao principal:

- Inicio
- Meus grupos
- Jogos
- Ranking
- Copa
- Perfil

Navegacao contextual dentro do grupo:

- Resumo
- Jogos
- Ranking
- Regras
- Membros

## Sistema Visual

### Direcao

Visual limpo, esportivo e operacional. O app deve parecer confiavel para acompanhar pontuacao e rapido para uso repetido.

Evitar:

- visual de landing page no painel principal
- excesso de gradientes
- fundo escuro pesado em todas as telas
- animacoes que disputam atencao com jogo/ranking
- emojis como icones

### Paleta

Base recomendada:

```txt
Primary:     #2563EB
Secondary:   #60A5FA
CTA:         #F97316
Background:  #F8FAFC
Surface:     #FFFFFF
Text:        #1E293B
Border:      #E2E8F0
Success:     #16A34A
Warning:     #F59E0B
Danger:      #DC2626
Muted:       #64748B
```

Uso:

- azul para navegacao, links e estados ativos
- laranja para chamadas principais, como "Palpitar"
- verde para acertos, jogos finalizados positivos e sucesso
- vermelho apenas para erro, bloqueio ou alerta
- amarelo/ambar para jogo ao vivo, pendencias e avisos

### Tipografia

Recomendacao da skill UI:

- Heading: Barlow Condensed
- Body: Barlow

Motivo: familia com leitura boa e energia esportiva sem virar visual infantil.

Fallback:

```css
font-family: Barlow, system-ui, sans-serif;
```

### Backgrounds

Background principal do app:

- fundo claro `#F8FAFC`
- padrao sutil de campo/tatica com linhas muito leves
- pequenas marcacoes de grade para dar sensacao de esporte/dados
- nenhum video em autoplay

Background para login/convite:

- composicao com campo abstrato em baixa opacidade
- card de formulario direto
- pode usar um gradiente discreto azul/verde, mas sem dominar a tela

Backgrounds animados permitidos somente em areas pontuais:

- empty state de primeiro grupo
- tela de convite
- tela publica de login

Preferir componentes leves de grid, beam ou aurora suave. Evitar starfield, galaxy, hyperspeed e particulas fortes dentro do app, porque atrapalham ranking e leitura de jogos.

## Componentes Principais

### Auth

- `LoginForm`
- `SignupForm`
- `ForgotPasswordForm` em fase posterior
- `InviteGate`

Estados obrigatorios:

- carregando
- credenciais invalidas
- email ja usado
- convite expirado
- volta automatica ao convite apos login

### App Shell

- `AppSidebar`
- `MobileNav`
- `GroupSwitcher`
- `UserMenu`
- `SyncStatusBadge`
- `PageHeader`
- `FilterBar`

### Grupos

- `GroupCard`
- `CreateGroupDialog`
- `JoinGroupDialog`
- `InviteCodeCard`
- `MemberRoleBadge`
- `MemberTable`

### Jogos e Palpites

- `MatchCard`
- `MatchStatusBadge`
- `PredictionStepper`
- `PredictionLockBadge`
- `LiveScorePill`
- `MatchTimeline`
- `MatchStatsGrid`

Regra de UX para palpite:

- placar deve usar steppers/botoes grandes, nao input pequeno comum
- no mobile, cada seletor de gols precisa ter alvo de toque de pelo menos 44px
- mostrar claramente quando o palpite esta salvo
- mostrar tempo restante ate bloquear
- quando bloqueado, explicar o motivo sem parecer erro

### Ranking

- `RankingTable`
- `RankingPodium`
- `RankingFilters`
- `RankingStatCards`
- `RankingTrendChart`

Dados vindos de:

- RPC `palpite.get_group_ranking(...)`
- tabela `prediction_scores`
- tabela `profiles`

Filtros:

- rodada
- dia
- fase
- periodo

### Copa

- `CompetitionSwitcher`
- `StandingsTable`
- `BracketView`
- `TeamAvatar`
- `MatchCalendar`

### Regras

- `ScoringRulesForm`
- `RulePreview`
- `AdminOnlyGate`

Campos importantes:

- pontos por placar exato
- pontos por vencedor
- pontos por empate
- pontos por gols individuais
- politica de placar inverso
- permitir pontuacao negativa
- minutos antes do jogo para bloquear palpite
- mostrar palpites antes/depois do bloqueio

## Dados e Consultas

### Tabelas globais

- `competitions`
- `teams`
- `matches`
- `standings`
- `match_statistics`
- `match_events`

Leitura autenticada para todos os usuarios logados.

### Tabelas por grupo

- `groups`
- `group_members`
- `group_invites`
- `scoring_rules`
- `predictions`
- `prediction_scores`

Sempre filtrar por grupo ativo e respeitar RLS.

### Queries iniciais por tela

`/app`:

- grupos ativos do usuario
- proximos jogos da competicao ativa
- palpites pendentes do usuario
- top 3 do grupo selecionado

`/jogos`:

- matches por competicao/data/status
- prediction do usuario por match
- scoring_rules para calcular lock visual

`/ranking`:

- RPC `get_group_ranking`
- filtros aplicados no servidor

`/regras`:

- `scoring_rules`
- role do usuario no grupo

## Estados de Interface

Cada tela importante precisa ter:

- loading skeleton
- empty state util
- erro com acao de recuperacao
- estado sem permissao
- estado offline/degradado em fase futura

Exemplos:

- sem grupos: mostrar criar grupo e entrar por convite
- sem jogos: mostrar proxima sincronizacao ou competicao vazia
- sem ranking: mostrar membros ainda sem pontuacao
- convite expirado: permitir colar outro codigo

## Acessibilidade e Mobile

Regras obrigatorias:

- contraste minimo 4.5:1 para texto normal
- foco visivel em todos os controles
- botoes e alvos de toque com no minimo 44x44px
- mensagens de erro com `role="alert"` ou `aria-live`
- labels reais em formularios
- `inputmode="numeric"` nos campos de placar
- tabelas responsivas com scroll horizontal ou versao em cards no mobile
- respeitar `prefers-reduced-motion`

## Componentes Externos Pesquisados

Regra de uso:

- Estes sao os unicos fornecedores visuais autorizados para componentes, blocos, backgrounds e microinteracoes.
- Nao criar uma UI proprietaria do zero por preferencia estetica.
- Primeiro procurar o equivalente nessas bibliotecas, depois adaptar tokens, textos, dados e estados ao Palpite.
- Quando for preciso um componente especifico do dominio, como `PredictionStepper` ou `RankingPodium`, ele deve ser composto com primitives dessas bibliotecas.

Prioridade de uso:

1. shadcn/ui oficial para base: Sidebar, Forms, Table, Data Table, Chart, Dialog, Sheet, Tabs, Badge, Skeleton, Sonner.
2. shadcn Blocks para acelerar app shell, dashboard e login.
3. Magic UI apenas para microinteracoes leves em telas publicas/empty states.
4. React Bits apenas para experimentos visuais isolados, nunca como base do app.
5. shadcn.io backgrounds como referencia de fundos React/Tailwind, usando somente opcoes discretas.

Links consultados:

- https://ui.shadcn.com/docs
- https://ui.shadcn.com/blocks
- https://ui.shadcn.com/docs/components/sidebar
- https://ui.shadcn.com/docs/components/chart
- https://magicui.design/
- https://reactbits.dev/
- https://www.shadcn.io/background

## Ordem de Implementacao

### Fase 1 - Fundacao

- Criar app Next.js com TypeScript, Tailwind e shadcn.
- Configurar tema, tokens, fontes e layout base.
- Configurar Supabase SSR:
  - browser client
  - server client
  - proxy/middleware de refresh
  - protecao de rotas com claims
- Criar App Shell com sidebar e nav mobile.

### Fase 2 - Autenticacao e Perfil

- Login.
- Cadastro.
- Logout.
- Perfil basico.
- Tratamento de sessao expirada.

### Fase 3 - Grupos e Convites

- Listar grupos do usuario.
- Criar grupo.
- Criar regra default do grupo.
- Entrar por convite.
- Gerenciar membros e convites para admin/owner.

### Fase 4 - Jogos e Palpites

- Listar jogos.
- Filtrar por data, fase e status.
- Criar/editar palpite antes do bloqueio.
- Mostrar bloqueio de palpite.
- Mostrar placar e status do jogo.

### Fase 5 - Ranking

- Integrar RPC `palpite.get_group_ranking`.
- Tabela completa com filtros.
- Podio/top 3 no resumo do grupo.
- Cards de estatisticas individuais.

### Fase 6 - Copa

- Classificacao por grupo.
- Calendario geral.
- Mata-mata visual.
- Estatisticas e eventos quando existirem dados.

### Fase 7 - Realtime e Polimento

- Realtime para jogos ao vivo.
- Realtime para ranking do grupo.
- Notificacoes de palpite salvo, jogo bloqueado e pontuacao recalculada.
- Refinos de empty states, microinteracoes e responsividade.

## Critérios de Aceite do MVP Frontend

- Usuario cria conta e entra no app.
- Usuario cria grupo.
- Usuario entra em grupo por convite.
- Usuario ve jogos da Copa.
- Usuario registra palpite antes do bloqueio.
- Usuario ve que o palpite foi salvo.
- Usuario nao consegue editar palpite bloqueado.
- Usuario ve ranking do grupo.
- Admin/owner edita regras de pontuacao.
- UI funciona bem em 375px, 768px, 1024px e desktop largo.
- Nenhum segredo sensivel aparece no bundle do navegador.
- Rotas autenticadas nao renderizam dados de outro usuario fora da RLS.

## Riscos e Pendencias

- Corrigir MCP para o projeto Supabase certo antes da integracao real.
- Confirmar se o schema `palpite` esta exposto na Data API do projeto correto.
- Confirmar publishable key atual do projeto `zhlpxcdvsbfvjhmospbx`.
- Deploy das Edge Functions ainda nao apareceu no MCP disponivel.
- Realtime e API de futebol ficam fora do primeiro corte visual, mas o layout ja deve prever status ao vivo.
- Validar se criacao de grupo precisa de RPC/Server Action transacional para criar grupo, owner e regras default juntos.

## Referencias Tecnicas Consultadas

- Supabase SSR com Next.js: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase API/RLS/grants: https://supabase.com/docs/guides/api/securing-your-api
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Next.js Authentication: https://nextjs.org/docs/app/building-your-application/authentication
- shadcn/ui: https://ui.shadcn.com/docs
- shadcn Blocks: https://ui.shadcn.com/blocks
