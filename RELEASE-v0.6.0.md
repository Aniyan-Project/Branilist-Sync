# Branilist-Sync v0.6.0

Redesign do popup e controles de lista dentro da extensão.

## Nova interface

- Popup redesenhado com identidade visual do Branilist.
- Navegação por abas:
  - Atual
  - Minha Lista
  - Pendências
  - Configurações
- Cabeçalho compacto com conta conectada.
- Estado atual e pendências deixam de disputar o mesmo espaço visual.

## Minha Lista

- Carrega a lista da conta autenticada.
- Pesquisa local por título.
- Filtro por status.
- Capa, progresso e nota por obra.
- Respeita `titleLanguage` da conta Branilist:
  - AUTO
  - PORTUGUESE
  - ENGLISH
  - ROMAJI
  - NATIVE

## Detalhe e edição

Ao clicar em uma obra:

- capa/banner;
- formato, ano, total e média;
- descrição;
- status da lista;
- progresso;
- nota 0.5–10;
- repeat count;
- edição manual sem sair da extensão.

## Segurança

- Token continua restrito ao service worker.
- Content scripts não podem ler nem editar a lista.
- Mensagens `LIBRARY_GET`, `LIBRARY_UPDATE` e `MEDIA_GET` exigem popup confiável.
- Texto remoto é renderizado com `textContent`.

## Backend necessário

Requer Branilist backend com:

- `GET /api/extension/v1/library`
- `PUT /api/extension/v1/library/{mediaId}`
- `titleLanguage` e `localeCode` em `GET /api/extension/v1/me`

Não exige novos scopes OAuth; reutiliza `list:read` e `list:write`.

## Dependências

- Deve incorporar a v0.5.2 do toast.
- O backend correspondente deve estar deployado antes do smoke real da aba Minha Lista.
