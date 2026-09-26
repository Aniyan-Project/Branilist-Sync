# Branilist-Sync v0.4.1

- Inclui a chave pública do rascunho da Chrome Web Store no manifest.
- O pacote local mantém o ID `kimfpnbfjfmpkjpcmfnjeoefakhcoclh`.
- CI verifica o ID derivado da chave em Linux e Windows.
- Incrementa a versão para permitir novo upload no mesmo item da loja.
- Atualiza o guia com o callback exato e o comando de provisionamento do backend.

Client: `branilist-sync` (PUBLIC, PKCE S256, sem client secret).
Callback: `https://kimfpnbfjfmpkjpcmfnjeoefakhcoclh.chromiumapp.org/oauth2`.

Pendentes: provisionamento no ambiente do backend, login real, smoke do Crunchyroll
e submissão à revisão da loja. Esta versão não altera o backend nem publica a extensão.
