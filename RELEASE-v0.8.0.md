# Branilist Sync v0.8.0

Fundação multi-provider e primeiro suporte à Netflix.

## Objetivo

A v0.8.0 começa a separar o lifecycle do content script das regras específicas da Crunchyroll para permitir novos providers sem duplicar o motor de sincronização, OAuth, matching, retries ou interface.

A v0.7.7 enviada anteriormente para revisão na Chrome Web Store permanece intacta no branch `main` até esta versão ser validada.

## Netflix

Suporte inicial para anime em páginas `https://www.netflix.com/watch/<id>`:

- detecção conservadora a partir dos metadados visíveis do player;
- suporte a rótulos de episódio como `S1:E2`, `T1:E2`, `Season 1 Episode 2` e `Temporada 1 Episódio 2`;
- identidade persistente por título + temporada para que uma correção manual possa ser reutilizada nos episódios seguintes;
- watch ID usado como identidade do episódio atual;
- sincronização somente após o threshold existente de 90%;
- navegação SPA remonta o provider quando o watch ID muda;
- sair do player limpa o estado atual;
- metadados incompletos falham de forma segura e não sincronizam.

A identidade baseada em título + temporada é deliberadamente tratada como uma chave de usuário para matching/correção. Ela não é considerada uma prova de identidade global do catálogo.

## Fundação multi-provider

- `providerForUrl`, `providerForHost` e `providerById`;
- content script monta, remonta e desmonta o provider ativo sem assumir Crunchyroll;
- validação de `TRACKER_CLEARED` baseada no provider;
- Crunchyroll mantém o network bridge especializado e a migração de mappings legados;
- Netflix não recebe acesso a tokens Branilist;
- nenhum código remoto foi adicionado.

## Segurança

A mensagem recebida da Netflix só é aceita quando:

- vem do frame principal da própria extensão;
- o host é Netflix;
- a URL canônica é HTTPS e pertence à mesma origem;
- o watch ID declarado corresponde ao watch ID da URL;
- título, temporada e episódio são válidos;
- a identidade de série e temporada é recalculada no service worker e coincide com o payload;
- progresso, quando presente, está entre 0 e 100.

Qualquer inconsistência bloqueia o evento.

## Diagnóstico

Foi adicionado um diagnóstico neutro por provider com:

- provider ativo;
- última detecção;
- última página;
- episódio detectado;
- progresso observado;
- horário em que o player foi deixado.

No Crunchyroll, o painel continua exibindo também as métricas detalhadas do network bridge.

## Manifest / Chrome Web Store

A v0.8.0 adiciona somente:

`https://www.netflix.com/*`

às permissões de host e ao content script principal. O bridge em `MAIN` continua limitado à Crunchyroll.

A Política de Privacidade da branch foi atualizada para refletir Crunchyroll + Netflix antes de uma futura submissão desta versão.

## Validação

Testes adicionados para:

- parser de URL Netflix;
- labels localizadas de temporada/episódio;
- identidade estável por temporada;
- fail-safe com metadados incompletos;
- validação anti-forja das mensagens;
- mount/remount/clear durante navegação SPA na Netflix;
- preservação do fluxo Crunchyroll existente.

Antes do merge/release ainda é obrigatório um smoke real na Netflix para validar o DOM atual do player e a troca real entre episódios.
