# Branilist Sync v0.7.5

Hotfix final do fluxo SPA do Crunchyroll e limpeza de contexto.

## Correção principal
- deixa de usar sender.url como identidade do episódio atual em navegação SPA;
- sender.url continua validando origem/top-frame do Crunchyroll;
- o episódio atual é validado pelo canonicalUrl vivo do content script, que deve conter exatamente /watch/{episodeProviderId};
- isso permite E1 → E2 → E3 sem reload mesmo quando o Chrome mantém sender.url preso à URL inicial do documento.

## Fora de episódio
- ao sair de /watch/... para Home, página da série, busca ou outra rota não-episódio:
  - limpa lastDetected;
  - limpa estado de navegação transitório;
  - a aba Atual volta ao estado vazio;
  - não mantém o último episódio como se ainda estivesse ativo.

## Segurança
- canonicalUrl precisa ter mesma origin do sender Crunchyroll;
- episodeProviderId precisa bater com /watch/{id};
- top frame e extension sender continuam obrigatórios.

## Compatibilidade
- versão 0.7.5;
- mesmo Chrome Web Store ID;
- sem backend novo;
- sem migration/deploy na OVH.
