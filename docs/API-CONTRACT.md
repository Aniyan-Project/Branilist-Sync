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

Cada escrita envia `Idempotency-Key` com UUID aleatório. O evento é persistido antes
do envio. Retries por 401, popup e reinício do worker reutilizam a mesma chave,
`occurredAt` e payload. Nenhum botão aceita mediaId ou remove `seasonTitle` para
forçar matching. Logout/login limpa os eventos locais para separar contas.

O popup pode consultar `/resolve` novamente após revisão por operador. Não existe
endpoint de confirmação manual pela extensão. Um resultado `REQUIRES_CONFIRMATION`
persistido pelo backend permanece idempotente; o mesmo evento não força reprocessamento.

Sucesso de tracking exige `matched: true`, `requiresConfirmation: false`, mediaId
inteiro positivo, confiança entre 0.9 e 1 e ação `PROGRESS_UPDATED` ou `UNCHANGED`.
Resposta desconhecida não é exibida como sincronização concluída.

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
