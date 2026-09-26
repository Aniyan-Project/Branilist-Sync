# Branilist Sync v0.7.1

Hotfix de detecção SPA e diagnóstico de versão.

## Crunchyroll SPA
- detecta mudança do `/watch/{episodeId}` diretamente pela URL visível;
- invalida imediatamente o episódio anterior;
- persiste estado transitório "Mudança de episódio detectada" enquanto os metadados seguros ainda não chegaram;
- continua aguardando canonical/JSON-LD consistentes antes de aceitar os dados completos do novo episódio;
- exibe toast "Mudança de episódio detectada" ao trocar de episódio.

## Diagnóstico
- popup exibe a versão da extensão;
- `chrome://extensions` passa a mostrar 0.7.1 neste artifact, permitindo confirmar que a build nova foi carregada.

## Compatibilidade
- mesmo Chrome Web Store ID;
- sem mudança de OAuth;
- sem backend novo e sem deploy na OVH.
