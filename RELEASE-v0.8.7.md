# Branilist Sync v0.8.7

Correção da classificação de anime na Netflix.

## Problema observado

Em anime confirmado como Mushoku Tensei, a v0.8.6 retornava:

```
Genre status: genres_not_found
Fonte dos gêneros: none
Anime confirmado: não
```

A Member API continuava fornecendo corretamente série, temporada e episódio, mas a consulta autenticada de `/title/<series-id>` recebia uma variante interna da página sem a seção pública de gêneros.

## Correção

A classificação agora consulta a página pública do título sem cookies da conta Netflix:

- `credentials: omit`
- `cache: no-store`
- `referrerPolicy: no-referrer`

Isso busca a representação pública usada pela própria página de catálogo, onde a Netflix expõe os gêneros do título.

A extração usa três níveis:

1. genre IDs numéricos, quando presentes;
2. elementos estruturados da seção de gêneros;
3. fallback estrutural que encontra apenas um heading localizado de gêneros (por exemplo `Genres`, `Gêneros`, `Géneros`) e analisa somente seu bloco adjacente.

Nunca é feita uma busca global pela palavra `anime` no HTML inteiro.

## Diagnóstico

Foi adicionado:

```
Consulta de gêneros: public
```

Além de:

- Genre status;
- Genre IDs;
- Gêneros textuais;
- Fonte dos gêneros;
- Anime confirmado.

## Segurança e privacidade

A verificação de gênero não envia cookies da conta Netflix.
O HTML obtido não é persistido nem enviado ao Branilist.
Somente os labels/IDs sanitizados e o resultado booleano entram no diagnóstico.

## Fail-closed

Se a página pública também não fornecer gêneros, o título continua sem sincronização até a classificação poder ser confirmada.
