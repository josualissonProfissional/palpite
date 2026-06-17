# Backlog de Ajustes - Palpitô

Fonte: `fixure.md`

Objetivo: transformar os pedidos soltos do arquivo em tasks pequenas, claras e implementaveis.

## T01 - Aplicar marca Palpitô no app

**Prioridade:** Alta

**Historia:** Como usuario, quero ver o nome e a identidade visual Palpitô no aplicativo, para reconhecer claramente o produto.

**Escopo:**
- Trocar o nome exibido da aplicacao para `Palpitô`.
- Adicionar a logo na interface principal.
- Usar `images/logo/logo-detalhada.png` quando houver espaco para logo completa.
- Usar `images/logo/logo-apenas-desenho.png` em espacos compactos.
- Configurar o favicon usando `images/logo/logo-apenas-desenho.png`.

**Criterios de aceite:**
- O nome `Palpitô` aparece nas areas principais da aplicacao.
- A logo aparece na aplicacao sem distorcer.
- O favicon do navegador usa a arte `logo-apenas-desenho.png`.
- As imagens de logo usadas existem no repositorio e carregam em producao.

## T02 - Mostrar todos os grupos do usuario no menu esquerdo

**Prioridade:** Alta

**Historia:** Como usuario com varios grupos, quero ver todos os meus grupos no menu esquerdo, para trocar de grupo rapidamente.

**Escopo:**
- Listar no menu lateral todos os grupos em que o usuario autenticado participa.
- Cada grupo deve levar para `/app/grupos/{nomegrupo}`.
- A lista de grupos deve continuar visivel ao entrar em `Meus grupos`, `Classificacao` ou paginas internas.

**Criterios de aceite:**
- O menu esquerdo exibe todos os grupos do usuario logado.
- A lista permanece visivel nas paginas internas do app.
- Ao clicar em um grupo, o usuario navega para a pagina correta do grupo.
- O estado sem grupos continua tratado pela interface.

## T03 - Adicionar botao de logout no menu

**Prioridade:** Alta

**Historia:** Como usuario logado, quero um botao claro para sair da conta, para encerrar minha sessao quando quiser.

**Escopo:**
- Adicionar botao de logout no menu da aplicacao.
- Executar o sign out do Supabase Auth.
- Redirecionar o usuario para a tela de entrada ou home publica apos sair.

**Criterios de aceite:**
- O botao de logout fica visivel para usuarios autenticados.
- Ao clicar, a sessao e encerrada.
- Depois do logout, paginas privadas deixam de ser acessiveis sem login.

## T04 - Usar nome cadastrado no ranking

**Prioridade:** Alta

**Historia:** Como participante, quero que o ranking mostre meu nome cadastrado, para nao aparecer apenas o inicio do meu email.

**Escopo:**
- Ajustar a origem do nome exibido nos rankings.
- Usar o nome salvo no cadastro/perfil do usuario.
- Parar de montar nome a partir do email.

**Criterios de aceite:**
- O ranking mostra o nome cadastrado do usuario.
- O email nao e usado como fonte principal do nome no ranking.
- Rankings ao vivo e rankings de grupo usam a mesma regra de exibicao.
- Usuarios sem nome cadastrado recebem tratamento visual consistente ja existente no app.

## T05 - Remover duplicidade entre pagina do grupo e pagina de jogos

**Prioridade:** Alta

**Historia:** Como usuario, quero ver os jogos em apenas uma pagina do grupo, para nao navegar por telas repetidas.

**Escopo:**
- Consolidar as informacoes de jogos em `/app/grupos/{nomegrupo}/`.
- Remover a rota `/app/grupos/{nomegrupo}/jogos` do menu.
- Apagar ou desativar a pagina duplicada de jogos, se nao for mais usada.
- Garantir que os links internos apontem para a pagina principal do grupo.

**Criterios de aceite:**
- O menu nao mostra mais link separado para `Jogos`.
- A pagina `/app/grupos/{nomegrupo}/` contem as informacoes necessarias de jogos.
- Nao ha duas telas com praticamente o mesmo conteudo de jogos.
- Links quebrados para `/jogos` nao ficam na navegacao principal.

## T06 - Compactar o topo da pagina do grupo no celular

**Prioridade:** Alta

**Historia:** Como usuario no celular, quero que os indicadores do topo da pagina do grupo sejam compactos, para ver mais conteudo sem precisar rolar demais.

**Escopo:**
- Ajustar o bloco do topo em `/app/grupos/{nomegrupo}/`.
- Compactar informacoes como rodada ao vivo, nome do grupo, bandeiras, jogos, ao vivo, posicao e ranking.
- No celular, deixar os indicadores pequenos e lado a lado quando houver espaco.
- Reduzir altura do topo no mobile.

**Criterios de aceite:**
- No celular, os cards/indicadores do topo ocupam menos altura.
- As informacoes continuam legiveis.
- Os indicadores principais aparecem lado a lado quando a largura permitir.
- A pagina exige menos rolagem antes da lista de jogos/palpites.

## T07 - Corrigir ranking ao vivo no celular sem rolagem horizontal

**Prioridade:** Alta

**Historia:** Como usuario no celular, quero ver todas as informacoes do ranking ao vivo sem rolar para o lado.

**Escopo:**
- Ajustar o layout do ranking ao vivo em telas pequenas.
- Evitar tabela larga ou colunas que forcem scroll horizontal.
- Reorganizar dados em formato responsivo quando necessario.

**Criterios de aceite:**
- Em celular, o ranking ao vivo nao exige scroll horizontal.
- Todas as informacoes importantes do ranking aparecem dentro da largura da tela.
- O layout continua utilizavel em desktop.

## T08 - Corrigir palpites no celular sem rolagem horizontal

**Prioridade:** Alta

**Historia:** Como usuario no celular, quero ver meus palpites sem rolar para o lado, para acompanhar tudo em uma unica coluna responsiva.

**Escopo:**
- Ajustar a exibicao dos palpites em telas pequenas.
- Remover ou substituir estruturas que forcem largura maior que a tela.
- Garantir que placar, times, status e acoes caibam no mobile.

**Criterios de aceite:**
- Em celular, a area de palpites nao exige scroll horizontal.
- Todas as informacoes do palpite ficam visiveis na largura da tela.
- Botoes e campos continuam clicaveis e legiveis.

## T09 - Adicionar filtro por dia em Meus Palpites

**Prioridade:** Media

**Historia:** Como usuario, quero filtrar meus palpites por dia, para encontrar rapidamente jogos de hoje ou de ontem.

**Escopo:**
- Adicionar filtro na tela `Meus Palpites`.
- Incluir filtros por dia, com pelo menos `Hoje`, `Ontem` e `Todos`.
- Aplicar o filtro sobre a lista de jogos/palpites exibidos.

**Criterios de aceite:**
- O usuario consegue filtrar palpites de hoje.
- O usuario consegue filtrar palpites de ontem.
- O usuario consegue voltar a ver todos os palpites.
- O filtro funciona no desktop e no celular.

## T10 - Atualizar placar ao vivo no compartilhamento dos palpites

**Prioridade:** Media

**Historia:** Como usuario, quero que o compartilhamento dos meus palpites mostre o resultado ao vivo atualizado, para enviar informacoes corretas.

**Escopo:**
- Revisar a geracao de imagem/texto de compartilhamento em `Meus Palpites`.
- Usar o mesmo resultado ao vivo exibido no jogo.
- Evitar compartilhar placar antigo quando o jogo ja foi atualizado.

**Criterios de aceite:**
- O placar compartilhado acompanha o resultado ao vivo mostrado no app.
- Compartilhar imagem e compartilhar texto usam dados atualizados.
- O compartilhamento nao mostra placar diferente do card do jogo correspondente.

## T11 - Adicionar logo nas imagens compartilhadas

**Prioridade:** Media

**Historia:** Como usuario, quero que a imagem compartilhada dos meus palpites tenha a logo do Palpitô, para identificar o app.

**Escopo:**
- Inserir logo na imagem gerada para compartilhamento.
- Usar `images/logo/logo-apenas-desenho.png` ou `images/logo/logo-detalhada.png`.
- Garantir que a logo nao cubra placar, times ou palpite.

**Criterios de aceite:**
- A imagem compartilhada inclui a logo.
- A logo fica visivel e bem posicionada.
- As informacoes principais da imagem continuam legiveis.

## T12 - Adicionar link do site no texto compartilhado

**Prioridade:** Media

**Historia:** Como usuario, quero que o texto compartilhado inclua o link do site, para outras pessoas acessarem o Palpitô.

**Escopo:**
- Atualizar o texto gerado no compartilhamento.
- Incluir o link do site no texto.
- Manter o conteudo do palpite no texto compartilhado.

**Criterios de aceite:**
- O texto compartilhado contem o link do site.
- O texto continua mostrando as informacoes do palpite.
- O link funciona quando enviado por apps de mensagem.

## Ordem sugerida

1. T01 - Aplicar marca Palpitô no app
2. T02 - Mostrar todos os grupos do usuario no menu esquerdo
3. T03 - Adicionar botao de logout no menu
4. T04 - Usar nome cadastrado no ranking
5. T05 - Remover duplicidade entre pagina do grupo e pagina de jogos
6. T06 - Compactar o topo da pagina do grupo no celular
7. T07 - Corrigir ranking ao vivo no celular sem rolagem horizontal
8. T08 - Corrigir palpites no celular sem rolagem horizontal
9. T09 - Adicionar filtro por dia em Meus Palpites
10. T10 - Atualizar placar ao vivo no compartilhamento dos palpites
11. T11 - Adicionar logo nas imagens compartilhadas
12. T12 - Adicionar link do site no texto compartilhado
