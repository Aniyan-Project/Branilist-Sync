# Branilist Sync v0.7.7

Correção da identidade de correspondência no Crunchyroll.

## Problema
Quando a API do Crunchyroll não retornava season_id, a extensão usava o episodeProviderId como providerMediaId. Isso fazia cada episódio parecer uma obra diferente e exigia corrigir a correspondência novamente em E2, E3 etc.

## Correção
- providerMediaId agora segue a ordem:
  1. seasonProviderId;
  2. seriesProviderId;
  3. episodeProviderId apenas como último fallback;
- tanto a detecção pela rede quanto o fallback DOM/JSON-LD usam a mesma regra;
- validação do worker aceita a identidade estável de série quando season não existe.

## Migração prática
- correções antigas salvas por episode ID não são promovidas automaticamente;
- após atualizar para v0.7.7, pode ser necessário corrigir a correspondência uma única vez;
- essa nova correção será salva pela identidade estável da série e deverá valer para os próximos episódios.

## Compatibilidade
- versão 0.7.7;
- mesmo Chrome Web Store ID;
- sem backend novo;
- sem migration/deploy na OVH.
