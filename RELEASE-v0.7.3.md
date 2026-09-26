# Branilist Sync v0.7.3

Correção e diagnóstico da detecção de episódios no Crunchyroll SPA.

## Rede
- bridge MAIN agora observa todas as respostas JSON de fetch/XHR;
- só depois tenta extrair objetos de episódio;
- remove dependência de heurística por endpoint específico;
- resposta original do player continua intocada.

## Diagnóstico
- heartbeat do bridge ao iniciar;
- contador de respostas JSON observadas;
- última URL JSON vista;
- último episódio extraído e horário;
- painel "Diagnóstico Crunchyroll" visível em Config.;
- versão 0.7.3 visível no popup e chrome://extensions.

## Segurança
- bridge continua sem acesso a tokens/storage;
- payload MAIN → ISOLATED continua serializado;
- metadata continua validada contra o /watch/{episodeId} atual.

## Compatibilidade
- mesmo Chrome Web Store ID;
- sem backend novo;
- sem migration/deploy na OVH.
