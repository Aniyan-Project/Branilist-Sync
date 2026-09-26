# Branilist-Sync v0.4.3

Correção de UX para o smoke real da identidade de temporada.

## Problema

Após atualizar da v0.4.1/v0.4.2, uma pendência persistida de `confirmation_required`
era priorizada pelo popup. Isso fazia a pendência antiga esconder a detecção atual
da página, inclusive os novos IDs públicos de episódio, temporada e série.

## Correção

- "Página atual" agora é exibida separadamente das "Pendências".
- A detecção mais recente da aba nunca é substituída visualmente por uma pendência antiga.
- Pendências continuam preservadas e podem ser selecionadas/reprocessadas normalmente.
- IDs públicos de episódio/temporada/série aparecem na seção da página atual.
- Teste cobre exatamente o caso de uma detecção nova com uma pendência legada sem IDs.
- Nome dos artifacts da CI deixa de conter versão hardcoded; agora é
  `branilist-sync-Windows` e `branilist-sync-Linux`.
- Manifest/package/lockfile: `0.4.3`.

Esta atualização é exclusiva da extensão e não exige release nova do servidor Branilist.
