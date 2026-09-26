# Branilist Sync v0.7.2

Detecção de episódios do Crunchyroll baseada na mesma classe de sinal usada por trackers maduros: metadata da própria API de conteúdo da página, sem copiar implementação de terceiros.

## Crunchyroll
- novo bridge em `MAIN` world, iniciado em `document_start`;
- observa respostas JSON relevantes de `fetch` e `XMLHttpRequest` sem modificar a resposta original;
- extrai apenas metadata sanitizada de objetos `type: episode` retornados pela API CMS;
- usa `episodeProviderId`, número do episódio, season, series e títulos retornados pela rede;
- o content script isolado aceita a metadata somente quando o episode ID bate com o `/watch/{id}` atual;
- troca de episódio passa a ser confirmada pela resposta de rede, em vez de depender de canonical/JSON-LD;
- URL, DOM e JSON-LD permanecem apenas como fallback.

## Segurança
- bridge não recebe tokens nem acesso ao storage da extensão;
- comunicação MAIN → ISOLATED usa JSON serializado e limitado;
- payload é validado novamente no mundo isolado;
- respostas de rede são clonadas/lidas sem consumir ou alterar a resposta usada pelo player;
- eventos forjados com episode ID diferente da URL atual são rejeitados.

## Diagnóstico
- versão 0.7.2 visível em chrome://extensions e no popup;
- mantém toast de mudança de episódio.

## Compatibilidade
- mesmo Chrome Web Store ID;
- mesmos scopes OAuth;
- sem backend novo;
- sem migration ou deploy na OVH.
