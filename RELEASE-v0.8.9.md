# Branilist Sync v0.8.9

Fundamentos multiaba e consistência de estado.

## Problema

Até a v0.8.8, o tracking de cada content script era isolado na página, mas o service worker persistia o estado de interface em chaves globais:

- última mídia detectada;
- resolução atual;
- navegação de episódio;
- diagnósticos do provider;
- diagnósticos dos bridges.

Com duas abas suportadas abertas, a última mensagem recebida podia substituir ou limpar o estado mostrado pela outra aba.

## Sessões por aba

A v0.8.9 introduz sessões persistidas com a identidade:

```
tabId + frameId + providerId
```

Cada sessão pode manter separadamente:

- mídia detectada;
- resolução Branilist;
- navegação de episódio;
- diagnóstico do provider;
- diagnóstico Crunchyroll;
- diagnóstico Netflix.

A fila de sincronização e o histórico continuam globais da conta, pois representam operações Branilist e não estado visual de uma aba.

## Popup tab-aware

Ao abrir o popup, ele consulta a aba ativa e solicita ao worker somente a sessão correspondente àquele `tabId`.

Consequências:

- abrir o popup numa aba Crunchyroll mostra aquela aba;
- abrir numa aba Netflix mostra aquela aba;
- uma aba sem mídia rastreável não herda a mídia de outra aba;
- outras sessões ativas podem ser contabilizadas no diagnóstico sem substituir a sessão atual.

Se o ID da aba não estiver disponível, o popup mantém um fallback para a sessão atualizada mais recentemente.

## Limpeza isolada

`TRACKER_CLEARED` limpa somente a sessão que originou a mensagem.

`NETFLIX_WATCH_CHANGED` também invalida apenas a mídia/resolução da aba Netflix que mudou de título.

Isso impede, por exemplo, que navegar para um dorama em uma aba Netflix apague o anime sendo acompanhado em outra aba.

## Ciclo de vida

Quando uma aba é fechada, o worker remove as sessões persistidas daquele `tabId`.

Se o mesmo tab principal for reutilizado para outro provider suportado, a sessão antiga daquele tab/frame é descartada para não existir mais de um provider ativo no mesmo top frame.

As chaves globais antigas de tracking são removidas na inicialização da nova arquitetura.

## Segurança

A mudança não altera as fronteiras existentes:

- somente frame principal participa do tracking;
- `sender.id`, `sender.tab`, host, origem e URL continuam validados;
- Netflix continua fail-closed;
- metadata MAIN-world continua não confiável até passar pelas validações;
- a idempotência da fila de sync permanece global e inalterada.

## Testes adicionados

Cobertura inclui:

- Crunchyroll e Netflix em abas diferentes;
- duas abas Netflix independentes;
- mudança de Watch ID Netflix limpando somente a aba originadora;
- limpeza de sessão sem remover outra sessão;
- seleção da sessão do popup por aba ativa.

## Próximo passo

Após smoke real multiaba, a próxima etapa recomendada pela auditoria é fila durável/retry automático usando `chrome.alarms`.
