# Arquitetura do Palpite

## Decisao Base

O backend usa Supabase como base principal: Auth, Postgres, RLS, Edge Functions e Realtime.

Projeto Supabase oficial:

```txt
https://zhlpxcdvsbfvjhmospbx.supabase.co
```

O app usa um schema isolado chamado `palpite`. Isso evita misturar o bolao com tabelas de outros produtos.

## Fluxo Principal

```txt
Frontend
  -> Supabase Auth
  -> Supabase Data API com RLS
  -> Supabase Realtime para eventos ao vivo
  -> Edge Functions para operacoes internas
  -> API de futebol somente pelo servidor
```

O frontend pode ler e escrever dados simples quando a RLS cobre a regra. Operacoes sensiveis ficam em Edge Functions ou Server Actions com service role no servidor.

## MVP

- Login por email e senha via Supabase Auth.
- Criacao de grupos.
- Entrada por convite.
- Regras de pontuacao por grupo.
- Jogos globais da Copa.
- Palpites bloqueados antes do jogo.
- Calculo de pontuacao.
- Ranking por grupo.
- Realtime para jogos, classificacao, grupos, palpites e pontuacao.
- Feedback parcial de palpite quando jogo esta ao vivo.

## V2

- Estatisticas detalhadas.
- Mata-mata visual.
- Notificacoes.
