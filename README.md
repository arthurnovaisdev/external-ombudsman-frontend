# Ouvidoria MBFREIRE — frontend

Frontend React e TypeScript da Ouvidoria MBFREIRE. A fundação, os contratos HTTP, o design system, a autenticação, as telas de manifestações do cliente, a gestão de usuários, as telas administrativas de manifestações e a listagem e criação de categorias estão implementados.

## Desenvolvimento

Requer Node.js compatível com Vite 8. Instale as dependências com `npm install` e execute `npm run dev`. O servidor de desenvolvimento usa a porta 5173.

Copie os valores públicos de `.env.example` para a configuração local. `VITE_API_BASE_URL` aponta para o backend e `VITE_ATTACHMENTS_ENABLED` permanece `false` no MVP. O frontend não deve conter segredos.

A identidade visual usa uma única cópia da logo em `src/shared/assets/mbfreire-logo.png` para as telas públicas e o cabeçalho autenticado. O favicon fornecido está em `public/logo.ico` e é referenciado por `index.html`.

## Verificações

| Comando | Objetivo |
| --- | --- |
| `npm run lint` | Análise estática |
| `npm run typecheck` | TypeScript estrito |
| `npm test` | Testes unitários e de componentes |
| `npm run test:e2e` | Testes de navegação com Playwright |
| `npm run build` | Build de produção |

## Contratos observados

O backend fica em `C:\Projects\external-ombudsman`. A autenticação usa JWT no cabeçalho `Authorization: Bearer`; os perfis são `CLIENT` e `ADMIN`. O primeiro acesso limita o usuário ao próprio perfil e à troca de senha. Não há cadastro público, consulta anônima, refresh token nem logout remoto.

Os tipos em `src/shared/api/contracts.ts` espelham os records do backend, incluindo os campos anuláveis. Há módulos de API para as rotas existentes de autenticação, conta, usuários, categorias, manifestações, mensagens e anexos. Login, `/api/users/me`, troca de senha, recuperação de senha, dashboard, listagem e detalhe das próprias manifestações estão conectados às telas nesta etapa. O JWT é mantido somente por `memoryToken`; não há persistência, refresh token, cookies nem CSRF. O servidor continua sendo a autoridade sobre papéis e propriedade dos recursos.

O cliente HTTP interpreta os dois formatos de erro do backend (`erro` e `detalhes`), classifica os status conhecidos, lê `Retry-After` como segundos inteiros válidos e aceita cancelamento e timeout. Os anexos continuam desabilitados por padrão na configuração pública. O detalhe ADMIN só mostra metadados e download quando `VITE_ATTACHMENTS_ENABLED=true`; o backend também pode responder 503 para anexos desabilitados.

## Sessão e navegação

Após `POST /api/auth/login`, o frontend usa o Bearer recebido para consultar `GET /api/users/me`. A sessão só é liberada se o perfil estiver ativo e os dados de papel/primeiro acesso coincidirem com a resposta do login. Nenhuma permissão é deduzida do conteúdo do JWT. A página recarregada perde token e usuário. Logout é local: remove token, usuário e cache do TanStack Query, sem endpoint remoto. Qualquer resposta HTTP 401 executa a mesma limpeza.

As rotas públicas, autenticadas, de primeiro acesso, CLIENT e ADMIN são protegidas apenas para navegação. Primeiro acesso apresenta somente consulta ao perfil, troca de senha e saída local; a troca bem-sucedida invalida a sessão e exige novo login. O backend deve continuar validando toda requisição e propriedade de dados. O dashboard e as listagens CLIENT e ADMIN exibem dados retornados pela API.

Os layouts autenticados são separados por perfil. `CLIENT` vê Início, Manifestações e Minha conta; `ADMIN` vê Dashboard, Manifestações, Clientes, Categorias e Minha conta. Ambos oferecem Sair local. O cabeçalho desktop e o menu móvel indicam a rota ativa; há skip link, foco visível e fechamento do menu por Escape. Nomes longos são truncados visualmente no cabeçalho desktop, mas permanecem completos para tecnologias assistivas e no menu móvel. Durante a consulta a `/api/users/me`, o login informa que o perfil está carregando. A rota antiga `/account` redireciona à conta do perfil autenticado.

“Minha conta” consulta `/api/users/me` para `CLIENT` e `ADMIN` e apresenta nome, username, e-mail de contato, perfil e estado da troca de senha provisória somente para leitura. Não há edição de perfil. A alteração de senha valida a senha atual (até 100 caracteres), a nova (6 a 100) e a confirmação local; envia apenas `currentPassword` e `newPassword` para `PATCH /api/users/me/password`. Somente após HTTP 204, o fluxo compartilhado apaga JWT, usuário e todo o cache, apresenta “Senha alterada. Entre novamente.” e redireciona a `/login`.

O dashboard CLIENT consulta `/api/users/me` e a primeira página de `/api/reports/mine?page=0&size=5`. O total exibido vem de `totalElements`; não há contadores globais por situação. A listagem usa `page` na URL, tamanho fixo de 10, metadados do servidor e a ordenação definida pelo controller (`createdAt` decrescente), sem filtros ou ordenação local. O detalhe consulta `/api/reports/mine/{protocol}` e o histórico em `/api/reports/mine/{protocol}/messages?page&size`, com páginas de 20 na ordem crescente fornecida pelo backend. O envio usa `POST /api/reports/mine/{protocol}/messages` somente para manifestações abertas; não há mensagem otimista. O cache é invalidado após HTTP 201. Administradores aparecem como “Equipe da Ouvidoria”, sem username. Manifestação encerrada permanece legível, mas não oferece envio; `messagesPurgedAt` gera aviso de retenção. O detalhe CLIENT não inventa listagem de anexos.

O dashboard ADMIN consulta a primeira página de `/api/reports/admin?page=0&size=5`, mostra o total de `totalElements`, registros recentes e atalhos para clientes e categorias. A listagem ADMIN usa páginas de 10, mostra protocolo, cliente, categoria, resumo, criação e situação derivada de `closedAt`. O controller define criação decrescente. Não há filtros, busca, ordenação local ou contadores separados por situação. O detalhe ADMIN consulta `/api/reports/admin/{protocol}` e mensagens paginadas em ordem crescente; mostra os dados confirmados do proprietário, a manifestação e o histórico. Respostas são permitidas somente enquanto `closedAt=null` e só entram na interface após HTTP 201. O encerramento exige modal de confirmação, espera o retorno do servidor e invalida detalhe, listas, dashboard e mensagens. Não há reabertura, upload ou exclusão administrativa de anexos.

A área Clientes consulta `/api/users?page&size` em páginas de 20 na ordem de nome definida pelo backend. A tabela mostra apenas nome, username, e-mail, perfil, situação e ação; a API lista usuários `CLIENT` e `ADMIN`, sem campo de criação. O cadastro envia nome, username, e-mail opcional e senha provisória para `POST /api/auth/register`; não envia `role`, que o servidor define como `CLIENT`. O e-mail é recomendado para recuperação de senha, mas não obrigatório. Ativar e desativar exigem confirmação e aguardam HTTP 204 antes de invalidar a lista. A própria conta não oferece desativação, identificada pelo ID de `/api/users/me`; o backend continua responsável por bloquear a operação. A desativação invalida tokens anteriores. Não há edição, exclusão, criação de administrador ou redefinição administrativa de senha.

O cadastro de manifestação carrega `GET /api/categories?page&size` em páginas de 50, com ação para carregar páginas adicionais e exibindo apenas categorias ativas. Envia somente os quatro campos de `ReportRequestDTO` em JSON para `POST /api/reports`. A confirmação só aparece após HTTP 201 com protocolo válido; lista e dashboard são invalidados. Categoria removida ou inativa, validação e limite de requisições têm tratamento próprio. Com `VITE_ATTACHMENTS_ENABLED=false`, a seção de anexos fica oculta e não há chamadas de upload ou download.

A área ADMIN de categorias consulta `GET /api/categories?page&size` em páginas de 20 e apresenta somente categorias ativas, conforme o comportamento do backend. O cadastro mostra a situação inicial fixa “Ativa” e envia apenas `{ name, active: true }` para `POST /api/categories`. Após HTTP 201, invalida todas as consultas de categorias, inclusive o select da nova manifestação. Nome duplicado e validação são tratados no formulário. Não há visualização de inativas, edição, alternância de situação, ativação, desativação ou exclusão.

As páginas públicas `/esqueci-senha` e `/reset-password` usam os endpoints existentes. A solicitação de recuperação envia apenas `username` e apresenta uma resposta genérica, sem indicar a existência ou o estado da conta. O token do link de redefinição é capturado na inicialização e removido da URL antes da renderização; a página aplica `no-referrer` e envia somente `token` e `newPassword`. A confirmação é local. A entrega do HTML pelo servidor de hospedagem deve manter uma política de referer igualmente restritiva, pois o frontend não controla os cabeçalhos da resposta inicial.

### Pendência: envelope paginado

Os controllers declaram `Page<T>`, mas não havia backend autenticado disponível para conferência nesta etapa. **Não foi validado o JSON paginado real.** Para viabilizar totais e navegação, `src/shared/api/page.ts` isola um decoder para `content`, `number`, `size`, `totalElements` e `totalPages` nas rotas CLIENT de manifestações e mensagens e nas rotas ADMIN de manifestações, mensagens, usuários e categorias. Os handlers MSW simulam esses campos. Antes de homologar, conferir respostas HTTP autenticadas de `/api/reports/mine`, `/api/reports/mine/{protocol}/messages`, `/api/reports/admin`, `/api/reports/admin/{protocol}/messages`, `/api/users` e `/api/categories` e ajustar o decoder se a serialização efetiva do Spring diferir. Os demais envelopes paginados também continuam pendentes de validação real.

## Design system

Os componentes compartilhados em `src/shared/components` seguem a pré-visualização aprovada: fundo quase preto, superfícies cinza-escuras, ações em âmbar e encerramento em verde. `StatusBadge` calcula o texto visual somente a partir de `closedAt` (`null` → “Em andamento”; valor preenchido → “Encerrada”), sem status próprio no frontend. Formulários associam labels, dicas e erros; o modal prende e restaura o foco; tabelas podem ser percorridas horizontalmente pelo teclado.

Em desenvolvimento, `/design-system` mostra exemplos visuais dos componentes, explicitamente sem dados ou operações reais. Essa rota não é incluída no roteamento de produção. Para executar os testes de navegador em uma máquina sem o Chromium do Playwright, use o Edge instalado: no PowerShell, `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:e2e`.
