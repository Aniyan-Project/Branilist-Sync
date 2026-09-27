# Branilist Sync v0.8.11

Fila durável com retry automático para sincronizações incertas.

## Objetivo

A extensão já persistia o evento antes de enviar ao Branilist e reutilizava a mesma
`Idempotency-Key` numa tentativa manual. A v0.8.11 completa esse desenho para MV3:
falhas transitórias passam a ser retomadas automaticamente mesmo se o service worker
for encerrado pelo Chrome.

## Estado persistido

Uma pendência de sincronização pode registrar:

- número de falhas (`attempts`);
- tipo da falha (`retryKind`);
- status HTTP quando disponível;
- se a falha é elegível para retry automático;
- `nextAttemptAt`.

O evento original não é recriado. Seu UUID e `occurredAt` continuam iguais, portanto
o POST seguinte reutiliza exatamente a mesma chave de idempotência.

## Política de retry

Tratamento atual:

- rede/offline/timeout: retry automático;
- HTTP 408: retry automático;
- HTTP 429: retry automático respeitando `Retry-After`;
- HTTP 5xx: retry automático;
- HTTP 401/autenticação expirada: não entra em loop; exige nova vinculação;
- demais HTTP 4xx: retry manual;
- falha desconhecida: retry manual.

O backoff é exponencial com jitter, começando em aproximadamente 30–60 segundos e
limitado a 6 horas. Eventos continuam expirando após 30 dias.

## Chrome MV3

Foi adicionada a permissão `alarms`.

O worker agenda apenas o retry automático mais próximo. Quando o alarme dispara:

1. carrega a fila persistida;
2. seleciona apenas eventos realmente vencidos;
3. serializa os retries com a mesma fila usada pelas mensagens normais;
4. reconsulta a correspondência;
5. reenvia o mesmo evento/idempotency key;
6. agenda o próximo alarme, se ainda existir pendência transitória.

Na inicialização do service worker, o próximo alarme também é reconstruído a partir
do snapshot persistido.

## Popup

Pendências transitórias agora informam:

- que existe retry automático;
- horário aproximado da próxima tentativa;
- número de falhas.

Erros de autenticação informam que a conta precisa ser vinculada novamente.

O botão manual “Tentar novamente” continua disponível.

## Segurança e consistência

- nenhuma credencial é armazenada na fila;
- nenhuma nova permissão de host foi adicionada;
- retries continuam dentro do worker confiável;
- validação de provider/tab/frame permanece inalterada;
- Netflix continua fail-closed;
- a fila multiaba continua global somente para operações da conta, enquanto estado de UI permanece por tab;
- falhas de um evento não bloqueiam retries vencidos de outros eventos.

## Testes

Cobertura adicionada para:

- classificação de offline/network;
- 401 sem loop automático;
- 429 + `Retry-After`;
- 5xx;
- 4xx permanente;
- backoff exponencial;
- persistência de `nextAttemptAt`;
- replay automático do mesmo UUID/`occurredAt`;
- alarme do Chrome executando uma pendência vencida.
