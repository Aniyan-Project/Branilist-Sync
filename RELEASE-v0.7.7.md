# Branilist Sync v0.7.7

Correção da identidade de correspondência do Crunchyroll entre episódios.

## Problema
Alguns payloads do Crunchyroll não expõem season_id de forma confiável. O fallback anterior podia usar episode_id ou series_id, fazendo a correção manual ser específica demais ou ampla demais.

## Solução
- identidade estável por temporada baseada em series_id + season_slug_title;
- todos os episódios da mesma temporada reutilizam a mesma correspondência;
- temporadas diferentes da mesma série permanecem separadas;
- fallback seguro quando season_slug_title estiver ausente;
- migração automática de mappings antigos por season_id ou episode_id;
- mappings antigos por series_id não são migrados automaticamente para evitar aplicar uma temporada em outra.

## Compatibilidade
- versão 0.7.7;
- mesmo Chrome Web Store ID;
- sem backend novo;
- sem migration/deploy na OVH.
