# Branilist Extension API contract

## OAuth client

A extensão usa o OAuth Public Client oficial:

- `client_id=branilist-sync`;
- sem `client_secret`;
- Authorization Code + PKCE S256 obrigatório;
- redirect URI exata retornada por `chrome.identity.getRedirectURL('oauth2')`;
- scopes `profile list:read list:write`.

Access tokens expiram em 1 hora. Refresh tokens expiram em 30 dias e são rotativos. A extensão persiste o novo par a cada refresh e revoga os tokens ao desvincular a conta.

## Endpoints

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/api/extension/v1/me` | conta vinculada |
| GET | `/api/extension/v1/providers` | providers/hosts/thresholds |
| POST | `/api/extension/v1/resolve` | matching somente leitura |
| POST | `/api/extension/v1/tracking/events` | atualização idempotente |

## Matching seguro

A extensão chama `/resolve` antes de qualquer escrita. Ambiguidade, numbering incompatível ou mapping não verificado retornam `requiresConfirmation: true`.

Nesse caso a extensão não chama `/tracking/events` e não altera a lista.

O backend pode retornar `candidates`, mas esta versão ainda não possui endpoint para criar mappings globais a partir da extensão.

## Tracking

Anime só é enviado após pelo menos 90% do episódio. Mangá usa capítulo inteiro.

Cada escrita envia `Idempotency-Key`. Retries internos reutilizam a mesma chave e o mesmo payload.

Resposta típica:

```json
{
  "matched": true,
  "mediaId": 123,
  "action": "PROGRESS_UPDATED",
  "previousProgress": 2,
  "newProgress": 3,
  "confidence": 1,
  "requiresConfirmation": false
}
```

Tracking nunca reduz progresso nem conclui automaticamente uma obra.
