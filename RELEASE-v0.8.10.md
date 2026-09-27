# Branilist Sync v0.8.10

Hotfix de ciclo de vida do content script após recarregar/atualizar a extensão.

## Problema observado

Durante smoke da v0.8.9, o tracking multiaba funcionou corretamente, mas o Chrome registrou em `chrome://extensions`:

```
Uncaught (in promise) Error: Extension context invalidated.
```

Isso acontece quando uma extensão unpacked é recarregada/atualizada enquanto uma aba compatível continua aberta. O content script antigo permanece na página, mas seu contexto de extensão deixa de ser válido.

Algumas chamadas usavam `chrome.runtime.sendMessage(...).catch(...)`. Esse padrão cobre rejeições assíncronas, mas não cobre de forma confiável todos os casos em que o contexto já foi invalidado antes da chamada.

## Correção

Foi criado um helper centralizado para mensagens do content script:

- detecta se o runtime ainda pode enviar mensagens;
- envolve a chamada em `try/catch`;
- reconhece `Extension context invalidated`;
- marca aquele content script antigo como invalidado;
- ignora futuras tentativas daquele contexto;
- evita rejeições não tratadas em `chrome://extensions`.

Todo o fluxo de tracking e os toasts agora usam esse helper em vez de chamar `chrome.runtime.sendMessage` diretamente.

A reconciliação SPA também deixa de iniciar novo trabalho quando o contexto já foi marcado como invalidado.

## Impacto

Não altera:

- tracking normal;
- sessões multiaba;
- threshold de 90%;
- resolução/mapping;
- idempotência;
- filtro de anime Netflix;
- segurança de sender/host/frame/URL.

O comportamento esperado depois de atualizar/recarregar uma build unpacked continua sendo recarregar a aba para receber o content script novo, mas a aba antiga não deve mais gerar um erro não tratado enquanto isso.

## Smoke v0.8.9 validado

Antes deste hotfix foi validado em navegador real:

- duas abas do mesmo provider;
- Netflix + outro provider em paralelo;
- popup mostrando a mídia correta por aba;
- sair/fechar player em uma aba sem afetar outra;
- atingir 90% sincronizando somente a mídia da aba correta;
- conteúdo Netflix não-anime permanecendo fora do tracking.

## Testes

Foi adicionada regressão específica simulando um runtime que lança `Extension context invalidated` e verificando que a chamada é absorvida sem rejeição não tratada.
