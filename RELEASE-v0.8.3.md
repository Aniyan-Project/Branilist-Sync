# Branilist Sync v0.8.3

Hotfix da integração Netflix baseado na estratégia de metadata estruturada usada pelo MALSync.

## Problema

Na Netflix real, o player de Mushoku Tensei expunha visualmente apenas:

```text
Mushoku Tensei: Jobless ReincarnationE1Episódio 1
```

O DOM não informava a temporada de forma confiável no bloco de título. Como o Branilist Sync era fail-safe, a detecção permanecia ativa no diagnóstico, mas não criava uma mídia em "Atual" nem mostrava toast.

## Mudança de estratégia

A fonte primária da Netflix deixa de ser o texto visível do player.

A v0.8.3 adiciona um bridge em MAIN world que:

1. acessa `window.netflix.reactContext`;
2. localiza a configuração do serviço `memberapi`;
3. usa o watch/movie id atual;
4. consulta o endpoint de metadata da própria Netflix;
5. extrai somente um payload sanitizado com:
   - series id;
   - título da série;
   - season seq;
   - episode id;
   - episode seq;
   - título do episódio quando disponível;
6. envia somente esse payload ao content script por CustomEvent.

O DOM visual continua existindo apenas como fallback e diagnóstico.

## Identidade

Para metadata estruturada, o mapping agora prefere:

```text
<netflix-series-id>|season:<n>
```

em vez de depender do título textual.

Isso torna a associação da temporada estável entre EP1 → EP2 → EP3 e resistente a idioma/localização do título.

## Segurança

- bridge empacotado na extensão; nenhum código remoto;
- endpoint é aceito somente quando o hostname pertence a `netflix.com`;
- movie/series/episode ids precisam ser numéricos e limitados;
- somente metadata sanitizada cruza MAIN world → content script;
- o service worker recalcula e valida a identidade antes de aceitar tracking;
- cookies, headers e resposta completa da Netflix não são armazenados nem enviados ao Branilist;
- se metadata não for coerente, nenhuma sincronização ocorre.

## Diagnóstico

O popup passa a mostrar também:

- Bridge Netflix ativo;
- reactContext encontrado;
- Member API encontrada;
- hostname da Member API;
- movie id;
- status da consulta de metadata;
- se metadata foi reconhecida;
- series id;
- temporada;
- episode id/seq.

## Referência

A arquitetura foi inspirada na integração pública do MALSync para Netflix, que usa `window.netflix.reactContext` para descobrir o `memberapi` e a resposta estruturada de metadata para obter série, temporada e episódio.

Nenhum código do MALSync foi incorporado diretamente; a implementação do Branilist Sync é própria e adaptada ao seu modelo de segurança, matching e sincronização.
