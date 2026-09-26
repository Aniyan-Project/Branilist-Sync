# Branilist-Sync v0.4.2

Identidade estável de temporada no Crunchyroll e continuação do smoke real de produção.

## Mudanças

- Separa três identidades do Crunchyroll:
  - episódio atual: ID de `/watch/<id>`;
  - temporada: `season_id`;
  - série: `series_id`.
- `season_id` válido passa a ser o `providerMediaId` preferencial enviado ao backend.
- `series_id` fica disponível para diagnóstico, mas não é usado sozinho para liberar tracking automático.
- Sem `season_id`, o comportamento continua conservador usando o ID do episódio.
- IDs conflitantes em metadados embutidos bloqueiam a detecção em vez de escolher arbitrariamente.
- O worker valida que a identidade da temporada está amarrada ao episódio da URL atual.
- O popup exibe IDs públicos de episódio/temporada/série para facilitar smoke e suporte.
- Fixtures cobrem identidade estável, fallback de série e conflitos.
- Manifest/package/lockfile atualizados para 0.4.2.

## Smoke real já concluído

Em produção, com o ID definitivo da extensão `kimfpnbfjfmpkjpcmfnjeoefakhcoclh`:

- OAuth + PKCE concluíram com sucesso;
- callback `https://kimfpnbfjfmpkjpcmfnjeoefakhcoclh.chromiumapp.org/oauth2` funcionou;
- `GET /me` carregou a conta vinculada;
- uma página real do Crunchyroll foi detectada corretamente;
- `/resolve` encontrou um candidato mas exigiu confirmação;
- nenhuma alteração foi feita na lista, confirmando o fail-safe.

## Próximo smoke

Carregar a build 0.4.2 no Chrome e repetir o mesmo episódio. No popup, registrar apenas os IDs públicos exibidos:

- episódio;
- temporada, se presente;
- série, se presente.

Se `season_id` estiver disponível, criar/revisar um mapping de temporada no backend e repetir o teste até 90%. Não cadastrar o ID de série como mapping de temporada quando a série puder conter múltiplas temporadas.

Esta release é exclusiva da extensão e não exige nova release do servidor Branilist.
