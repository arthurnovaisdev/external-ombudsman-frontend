# Ouvidoria MBFREIRE — frontend

Frontend React e TypeScript da Ouvidoria MBFREIRE. A fundação, os contratos HTTP, o design system, a autenticação, o dashboard do cliente e a listagem das próprias manifestações estão implementados. A área ADMIN e a criação de manifestação ainda são páginas estruturais.

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

Os tipos em `src/shared/api/contracts.ts` espelham os records do backend, incluindo os campos anuláveis. Há módulos de API para as rotas existentes de autenticação, conta, usuários, categorias, manifestações, mensagens e anexos. Login, `/api/users/me`, troca de senha, recuperação de senha, dashboard, listagem e detalhe das próprias manifestações estão conectados às telas nesta etapa. O JWT é mantido somente por `memoryToken`; não há persistência, refresh token, cookies nem CSRF. O servidor continua sendo a autoridade sobre papéis e propriedade dos recursos.

O cliente HTTP interpreta os dois formatos de erro do backend (`erro` e `detalhes`), classifica os status conhecidos, lê `Retry-After` como segundos inteiros válidos e aceita cancelamento e timeout. Os anexos continuam desabilitados por padrão na configuração pública; quando a interface for implementada, ela deve respeitar `VITE_ATTACHMENTS_ENABLED`. O backend também pode responder 503 para anexos desabilitados.

## Sessão e navegação

Após `POST /api/auth/login`, o frontend usa o Bearer recebido para consultar `GET /api/users/me`. A sessão só é liberada se o perfil estiver ativo e os dados de papel/primeiro acesso coincidirem com a resposta do login. Nenhuma permissão é deduzida do conteúdo do JWT. A página recarregada perde token e usuário. Logout é local: remove token, usuário e cache do TanStack Query, sem endpoint remoto. Qualquer resposta HTTP 401 executa a mesma limpeza.

As rotas públicas, autenticadas, de primeiro acesso, CLIENT e ADMIN são protegidas apenas para navegação. Primeiro acesso apresenta somente consulta ao perfil, troca de senha e saída local; a troca bem-sucedida invalida a sessão e exige novo login. O backend deve continuar validando toda requisição e propriedade de dados. A área ADMIN continua estrutural; o dashboard e a listagem CLIENT exibem dados retornados pela API.

Os layouts autenticados são separados por perfil. `CLIENT` vê Início, Manifestações e Minha conta; `ADMIN` vê Dashboard, Manifestações, Clientes, Categorias e Minha conta. Ambos oferecem Sair local. O cabeçalho desktop e o menu móvel indicam a rota ativa; há skip link, foco visível e fechamento do menu por Escape. Nomes longos são truncados visualmente no cabeçalho desktop, mas permanecem completos para tecnologias assistivas e no menu móvel. Durante a consulta a `/api/users/me`, o login informa que o perfil está carregando. A rota antiga `/account` redireciona à conta do perfil autenticado.

O dashboard CLIENT consulta `/api/users/me` e a primeira página de `/api/reports/mine?page=0&size=5`. O total exibido vem de `totalElements`; não há contadores globais por situação. A listagem usa `page` na URL, tamanho fixo de 10, metadados do servidor e a ordenação definida pelo controller (`createdAt` decrescente), sem filtros ou ordenação local. O detalhe consulta `/api/reports/mine/{protocol}`. O botão “Nova manifestação” leva a uma página explicitamente não funcional até a implementação do formulário.

As páginas públicas `/esqueci-senha` e `/reset-password` usam os endpoints existentes. A solicitação de recuperação envia apenas `username` e apresenta uma resposta genérica, sem indicar a existência ou o estado da conta. O token do link de redefinição é capturado na inicialização e removido da URL antes da renderização; a página aplica `no-referrer` e envia somente `token` e `newPassword`. A confirmação é local. A entrega do HTML pelo servidor de hospedagem deve manter uma política de referer igualmente restritiva, pois o frontend não controla os cabeçalhos da resposta inicial.

### Pendência: envelope paginado

Os controllers declaram `Page<T>`, mas não havia backend escutando em `localhost:8080` nesta etapa. **Não foi validado o JSON paginado real.** Para viabilizar o total e a navegação solicitados, `src/shared/api/page.ts` isola um decoder para `content`, `number`, `size`, `totalElements` e `totalPages` na rota CLIENT. Os handlers MSW simulam esses campos; os demais módulos paginados continuam consumindo apenas `content`. Antes de homologar a listagem, conferir uma resposta HTTP autenticada de `/api/reports/mine` e ajustar o decoder se a serialização efetiva do Spring diferir. Os demais envelopes paginados também continuam pendentes de validação real.

## Design system

Os componentes compartilhados em `src/shared/components` seguem a pré-visualização aprovada: fundo quase preto, superfícies cinza-escuras, ações em âmbar e encerramento em verde. `StatusBadge` calcula o texto visual somente a partir de `closedAt` (`null` → “Em andamento”; valor preenchido → “Encerrada”), sem status próprio no frontend. Formulários associam labels, dicas e erros; o modal prende e restaura o foco; tabelas podem ser percorridas horizontalmente pelo teclado.

Em desenvolvimento, `/design-system` mostra exemplos visuais dos componentes, explicitamente sem dados ou operações reais. Essa rota não é incluída no roteamento de produção. Para executar os testes de navegador em uma máquina sem o Chromium do Playwright, use o Edge instalado: no PowerShell, `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:e2e`.
