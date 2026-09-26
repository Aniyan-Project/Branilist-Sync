# Branilist Sync

Extensão oficial do **Branilist** para acompanhar automaticamente anime e mangá em serviços suportados.

O Branilist Sync detecta a mídia e o progresso em sites compatíveis, pede ao backend para resolver a obra com segurança e só então envia uma atualização idempotente da lista.

## v0.3.0 — Backend integration

Implementado nesta versão:

- Manifest V3.
- OAuth Public Client `branilist-sync` com Authorization Code + PKCE S256.
- Refresh token rotativo e retry automático após 401.
- Revogação de tokens no logout.
- Tokens restritos ao service worker / contexts confiáveis.
- `GET /me` para exibir a conta vinculada.
- `POST /resolve` antes de qualquer escrita.
- `POST /tracking/events` com `Idempotency-Key`.
- Matching incerto nunca atualiza a lista.
- Estado de confirmação/revisão visível no popup.
- Crunchyroll sincroniza somente a partir de **90%**, igual ao backend.
- Abrir uma página nunca conta como progresso.
- Testes de threshold e idempotência.

### Fail-safe

```text
episódio detectado
      ↓
90% assistido
      ↓
POST /resolve
      ↓
match seguro?
 ├─ não → confirmação necessária; nenhuma escrita
 └─ sim → POST /tracking/events
              ↓
        atualização monotônica
```

## Estado dos providers

- **Crunchyroll:** integração ativa para anime, ainda exigindo validação com páginas reais antes da publicação na Chrome Web Store.
- **Netflix:** scaffold, desativado.
- **Comikey:** scaffold, desativado.

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

Para o OAuth funcionar fora de testes, o ID publicado da extensão precisa estar provisionado no backend como callback exato do client `branilist-sync`.

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
      ├── OAuth/token
      ├── /resolve
      └── /tracking/events
              ↓
        Branilist backend
```

O provider e o content script nunca recebem o token Branilist.

## Contribuições

A comunidade pode adicionar suporte a novos sites criando providers em `src/providers/`.

Leia [CONTRIBUTING.md](./CONTRIBUTING.md) antes de abrir um PR.

## Projeto

- Site: https://branilist.com
- Organização: https://github.com/Aniyan-Project
- Repositório: https://github.com/Aniyan-Project/Branilist-Sync
