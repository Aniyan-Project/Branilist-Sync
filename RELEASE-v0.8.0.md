# Branilist Sync v0.8.0

Primeira fundação multi-provider da extensão e suporte inicial ao Netflix.

## Multi-provider
- Crunchyroll permanece no fluxo validado da v0.7.7;
- Netflix recebe content script isolado próprio;
- bridge MAIN compartilhado passa a identificar o provider atual;
- diagnóstico do popup deixa de ser específico do Crunchyroll;
- worker valida eventos auxiliares por provider e origem.

## Netflix
- suporte a páginas /watch/{id};
- metadata obtida pelo bridge MAIN via respostas JSON e probe do member API da própria página;
- identidade estável por título + temporada: titleId?s=seasonNumber;
- mudança SPA de episódio sem reload;
- limpeza do estado ao sair do player;
- tracking de progresso pelo elemento de vídeo;
- correção manual reutiliza a identidade estável da temporada;
- filmes de anime são tratados como episódio único.

## Filtro de anime
- títulos Netflix só são enviados ao Branilist quando a página do título indica gêneros de anime;
- filtro por IDs de gêneros conhecidos com fallback conservador por label;
- resultados de elegibilidade ficam em cache por titleId.

## Segurança
- bridge MAIN não recebe tokens nem acesso ao storage;
- metadata passa por validação novamente no content script e no worker;
- watchId, titleId, temporada, origem e providerMediaId precisam ser consistentes;
- eventos de Netflix não podem ser enviados a partir de origem Crunchyroll e vice-versa.

## Backend
- nenhuma migration;
- nenhuma alteração na API;
- o backend atual já suporta provider netflix;
- sem deploy necessário na OVH.
