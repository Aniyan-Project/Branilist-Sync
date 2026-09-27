# Smoke real — Netflix (v0.8.0)

Este smoke valida o primeiro provider Netflix antes do merge/release.

## Preparar a build

```bash
git fetch origin
git switch feat/v0.8.0-netflix-foundation
git pull
npm ci
npm test
npm run typecheck
npm run build
```

Em `chrome://extensions`:

1. Ative **Modo do desenvolvedor**.
2. Remova/desative temporariamente outra build local do Branilist Sync.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `dist/`.
5. Confirme que o ID continua `kimfpnbfjfmpkjpcmfnjeoefakhcoclh`.

> Não substitua a versão enviada para revisão na Web Store. Este smoke usa somente a build local da branch.

## Cenário 1 — detectar um episódio

1. Vincule uma conta Branilist de teste.
2. Abra na Netflix um **anime episódico**, não filme.
3. Inicie um episódio e mova o mouse para deixar os controles/título do player visíveis por alguns segundos.
4. Abra o popup do Branilist Sync.

Esperado:

- **Provider: Netflix — ATIVO**;
- última página em `https://www.netflix.com/watch/<id>`;
- último episódio com o watch ID;
- a aba Atual mostra o título e o número correto do episódio;
- nenhuma atualização de progresso ocorre apenas por abrir o player.

Se a correspondência não for segura, confirme/corrija uma única vez. Isso é esperado no primeiro episódio da temporada.

## Cenário 2 — threshold de 90%

1. Com a mídia correta detectada, avance para algo abaixo de 90%.
2. Confira que a lista Branilist não foi incrementada.
3. Cruze 90% do vídeo.
4. Confira a lista Branilist.

Esperado:

- progresso incrementado uma única vez;
- retries/eventos duplicados não criam incrementos extras;
- o diagnóstico mostra o último progresso observado.

## Cenário 3 — troca de episódio pela SPA

1. Do episódio atual, deixe a Netflix iniciar/abrir o próximo episódio sem recarregar manualmente a página.
2. Aguarde alguns segundos.
3. Abra o popup.

Esperado:

- o watch ID muda;
- o número do episódio muda;
- o título da série continua igual;
- o `providerMediaId` lógico continua representando a mesma temporada;
- a correção manual feita no episódio anterior é reutilizada;
- não aparece nova confirmação apenas porque o episódio mudou.

Repita por pelo menos três episódios consecutivos.

## Cenário 4 — temporadas diferentes

1. Abra um episódio de outra temporada da mesma série.

Esperado:

- a identidade de temporada muda;
- uma correção da temporada anterior **não** é aplicada automaticamente à nova temporada;
- se necessário, a nova temporada pede confirmação uma vez e reutiliza esse mapping nos episódios seguintes.

## Cenário 5 — sair do player

1. Volte para `/browse` ou para uma página que não seja `/watch/<id>`.
2. Abra o popup.

Esperado:

- **Provider: Netflix — inativo**;
- o estado de mídia atual é limpo;
- o diagnóstico registra quando saiu do player.

## Se a detecção falhar

Copie do popup a seção **Diagnóstico do provider** e informe:

- URL `/watch/<id>` (o ID pode ser mantido);
- idioma da interface Netflix;
- texto visível na área do título do player, por exemplo `T1:E3`;
- se o título aparece quando os controles estão visíveis;
- se trocar de episódio alterou a URL sem F5.

Não envie cookies, tokens, headers de autenticação, dados da conta Netflix nem respostas de API privadas.

Se for necessário investigar o DOM, envie somente um trecho sanitizado do elemento visual de título do player ou uma captura de tela. O provider deve continuar fail-safe: ausência de metadados confiáveis significa nenhuma sincronização.
