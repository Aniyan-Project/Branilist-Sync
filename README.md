# Branilist Sync

Extensão oficial do **Branilist** para acompanhar automaticamente anime e mangá em serviços suportados.

O Branilist Sync detecta a mídia e o progresso em sites compatíveis, pede ao backend para resolver a obra com segurança e só então envia uma atualização idempotente da lista.

## v0.4.0 — Preparação para produção

Eventos e retries persistem após reinício do worker. O popup permite revisar
pendências e verificar novamente a correspondência sem forçar updates. O parser
Crunchyroll recusa metadados incertos e preserva temporadas para revisão no backend.
O pacote é validado para Manifest V3, com content script independente.

Veja [release notes](RELEASE-v0.4.0.md) e o [guia de publicação](docs/CHROME-WEB-STORE.md).
O ID da loja e o teste OAuth/playback real ainda estão pendentes; é possível obter
o ID enviando o ZIP como rascunho antes de publicar.

### Integração com o backend

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
npm ci
npm test
npm run typecheck
npm run build
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
