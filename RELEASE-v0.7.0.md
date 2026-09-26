# Branilist Sync v0.7.0

Primeira rodada focada em experiência de produto da extensão.

## Atual v2
- exibe fluxo Detectado → Correspondência → Sincronizado;
- mostra horário da última atualização;
- carrega a entrada correspondente da lista quando o match é seguro;
- permite +1 episódio/capítulo diretamente na aba Atual;
- permite alterar status e nota sem abrir Minha Lista;
- mantém link direto para a mídia no Branilist.

## Histórico
- nova aba com até 20 sincronizações recentes;
- mostra sucesso, erro, revisão necessária, ignorado e progresso resultante;
- reaproveita os eventos duráveis do worker, sem backend novo.

## Pendências v2
- candidatos de revisão agora exibem capa, título preferido, formato/ano e ID Branilist;
- deixa de depender de uma lista de IDs crus para diagnóstico.

## Configurações
- liga/desliga sincronização automática;
- liga/desliga toast de detecção;
- duração configurável do toast entre 5 e 120 segundos;
- opção para o botão +1 mover Planejando → Assistindo/Lendo;
- preferências persistidas localmente e sanitizadas no worker.

## Segurança e compatibilidade
- SETTINGS_SET continua restrito ao popup confiável;
- content script só recebe SETTINGS_GET e estado não sensível;
- mesmo OAuth client e mesmo Chrome Web Store ID;
- sem migration e sem release do backend/OVH;
- Branilist v85.32.1 continua suficiente.
