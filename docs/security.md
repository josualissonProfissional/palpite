# Seguranca

## Chaves

- `NEXT_PUBLIC_SUPABASE_URL`: pode ir para o frontend.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: pode ir para o frontend.
- `SUPABASE_SERVICE_ROLE_KEY`: somente servidor/Edge Functions.
- `sb_secret_*`: somente servidor, quando realmente necessario.
- Supabase Personal Access Token: somente local, usado pelo MCP.

As chaves secretas compartilhadas em conversa devem ser rotacionadas antes de producao.

## RLS

Todas as tabelas do schema `palpite` usam Row Level Security.

Regras centrais:

- Usuario so ve grupos onde e membro ativo.
- Usuario so cria ou edita o proprio palpite.
- Admin e owner editam regras, convites e membros.
- Dados globais da Copa sao lidos por usuarios autenticados.
- Rotinas internas usam `service_role` somente no servidor.

## MCP Local

O MCP `supabase_palpite` deve apontar apenas para o projeto `zhlpxcdvsbfvjhmospbx` e se recusar a rodar fora de `/home/josue/palpite`.

