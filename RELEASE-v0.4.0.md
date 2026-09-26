# Branilist-Sync v0.4.0

Preparação para produção e Chrome Web Store. Release exclusiva da extensão;
não exige nova release do servidor Branilist.

- Parser Crunchyroll conservador: JSON-LD localizado, grafos, referências de série/
  temporada, identidade da página e rejeição de metadados antigos ou conflitantes.
  O nome do site e cards de recomendações nunca são usados como título da série.
- Temporadas continuam no payload para preservar a revisão de numbering do backend.
  Episódios fracionários, progresso inválido e origens não suportadas são bloqueados.
- Eventos persistidos antes da escrita; retries reutilizam ID e payload após falha
  de rede ou reinício do worker. Chamadas e mudanças de conta são serializadas.
- Resolução insegura/malformada bloqueia escrita. Popup mostra pendências, erros,
  revisão e retry; não oferece confirmação que burle o contrato do backend.
- Callback OAuth exato, parâmetros únicos e PKCE S256; falhas transitórias de
  refresh preservam credenciais. Diagnóstico exibe ID/client/callback sem tokens.
- Build portátil e content script IIFE, verificação do pacote, lockfile e artefatos
  de CI em Linux/Windows. Removida permissão opcional de todos os hosts.
- Fixtures sintéticas e testes de parser, ciclo de vídeo, OAuth, origem de mensagens,
  falhas/retries e bloqueio de escritas.

## Limitações para publicação

Ainda não existe item na Chrome Web Store. Criar o rascunho, obter chave/ID,
provisionar o client e executar login/playback real são passos pendentes em
[CHROME-WEB-STORE.md](docs/CHROME-WEB-STORE.md). Fixtures não certificam o DOM real.
Mappings ambíguos precisam de revisão por operador; não há endpoint de aprovação
pela extensão. Uma resposta de confirmação já persistida pelo backend pode ser
reproduzida pelo mesmo evento; nesse caso verifique a lista com o operador.

Eventos pendentes não são descartados automaticamente para abrir espaço. Limite
de 100 eventos, removendo primeiro os concluídos; ao atingir 100 pendências é
necessário resolvê-las. Logout limpa os dados locais. Eventos com mais de 30 dias
são recusados pelo backend e exigem revisão manual; não reescrevemos seu horário.

## Verificação

`npm ci`, `npm test`, `npm run typecheck`, `npm run build`.
Depois de obter a identidade real: `npm run check:store -- <ID_DO_ITEM>` e smoke manual.
