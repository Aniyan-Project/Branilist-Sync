# Branilist Extension API contract

## OAuth client
Criar um OAuth Public Client específico para a extensão, sem client_secret e com PKCE S256 obrigatório.

Redirect URI cadastrada deve aceitar o padrão retornado por `chrome.identity.getRedirectURL('oauth2')` para o ID publicado da extensão.

Scopes mínimos sugeridos:
- `profile`
- `list:read`
- `list:write`

## POST /api/extension/v1/tracking/events

Recebe eventos detectados pelos providers. O backend é responsável por resolver a mídia do Branilist e aplicar regras de atualização.

Payload:

```json
{
  "provider": "crunchyroll",
  "providerMediaId": "optional-external-id",
  "mediaType": "ANIME",
  "title": "Example",
  "episode": 3,
  "chapter": null,
  "progressPercent": 92,
  "sourceUrl": "https://...",
  "occurredAt": "2026-09-25T21:30:00-03:00"
}
```

Resposta sugerida:

```json
{
  "matched": true,
  "mediaId": "uuid",
  "action": "PROGRESS_UPDATED",
  "previousProgress": 2,
  "newProgress": 3,
  "confidence": 1,
  "requiresConfirmation": false
}
```

## Matching
Preferência:
1. mapeamento explícito `(provider, provider_media_id) -> media_id`;
2. alias de URL/provider mantido pelo catálogo;
3. matching por IDs externos presentes na página;
4. título normalizado somente como fallback;
5. se ambíguo, nunca atualizar automaticamente: retornar `requiresConfirmation: true`.
