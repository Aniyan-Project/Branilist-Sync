# Branilist Sync v0.8.5

Filtro de gênero para a integração Netflix.

## Por que isso existe

A Netflix contém anime, live action, séries, filmes e outros tipos de conteúdo. Apenas detectar um player e um episódio não é suficiente para concluir que o título deve ser sincronizado como anime no Branilist.

A v0.8.5 adiciona uma classificação explícita antes de qualquer detecção/sincronização.

## Estratégia

A abordagem segue a mesma ideia usada publicamente pelo MALSync:

1. o bridge resolve metadata estruturada pela Member API da Netflix;
2. obtém o ID estável da série;
3. consulta `https://www.netflix.com/title/<series-id>`;
4. extrai os IDs do array `genres` embutido na página;
5. compara esses IDs com uma allowlist de gêneros de anime;
6. somente títulos com ao menos um genre ID de anime podem ser emitidos ao content script.

A allowlist inicial segue os IDs usados pela integração Netflix do MALSync, incluindo categorias gerais e históricas de anime.

## Fail-closed

Se acontecer qualquer um destes casos:

- página de título não responde;
- array de gêneros não pode ser extraído;
- gênero não bate com a allowlist;
- resposta é inconsistente;

o Branilist Sync **não detecta a mídia como anime**, não cria entrada em `Atual`, não mostra toast e não sincroniza progresso.

O DOM visual deixou de ser autoridade de sincronização da Netflix. Somente metadata estruturada já confirmada como anime pode gerar uma detecção.

## Diagnóstico

O popup agora também exibe:

- Genre status;
- Genre IDs encontrados;
- Anime confirmado: SIM/não;
- horário da classificação.

## Performance

A classificação é cacheada por series ID durante a sessão da página. Uma série já classificada não precisa consultar novamente a página `/title/<id>` a cada episódio.

Falhas transitórias recebem cooldown antes de nova tentativa.

## Segurança

- somente hosts oficiais da Netflix são aceitos;
- IDs são validados e limitados;
- diagnostics de genre IDs são sanitizados antes de persistir;
- conteúdo HTML completo da página da Netflix não é armazenado nem enviado ao Branilist;
- somente o resultado sanitizado da classificação participa do fluxo da extensão.
