# Branilist Sync

Extensão oficial do **Branilist** para acompanhar automaticamente anime e mangá em serviços suportados.

O Branilist Sync detecta a mídia e o progresso em sites compatíveis e envia eventos normalizados para o Branilist, que decide o matching final e atualiza a lista do usuário com segurança.

## Objetivos da v0.1.0

- Manifest V3.
- Vinculação com Branilist via OAuth 2.0 Authorization Code + PKCE.
- Service worker como única camada que conhece o access token.
- Providers isolados para facilitar contribuições da comunidade.
- Backend responsável pelo matching final, evitando atualizações ambíguas.
- Arquitetura aberta para novos sites via pull requests.

## Estado inicial dos providers

- **Crunchyroll:** scaffold de detecção; precisa de fixtures/seletores validados antes de produção.
- **Netflix:** scaffold, desativado.
- **Comikey:** scaffold, desativado.

Um provider só deve ser marcado como suportado depois de testes reais e regras estáveis de progresso.

## Desenvolvimento

```bash
pnpm install
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
