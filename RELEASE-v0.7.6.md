# Branilist Sync v0.7.6

Correção da hidratação da aba Atual após troca SPA de episódio.

## Problema
A detecção e a resolução do episódio novo já estavam corretas, mas o popup ainda usava lastSync para montar o cartão Branilist. Como lastSync podia pertencer ao episódio anterior, o bloco com capa, título e controles desaparecia no episódio novo.

## Correção
- persiste o resultado mais recente de TRACKER_DETECTED em currentResolution;
- currentResolution contém a mídia, ResolveResult e horário da resolução;
- AUTH_STATUS expõe currentResolution para o popup;
- a aba Atual hidrata a correspondência usando currentResolution do episódio atual;
- lastSync continua sendo usado apenas para estado de sincronização/progresso;
- o pill Sincronizado só fica ativo quando lastSync pertence ao mesmo canonicalUrl do episódio atual;
- currentResolution é limpo ao sair de /watch, login/logout e em falha de resolução.

## Compatibilidade
- versão 0.7.6;
- mesmo Chrome Web Store ID;
- sem backend novo;
- sem migration/deploy na OVH.
