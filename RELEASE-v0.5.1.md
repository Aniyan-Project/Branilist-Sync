# Branilist-Sync v0.5.1

Hotfix de detecção no Crunchyroll.

## Problema

A v0.5.0 tentava detectar a mídia somente uma vez por URL.
Em páginas onde o Crunchyroll injeta o JSON-LD/metadados alguns instantes depois de `document_idle`,
a primeira tentativa retornava `null` e a extensão não tentava novamente enquanto a URL não mudasse.

Resultado: o popup podia continuar funcional, mas o toast de detecção não aparecia.

## Correção

- A detecção agora é reexecutada na mesma URL por uma janela limitada.
- Retry a cada 750 ms.
- Máximo de 40 tentativas (~30 s).
- A rotina para assim que a mídia é detectada.
- Não gera toast duplicado após sucesso.
- A observação de progresso continua ativa em paralelo.
- Teste automatizado cobre metadata que aparece somente após tentativas posteriores.

## Compatibilidade

- Não exige alteração no backend.
- Continua usando o backend Branilist v85.32.0 / migration 000104 para correção manual.
- Mantém o mesmo ID da Chrome Web Store.
