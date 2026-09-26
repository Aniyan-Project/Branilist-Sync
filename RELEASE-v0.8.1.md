# Branilist Sync v0.8.1

Hotfix de detecção do player Netflix durante o smoke real da v0.8.0.

## Problema observado

Em reprodução real de **Mushoku Tensei — temporada 1, episódio 1**, o popup mostrava:

```text
Provider: Netflix — inativo
Saiu do player em: ...
```

Isso indicou que o content script estava carregado na Netflix, porém o lifecycle considerava que o usuário havia saído do player quando a rota atual não correspondia exatamente a `/watch/<id>`.

## Correções

- o player Netflix agora pode permanecer ativo por evidência real da página, não apenas pela rota:
  - elemento `<video>`;
  - root do player Netflix;
  - bloco de título do player;
- suporte a rota de watch com prefixo de locale;
- tentativa segura de recuperar o watch ID também de:
  - canonical URL;
  - `og:url`;
  - links `/watch/` dentro do player;
  - atributos `data-videoid` / `data-video-id` dentro do player;
- não envia `TRACKER_CLEARED` enquanto houver evidência real de player ativo;
- mantém fail-safe: se não houver identidade de episódio confiável, o provider fica ativo para diagnóstico, mas não sincroniza.

## Diagnóstico ampliado

O popup agora registra:

- URL/página atual;
- pathname;
- se encontrou `<video>`;
- se encontrou root do player;
- se encontrou bloco de título;
- se encontrou watch ID;
- texto visível do bloco de título;
- horário do último probe.

Isso permite ajustar o parser com dados reais sem coletar cookies, tokens ou respostas privadas da Netflix.

## Segurança

A validação no service worker continua restrita ao frame principal, host Netflix e payload validado. O hotfix não relaxa a validação de eventos de sincronização.

## Validação

Foram adicionados testes para:

- player ativo em rota Netflix que não seja `/watch/<id>`;
- impedir limpeza incorreta do tracker nesses casos;
- recuperação do watch ID por canonical metadata;
- pathname localizado;
- persistência segura do diagnóstico do provider.
