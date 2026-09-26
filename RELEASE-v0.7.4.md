# Branilist Sync v0.7.4

Correção da detecção SPA do Crunchyroll quando episódios futuros são pré-carregados.

## Causa identificada
O Crunchyroll pode retornar metadata de vários episódios antecipadamente. Portanto, o último episódio observado na rede não é necessariamente o episódio atualmente aberto.

## Correção
- metadata de rede passa a ser armazenada em cache por episodeProviderId;
- a URL ativa /watch/{episodeId} decide qual item do cache deve virar o episódio atual;
- ao navegar E1 → E2, a extensão usa a metadata de E2 já pré-carregada, mesmo que E3 tenha sido recebido depois;
- prefetch de episódios futuros não altera a aba Atual;
- mantém fallback por DOM/JSON-LD quando não houver metadata em cache.

## Diagnóstico
- permanece disponível em Config. → Diagnóstico Crunchyroll.

## Compatibilidade
- mesmo Chrome Web Store ID;
- sem backend novo;
- sem migration/deploy na OVH.
