# v0.4.2 — preparar e publicar

## Estado desta versão

O rascunho na Chrome Web Store já existe com ID `kimfpnbfjfmpkjpcmfnjeoefakhcoclh`.
A chave pública fornecida pelo responsável foi validada e incluída no manifest.
O client `branilist-sync` já foi provisionado em produção e o login real com o ID definitivo foi validado.
Um smoke real no Crunchyroll confirmou detecção do episódio e resposta segura de `/resolve`; o backend exigiu confirmação e nenhuma escrita foi feita.
A validação de `season_id`/matching automático e a aprovação da loja permanecem pendentes. CI verde não certifica esses passos.
As fixtures são sintéticas e reduzidas; não foram capturadas de uma conta real.

## Próximos passos para o item existente

1. Envie o ZIP **0.4.1** como novo pacote no mesmo item de rascunho; não crie outro item.
2. Para testar localmente, extraia o ZIP, carregue a pasta em `chrome://extensions`
   e confira o ID `kimfpnbfjfmpkjpcmfnjeoefakhcoclh`. Desative a instalação anterior
   sem chave, caso ainda esteja carregada com outro ID.
3. Um operador provisiona o client no backend, a partir de `apps/api`, com o
   `DATABASE_URL` do ambiente correto e seu ID de usuário existente:

   ```sh
   go run ./cmd/sync-client -owner <ID_DO_OPERADOR_EXISTENTE> -extension-id kimfpnbfjfmpkjpcmfnjeoefakhcoclh
   ```

4. O callback cadastrado precisa ser exatamente
   `https://kimfpnbfjfmpkjpcmfnjeoefakhcoclh.chromiumapp.org/oauth2` no client
   público `branilist-sync`. Execute o smoke de login/playback abaixo antes da submissão.

O provisionamento e o login real já foram concluídos em produção para o ID definitivo.
Reprovisionar só é necessário se owner, callback, scopes ou ID da extensão mudarem.

## Primeiro envio: criar o rascunho e obter o ID

1. Cadastre sua conta de desenvolvedor no [painel da loja](https://chrome.google.com/webstore/devconsole)
   e conclua os requisitos de cadastro exibidos pelo Google.
2. Execute `npm ci`, `npm test` e `npm run build`. Compacte o **conteúdo** de `dist/`,
   com `manifest.json` na raiz do ZIP. A CI também oferece o artefato do pacote.
3. No painel, escolha **Adicionar novo item**, envie o ZIP e mantenha como rascunho.
   Criar o item já gera o ID; não é necessário publicar para obtê-lo.
4. Copie o ID do item e, na aba **Pacote**, use **Ver chave pública**. Copie somente
   o conteúdo entre os delimitadores PUBLIC KEY, em uma única linha, para o campo
   `key` de `manifest.json`. Essa chave é pública; não use uma chave privada.
5. Refaça o build e execute `npm run check:store -- <ID_DO_ITEM>`. O comando exige
   a chave real, deriva o ID e compara com o item da loja. Falha sem configuração.
6. Carregue `dist/` em `chrome://extensions` com modo de desenvolvedor habilitado.
   O ID local deve ser igual ao ID do painel. No popup, **Diagnóstico de conexão**
   mostra o client, o ID em execução e o callback esperado.

Referências oficiais: [manter o ID com a chave pública](https://developer.chrome.com/docs/extensions/reference/manifest/key),
[preparar o pacote](https://developer.chrome.com/docs/webstore/prepare),
[enviar e publicar](https://developer.chrome.com/docs/webstore/publish).

## Provisionar OAuth no backend

Um operador do Branilist executa, a partir de `apps/api` do repositório **Branilist**,
com `DATABASE_URL` apontando para o ambiente correto:

```sh
go run ./cmd/sync-client -owner <ID_DO_OPERADOR_EXISTENTE> -extension-id <ID_DO_ITEM>
```

O comando existente cria `branilist-sync`, client público sem secret, com scopes
`profile list:read list:write` e callback exato
`https://<ID_DO_ITEM>.chromiumapp.org/oauth2`. Reexecutar com o mesmo owner/ID é
idempotente; outro callback ou owner é recusado. Não alterar diretamente o banco
para contornar essa verificação. Esta versão não provisiona nem modifica produção.

Referência no backend: `apps/api/internal/oauth/sync_client.go` e
`docs/BRANILIST-SYNC-API.md` (a parte de scaffold desse documento precede a v0.3).
O runtime compara origin/path do retorno, state único, code único e ausência de
erro/fragmento antes da troca. A API Chrome aceita qualquer caminho do domínio
chromiumapp do app; por isso nossa checagem exata de `/oauth2` é necessária.
[Chrome Identity](https://developer.chrome.com/docs/extensions/reference/api/identity).

## Smoke obrigatório antes da submissão

Registre data, versão/commit, Chrome, locale, ID e resultado, sem tokens ou códigos:

- Vincular pelo consentimento Branilist e conferir a conta no popup; cancelar e negar
  consentimento devem mostrar erro recuperável sem gravar credenciais novas.
- Confirmar que callback errado não troca código; renovar sessão, verificar `/me`
  e desvincular, inclusive offline. Não copiar tokens para documentação.
- Em uma conta de teste no Crunchyroll, abrir episódio em pt-BR e en-US: abrir a
  página e ficar abaixo de 90% não atualizam a lista; cruzar 90% com match seguro
  atualiza uma vez. Verificar resultado no Branilist.
- Testar episódio seguinte via SPA, metadados atrasados, troca de vídeo, temporadas,
  especiais, anúncios e player em iframe. Metadados ausentes/incertos devem bloquear.
  A extensão não acessa iframes de outros hosts nem contorna controles do player.
- Se o DOM real não expuser JSON-LD suficiente, registrar fixture sanitizada e
  ajustar o parser antes de anunciar compatibilidade. Não habilitar fallback genérico.
- Gerar match ambíguo: não deve haver chamada a `/tracking/events`. Abrir Branilist
  não confirma mapping. Revisão de catálogo requer operador; o popup não escolhe
  candidatos nem cria mappings globais.
- Interromper a rede na escrita, fechar popup, reiniciar service worker e tentar
  novamente: mesmo Idempotency-Key, occurredAt e payload. Conferir progresso único.
- Confirmar que logout remove eventos e que outra conta não recebe retries anteriores.

## Listagem, privacidade e submissão

Prepare descrição, ícones, capturas do popup e informações de suporte exigidas pelo
painel. Informe finalidade única: sincronizar progresso de anime assistido no
Crunchyroll com a conta Branilist. Netflix e Comikey estão desativados.

Justificativas das permissões: `identity` abre o login Branilist; `storage` guarda
credenciais e eventos para retry; hosts Crunchyroll permitem detecção; host Branilist
permite chamadas OAuth/API. A permissão opcional genérica de todos os sites foi removida.
Todo código executável está no pacote; não há código remoto.

Publique uma política de privacidade que reflita o serviço: a extensão envia ao
Branilist metadados da obra, episódio, temporada quando presente, progresso, URL
sem query/fragmento e horário do evento. Armazena localmente tokens, última mídia e
até 100 eventos. Tokens não são enviados ao Crunchyroll. Logout remove esses dados;
desinstalar remove o armazenamento da extensão. A retenção no backend deve ser
confirmada pelo operador e descrita na política pública antes de enviar à loja.

Preencha Listagem, Privacidade e Distribuição no painel, execute o smoke acima e
então envie para revisão. Use publicação adiada se quiser controlar a liberação
após aprovação. O ZIP inicial é para obter o ID; não significa publicação aprovada.
