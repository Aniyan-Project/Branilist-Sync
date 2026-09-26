# Branilist-Sync v0.5.0

Toast de detecção na página e correção manual segura de correspondência.

## Experiência na página
- Ao detectar uma mídia suportada, a extensão mostra um toast no canto superior direito.
- Match seguro mostra a confirmação do Branilist.
- Match incerto mostra **Corrigir correspondência**.
- O toast usa Shadow DOM para não herdar nem quebrar o CSS do Crunchyroll.
- Nenhum token é exposto ao content script.

## Correção manual
- A busca usa o catálogo público do Branilist.
- Resultados incompatíveis com o tipo da mídia são descartados.
- O usuário escolhe a mídia correta e o service worker salva um override pessoal.
- A escolha vale somente para a conta autenticada.
- Nenhum mapping global é criado pela extensão.
- Quando existe `season_id`, o override pode representar a temporada inteira.
- Sem identidade de temporada, o override fica restrito ao `providerMediaId` disponível.

## Backend necessário
Requer o backend com migration `000104_branilist_sync_user_mappings` e:
`POST /api/extension/v1/mappings/user`.

A extensão deve ser publicada/testada em produção somente depois do backend correspondente estar deployado.

## Verificação
`npm ci`, `npm test`, `npm run typecheck`, `npm run build` e `npm run check:store -- kimfpnbfjfmpkjpcmfnjeoefakhcoclh`.
