# Contribuindo com providers

Providers vivem em `src/providers/` e implementam `TrackerProvider`.

## Regras de segurança
- Provider não pode acessar tokens OAuth.
- Provider não pode importar `core/auth.ts` ou `core/api.ts`.
- Provider não deve fazer requests para domínios terceiros.
- Provider deve extrair apenas o mínimo necessário: identificação da mídia, episódio/capítulo e progresso.
- Nada de `eval`, `new Function`, scripts remotos ou código baixado em runtime.
- Nunca coletar cookies, credenciais, histórico geral, conteúdo de chat, dados de pagamento ou vídeo/áudio.
- Não contornar DRM, paywall ou controles de acesso.

## Checklist de PR
1. Criar `src/providers/<site>.ts`.
2. Adicionar o provider ao registry.
3. Adicionar fixtures sanitizadas/testes para as páginas suportadas.
4. Documentar URLs testadas e comportamento esperado.
5. Informar quais host permissions são necessárias.
6. Confirmar que o provider para de emitir eventos quando não reconhece a mídia com confiança.
