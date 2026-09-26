# Branilist Sync

Extensão oficial do **Branilist** para acompanhar automaticamente anime e mangá em serviços suportados.

O Branilist Sync detecta a mídia e o progresso em sites compatíveis e envia eventos normalizados para o Branilist, que decide o matching final e atualiza a lista do usuário com segurança.

## v0.2.0 — Crunchyroll tracking foundation

A primeira integração real está sendo construída para o Crunchyroll.

Já implementado nesta versão:

- Manifest V3.
- OAuth 2.0 Authorization Code + PKCE.
- Service worker como única camada que conhece o access token.
- Providers isolados para facilitar contribuições da comunidade.
- Detecção do ID estável de URLs `/watch/<id>`.
- Parser em camadas para metadados de episódio.
- JSON-LD como fonte preferencial de série + número do episódio.
- Progresso do elemento `<video>`.
- Evento de sync somente após atingir 80% do episódio.
- Detecção e atualização de progresso são eventos separados.
- Remount automático em navegação SPA entre episódios.
- Permissões restritas aos hosts realmente suportados.
- Testes de parsing e CI com test/typecheck/build.

### Fail-safe

O provider não deve atualizar a lista se não tiver identificação suficiente da mídia.

Abrir um episódio nunca é considerado progresso assistido. O evento de escrita só acontece quando o tracker cruza o threshold configurado.

## Estado dos providers

- **Crunchyroll:** tracking foundation ativo em desenvolvimento; requer validação com fixtures/páginas reais antes da publicação na Chrome Web Store.
- **Netflix:** scaffold, desativado.
- **Comikey:** scaffold, desativado.

Um provider só deve ser marcado como estável depois de testes reais e regras seguras de progresso.

## Desenvolvimento

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

O build copia `manifest.json` para `dist/`. Depois carregue `dist/` em:

```text
chrome://extensions
→ Modo do desenvolvedor
→ Carregar sem compactação
```

## Arquitetura

```text
Página suportada
      ↓
Content Script
      ↓
Tracker Provider
      ↓
Evento normalizado
      ↓
Service Worker
      ↓
Branilist API
      ↓
Matching + atualização da lista
```

O provider nunca recebe o token Branilist.

## Contribuições

A comunidade pode adicionar suporte a novos sites criando providers em `src/providers/`.

Leia [CONTRIBUTING.md](./CONTRIBUTING.md) antes de abrir um PR.

## Projeto

- Site: https://branilist.com
- Organização: https://github.com/Aniyan-Project
- Repositório: https://github.com/Aniyan-Project/Branilist-Sync
