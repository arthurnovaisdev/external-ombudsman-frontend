# Ouvidoria MBFREIRE — frontend

Frontend React e TypeScript da Ouvidoria MBFREIRE. A fundação, os contratos HTTP, o design system e o fluxo de autenticação estão implementados. As áreas CLIENT e ADMIN ainda são páginas mínimas de navegação; as telas de negócio serão integradas em etapas futuras.

## Desenvolvimento

Requer Node.js compatível com Vite 8. Instale as dependências com `npm install` e execute `npm run dev`. O servidor de desenvolvimento usa a porta 5173.

Copie os valores públicos de `.env.example` para a configuração local. `VITE_API_BASE_URL` aponta para o backend e `VITE_ATTACHMENTS_ENABLED` permanece `false` no MVP. O frontend não deve conter segredos.

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

Os tipos em `src/shared/api/contracts.ts` espelham os records do backend, incluindo os campos anuláveis. Há módulos de API para as rotas existentes de autenticação, conta, usuários, categorias, manifestações, mensagens e anexos. Login, `/api/users/me`, troca de senha e recuperação de senha estão conectados às telas nesta etapa. O JWT é mantido somente por `memoryToken`; não há persistência, refresh token, cookies nem CSRF. O servidor continua sendo a autoridade sobre papéis e propriedade dos recursos.

O cliente HTTP interpreta os dois formatos de erro do backend (`erro` e `detalhes`), classifica os status conhecidos, lê `Retry-After` como segundos inteiros válidos e aceita cancelamento e timeout. Os anexos continuam desabilitados por padrão na configuração pública; quando a interface for implementada, ela deve respeitar `VITE_ATTACHMENTS_ENABLED`. O backend também pode responder 503 para anexos desabilitados.

## Sessão e navegação

Após `POST /api/auth/login`, o frontend usa o Bearer recebido para consultar `GET /api/users/me`. A sessão só é liberada se o perfil estiver ativo e os dados de papel/primeiro acesso coincidirem com a resposta do login. Nenhuma permissão é deduzida do conteúdo do JWT. A página recarregada perde token e usuário. Logout é local: remove token, usuário e cache do TanStack Query, sem endpoint remoto. Qualquer resposta HTTP 401 executa a mesma limpeza.

As rotas públicas, autenticadas, de primeiro acesso, CLIENT e ADMIN são protegidas apenas para navegação. Primeiro acesso apresenta somente consulta ao perfil, troca de senha e saída local; a troca bem-sucedida invalida a sessão e exige novo login. O backend deve continuar validando toda requisição e propriedade de dados. As páginas `/client`, `/admin` e `/account` não simulam funcionalidades de negócio.

Os layouts autenticados são separados por perfil. `CLIENT` vê Início, Manifestações e Minha conta; `ADMIN` vê Dashboard, Manifestações, Clientes, Categorias e Minha conta. Ambos oferecem Sair local. O cabeçalho desktop e o menu móvel indicam a rota ativa; há skip link, foco visível e fechamento do menu por Escape. Nomes longos são truncados visualmente no cabeçalho desktop, mas permanecem completos para tecnologias assistivas e no menu móvel. Durante a consulta a `/api/users/me`, o login informa que o perfil está carregando. As novas seções de navegação são apenas estruturais, sem dados ou operações fictícias. A rota antiga `/account` redireciona à conta do perfil autenticado.

As páginas públicas `/esqueci-senha` e `/reset-password` usam os endpoints existentes. A solicitação de recuperação envia apenas `username` e apresenta uma resposta genérica, sem indicar a existência ou o estado da conta. O token do link de redefinição é capturado na inicialização e removido da URL antes da renderização; a página aplica `no-referrer` e envia somente `token` e `newPassword`. A confirmação é local. A entrega do HTML pelo servidor de hospedagem deve manter uma política de referer igualmente restritiva, pois o frontend não controla os cabeçalhos da resposta inicial.

### Pendência: envelope paginado

Os controllers declaram `Page<T>`, mas o backend local não respondeu em `http://localhost:8080` durante esta etapa. **Não foi validado o JSON paginado real.** Por isso, `src/shared/api/page.ts` isola o decoder e consome somente `content`, sem tipar ou expor metadados de paginação não confirmados em execução. Os handlers MSW testam a seleção de página e tamanho com uma resposta mínima `{ content: [...] }`; isso é simulação, não prova do envelope real. Antes de construir controles de paginação, validar uma resposta autenticada de `/api/reports/mine`, `/api/reports/admin`, `/api/users`, `/api/categories` e das rotas de mensagens, e então ajustar o decoder conforme o JSON observado.

## Design system

Os componentes compartilhados em `src/shared/components` seguem a pré-visualização aprovada: fundo quase preto, superfícies cinza-escuras, ações em âmbar e encerramento em verde. `StatusBadge` calcula o texto visual somente a partir de `closedAt` (`null` → “Em andamento”; valor preenchido → “Encerrada”), sem status próprio no frontend. Formulários associam labels, dicas e erros; o modal prende e restaura o foco; tabelas podem ser percorridas horizontalmente pelo teclado.

Em desenvolvimento, `/design-system` mostra exemplos visuais dos componentes, explicitamente sem dados ou operações reais. Essa rota não é incluída no roteamento de produção. Para executar os testes de navegador em uma máquina sem o Chromium do Playwright, use o Edge instalado: no PowerShell, `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:e2e`.
