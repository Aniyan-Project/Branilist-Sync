# Branilist-Sync v0.6.1

Polimento de identidade visual e experiência da biblioteca.

## Marca

- Usa a logo oficial enviada pelo projeto no cabeçalho do popup.
- Define a logo oficial como ícone da extensão.
- Inclui asset dedicado em alta resolução para o slot de 128 px.
- A validação do pacote agora confirma que os ícones declarados no manifest existem no artifact final.

## Minha Lista

- Corrige o contrato da extensão com a Library API de produção, usando `episodes` e `chapters` em vez do campo legado `total`.
- Filtro por tipo: Anime, Mangá ou ambos.
- Ordenação por atualização recente, título, progresso ou nota.
- Cards refinados com status legível, progresso e nota.
- Ação rápida `+1` episódio/capítulo sem abrir o detalhe.
- Ao iniciar progresso em uma obra `PLANNING`, o `+1` move o status para `CURRENT`.
- Respeita o total conhecido da obra e não ultrapassa episódios/capítulos disponíveis.
- Estados de carregamento, vazio e erro mais claros.

## Detalhe

- Botão rápido `+1 episódio` / `+1 capítulo`.
- Validação local do progresso máximo antes do envio.
- Feedback de salvamento mais claro.

## Página atual

Quando a detecção possui uma correspondência Branilist segura e já resolvida:

- mostra capa e título seguindo a preferência da conta;
- mostra formato, ano e total conhecido;
- oferece acesso direto à página da mídia no Branilist.

Correspondências incertas continuam sem serem apresentadas como seguras.

## Compatibilidade

- Não requer mudança adicional no backend.
- Requer Branilist v85.32.1 ou posterior, já compatível com Library API e preferências de títulos.
- Mantém o mesmo OAuth client e o mesmo ID da Chrome Web Store.
