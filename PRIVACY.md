# Política de Privacidade — Branilist Sync

**Última atualização:** 26 de setembro de 2026

Esta Política de Privacidade descreve como a extensão **Branilist Sync** trata dados quando você a utiliza para sincronizar o progresso de mídias assistidas com sua conta Branilist.

> English version available below.

## 1. Finalidade da extensão

O Branilist Sync tem uma finalidade única: **identificar a mídia e o progresso de reprodução em serviços compatíveis e sincronizar essas informações com a conta Branilist autorizada pelo usuário**.

Na versão **0.8.0**, os serviços de reprodução compatíveis são **Crunchyroll** e **Netflix**. Novos providers somente passam a fazer parte do tratamento descrito aqui quando forem explicitamente adicionados em uma atualização da extensão.

## 2. Dados tratados

Para fornecer a sincronização, a extensão pode tratar as seguintes informações:

- **Dados da conta Branilist:** identificador da conta, nome de usuário, nome de exibição e escopos autorizados retornados pelo Branilist.
- **Dados de autenticação:** access token, refresh token e data de expiração da autorização OAuth.
- **Dados da mídia em reprodução:** provider, identificadores da série/temporada/episódio quando disponíveis, título da obra, título do episódio, temporada, número do episódio ou capítulo e identificadores externos quando disponíveis.
- **Progresso da reprodução:** percentual de progresso necessário para determinar quando um episódio pode ser sincronizado.
- **URL da página de reprodução:** somente a URL necessária para identificar a mídia no provider compatível. Antes de ser utilizada pelo Branilist Sync, ela é reduzida à origem e ao caminho relevante, sem query string ou fragmento.
- **Horário do evento:** data e hora usadas para registrar e repetir com segurança uma sincronização quando necessário.
- **Dados locais de funcionamento e diagnóstico:** configurações da extensão, última mídia detectada, estado de resolução/correspondência, eventos pendentes ou recentes e diagnósticos técnicos relacionados ao provider compatível.

O Branilist Sync **não coleta o histórico geral de navegação** do usuário. O acesso é limitado aos hosts declarados pela extensão e necessários para sua funcionalidade.

## 3. Como os dados são obtidos

Quando o usuário acessa uma página de reprodução compatível, o Branilist Sync pode ler metadados disponíveis na própria página e em respostas de rede utilizadas por essa página para identificar com segurança a obra e o episódio atual.

A extensão não captura o conteúdo de vídeo ou áudio reproduzido.

## 4. Como os dados são usados

Os dados tratados são utilizados exclusivamente para:

1. autenticar a conta Branilist escolhida pelo usuário;
2. identificar a mídia e o episódio ou capítulo atual;
3. localizar ou confirmar a correspondência entre o título do provider e o catálogo Branilist;
4. sincronizar o progresso com a lista do usuário;
5. evitar atualizações duplicadas e repetir operações que falharam temporariamente;
6. exibir estado, histórico recente e diagnósticos da própria sincronização;
7. proteger o fluxo contra mensagens, callbacks e dados inválidos.

Os dados não são utilizados para publicidade, criação de perfil publicitário, crédito, empréstimos ou finalidades não relacionadas à sincronização.

## 5. Armazenamento local

A extensão utiliza `chrome.storage.local` para armazenar informações necessárias ao funcionamento, incluindo:

- tokens OAuth e expiração da sessão;
- preferências e configurações;
- estado da sincronização e eventos necessários para retry;
- mídia detectada e correspondência atual;
- histórico recente e diagnósticos técnicos.

Os tokens são configurados para ficarem acessíveis somente a contextos confiáveis da extensão e **não são enviados para os serviços de streaming compatíveis**.

Ao utilizar a ação de desvincular/sair no Branilist Sync, a extensão revoga os tokens quando possível e remove localmente credenciais, eventos e estados de sincronização associados à conta.

A remoção da extensão também remove o armazenamento local pertencente à extensão conforme o comportamento do navegador.

## 6. Dados enviados ao Branilist

Quando necessário para resolver ou sincronizar uma mídia, a extensão envia por HTTPS para `branilist.com` dados como:

- provider e identificadores da mídia;
- tipo de mídia;
- título, episódio/capítulo e temporada quando disponíveis;
- percentual de progresso;
- URL canônica da página de reprodução;
- horário do evento;
- identificadores externos quando disponíveis.

O token OAuth é enviado somente ao Branilist para autenticar chamadas autorizadas.

O backend do Branilist não utiliza a URL recebida para acessar ou buscar conteúdo do serviço de streaming. Para registros técnicos de tracking, URLs e títulos não são armazenados no log do evento; o backend mantém somente os dados necessários para resultado, idempotência, vínculo com usuário/client e auditoria operacional.

## 7. Retenção

No dispositivo, dados locais permanecem enquanto forem necessários para a extensão funcionar, até serem substituídos, removidos pela própria extensão, apagados no logout/desvinculação ou removidos junto com a extensão.

No Branilist, registros relacionados à sincronização podem ser mantidos pelo tempo necessário para idempotência, segurança, auditoria e operação do serviço, e podem ser eliminados periodicamente. Registros de tracking são vinculados à conta e ao client da extensão e são removidos por cascata quando a conta ou o client correspondente é excluído.

Desvincular a extensão remove as credenciais e o estado local, mas não implica, por si só, exclusão imediata de registros operacionais já processados no servidor.

## 8. Compartilhamento e venda de dados

O Branilist Sync **não vende dados pessoais**.

Os dados não são transferidos para redes de publicidade, data brokers ou terceiros para criação de perfil, marketing ou finalidades não relacionadas ao único propósito da extensão.

Informações necessárias à sincronização são transmitidas somente aos serviços do Branilist. O acesso às páginas dos serviços de streaming compatíveis ocorre localmente no navegador para detectar a mídia; tokens Branilist não são compartilhados com Crunchyroll, Netflix ou outros providers.

## 9. Permissões do Chrome

A extensão utiliza apenas permissões relacionadas à sua funcionalidade:

- **storage:** armazenamento local de autenticação, configurações e estado de sincronização;
- **identity:** fluxo OAuth/PKCE de conexão com a conta Branilist;
- **acesso a `branilist.com`:** autenticação e comunicação com as APIs do Branilist;
- **acesso aos hosts compatíveis de Crunchyroll e Netflix:** identificação da mídia, episódio e progresso necessários à sincronização.

O Branilist Sync não carrega nem executa código JavaScript ou WebAssembly remoto. O código executável da extensão é distribuído dentro do próprio pacote da extensão.

## 10. Segurança

O fluxo de autenticação utiliza OAuth com **PKCE (S256)** e callback específico da extensão. As comunicações com o Branilist utilizam HTTPS.

Aplicamos validações de origem, host, callback, mensagens e payloads antes de aceitar dados ou efetuar uma sincronização. Nenhum sistema é totalmente imune a falhas, mas o projeto procura limitar permissões e dados ao mínimo necessário para sua finalidade.

## 11. Dados que não são necessários

O Branilist Sync não solicita nem precisa de:

- informações financeiras ou de pagamento;
- informações de saúde;
- localização precisa;
- comunicações pessoais, e-mails ou mensagens;
- senhas da conta Google;
- senhas dos serviços de streaming compatíveis;
- conteúdo de vídeo ou áudio reproduzido.

A permissão `identity` é usada para o fluxo de autenticação do Branilist e não para acessar dados da Conta Google do usuário.

## 12. Controle do usuário

O usuário pode, a qualquer momento:

- desativar a sincronização automática nas configurações da extensão;
- desvincular a conta Branilist pelo próprio Branilist Sync;
- revogar a autorização OAuth pelas configurações da conta Branilist;
- remover a extensão do navegador.

Para solicitar exclusão ou exercer outros direitos relacionados aos dados mantidos pela conta Branilist, utilize os canais de suporte do Branilist ou abra uma solicitação no repositório do projeto.

## 13. Alterações desta política

Esta política pode ser atualizada quando a extensão ganhar novos providers, funcionalidades ou quando houver mudanças no tratamento de dados. Alterações relevantes serão registradas neste arquivo com a nova data de atualização.

## 14. Contato

Branilist Sync é mantido pelo projeto Branilist / Aniyan-Project.

- Repositório: https://github.com/Aniyan-Project/Branilist-Sync
- Suporte e questões de privacidade: https://github.com/Aniyan-Project/Branilist-Sync/issues

---

# Privacy Policy — Branilist Sync

**Last updated:** September 26, 2026

This Privacy Policy explains how the **Branilist Sync** browser extension handles data when you use it to synchronize watched-media progress with your Branilist account.

## 1. Extension purpose

Branilist Sync has a single purpose: **identify media and playback progress on supported services and synchronize that information with the Branilist account authorized by the user**.

In version **0.8.0**, the supported playback services are **Crunchyroll** and **Netflix**. Additional providers are covered only after they are explicitly added in an extension update.

## 2. Data handled

To provide synchronization, the extension may handle:

- **Branilist account data:** account ID, username, display name, and granted scopes returned by Branilist.
- **Authentication data:** OAuth access token, refresh token, and authorization expiration time.
- **Playback media data:** provider, series/season/episode identifiers when available, media title, episode title, season, episode or chapter number, and available external IDs.
- **Playback progress:** the progress percentage needed to determine when an episode can be synchronized.
- **Playback page URL:** only the URL needed to identify media on a supported provider. It is reduced to the relevant origin and path without query strings or fragments.
- **Event time:** date and time used to safely record and retry synchronization when necessary.
- **Local operational and diagnostic data:** extension settings, last detected media, matching/resolution state, pending or recent events, and technical diagnostics related to the supported provider.

Branilist Sync **does not collect the user's general browsing history**. Access is limited to extension-declared hosts that are necessary for its functionality.

## 3. How data is obtained

When the user visits a supported playback page, Branilist Sync may read metadata available on the page and network responses used by that page to safely identify the current title and episode.

The extension does not capture the video or audio content being played.

## 4. How data is used

Data is used only to:

1. authenticate the Branilist account selected by the user;
2. identify the current media and episode or chapter;
3. resolve or confirm a mapping between the provider title and the Branilist catalog;
4. synchronize progress with the user's list;
5. prevent duplicate updates and retry temporarily failed operations;
6. display synchronization status, recent history, and diagnostics;
7. protect the flow against invalid messages, callbacks, and data.

Data is not used for advertising, advertising profiles, credit, lending, or purposes unrelated to synchronization.

## 5. Local storage

The extension uses `chrome.storage.local` for information required to operate, including:

- OAuth tokens and session expiration;
- preferences and settings;
- synchronization state and retry events;
- detected media and current mapping/resolution;
- recent history and technical diagnostics.

Tokens are restricted to trusted extension contexts and **are not sent to supported streaming services**.

When the user signs out/unlinks Branilist Sync, the extension revokes tokens when possible and removes local credentials, events, and synchronization state associated with the account.

Removing the extension also removes extension-local storage according to browser behavior.

## 6. Data sent to Branilist

When required to resolve or synchronize media, the extension sends data over HTTPS to `branilist.com`, such as:

- provider and media identifiers;
- media type;
- title, episode/chapter, and season when available;
- playback progress percentage;
- canonical playback-page URL;
- event time;
- external identifiers when available.

The OAuth token is sent only to Branilist to authenticate authorized API requests.

The Branilist backend does not use the received URL to fetch streaming-service content. For technical tracking records, URLs and titles are not stored in the event log; the backend retains only data needed for the result, idempotency, user/client association, and operational auditing.

## 7. Retention

On the device, local data remains only as needed for the extension to operate, until it is replaced, removed by the extension, cleared by sign-out/unlinking, or removed with the extension.

On Branilist, synchronization-related records may be retained as necessary for idempotency, security, auditing, and service operation and may be periodically pruned. Tracking records are associated with the account and extension client and are removed by cascade when the corresponding account or client is deleted.

Unlinking the extension removes local credentials and synchronization state but does not, by itself, immediately delete already processed operational records on the server.

## 8. Sharing and sale of data

Branilist Sync **does not sell personal data**.

Data is not transferred to advertising networks, data brokers, or third parties for profiling, marketing, or purposes unrelated to the extension's single purpose.

Information required for synchronization is transmitted only to Branilist services. Access to supported streaming-service pages happens locally in the browser for media detection; Branilist tokens are not shared with Crunchyroll, Netflix, or other providers.

## 9. Chrome permissions

The extension uses only permissions related to its functionality:

- **storage:** local storage of authentication, settings, and synchronization state;
- **identity:** OAuth/PKCE flow for connecting a Branilist account;
- **access to `branilist.com`:** authentication and Branilist API communication;
- **access to supported Crunchyroll and Netflix hosts:** identification of the media, episode, and progress required for synchronization.

Branilist Sync does not load or execute remote JavaScript or WebAssembly. Executable extension code is distributed inside the extension package.

## 10. Security

Authentication uses OAuth with **PKCE (S256)** and an extension-specific callback. Communications with Branilist use HTTPS.

The project validates origins, hosts, callbacks, messages, and payloads before accepting data or performing synchronization. No system is completely immune to failure, but the project aims to minimize permissions and data to what is necessary for its purpose.

## 11. Data not required

Branilist Sync does not request or require:

- financial or payment information;
- health information;
- precise location;
- personal communications, emails, or messages;
- Google Account passwords;
- passwords for supported streaming services;
- played video or audio content.

The `identity` permission is used for the Branilist authentication flow and not to access the user's Google Account data.

## 12. User control

At any time, users can:

- disable automatic synchronization in extension settings;
- unlink their Branilist account through Branilist Sync;
- revoke OAuth authorization through Branilist account settings;
- remove the extension from the browser.

To request deletion or exercise other rights regarding data held by the Branilist account, use Branilist support channels or open a request in the project repository.

## 13. Changes to this policy

This policy may be updated when the extension gains new providers or features, or when data-handling practices change. Material changes will be recorded in this file with an updated date.

## 14. Contact

Branilist Sync is maintained by the Branilist / Aniyan-Project project.

- Repository: https://github.com/Aniyan-Project/Branilist-Sync
- Support and privacy questions: https://github.com/Aniyan-Project/Branilist-Sync/issues
