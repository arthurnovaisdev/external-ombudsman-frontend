# Ouvidoria MBFREIRE — frontend

Fundação React e TypeScript do frontend da Ouvidoria MBFREIRE. A aplicação ainda contém apenas a página inicial técnica e o roteamento básico. Os fluxos de autenticação e as telas de negócio serão integrados nas próximas etapas; os contratos e módulos HTTP já estão preparados.

## Desenvolvimento

Requer Node.js compatível com Vite 8. Instale as dependências com `npm install` e execute `npm run dev`. O servidor de desenvolvimento usa a porta 5173.

Copie os valores públicos de `.env.example` para a configuração local quando a integração com a API começar. `VITE_API_BASE_URL` aponta para o backend e `VITE_ATTACHMENTS_ENABLED` permanece `false` no MVP. O frontend não deve conter segredos.

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

Os tipos em `src/shared/api/contracts.ts` espelham os records do backend, incluindo os campos anuláveis. Há módulos de API para as rotas existentes de autenticação, conta, usuários, categorias, manifestações, mensagens e anexos. Eles ainda não são chamados pelas telas. O JWT pode ser fornecido por `memoryToken`; não há persistência, refresh token, cookies nem CSRF. O servidor continua sendo a autoridade sobre papéis e propriedade dos recursos.

O cliente HTTP interpreta os dois formatos de erro do backend (`erro` e `detalhes`), classifica os status conhecidos, lê `Retry-After` como segundos inteiros válidos e aceita cancelamento e timeout. Os anexos continuam desabilitados por padrão na configuração pública; quando a interface for implementada, ela deve respeitar `VITE_ATTACHMENTS_ENABLED`. O backend também pode responder 503 para anexos desabilitados.

### Pendência: envelope paginado

Os controllers declaram `Page<T>`, mas o backend local não respondeu em `http://localhost:8080` durante esta etapa. **Não foi validado o JSON paginado real.** Por isso, `src/shared/api/page.ts` isola o decoder e consome somente `content`, sem tipar ou expor metadados de paginação não confirmados em execução. Os handlers MSW testam a seleção de página e tamanho com uma resposta mínima `{ content: [...] }`; isso é simulação, não prova do envelope real. Antes de construir controles de paginação, validar uma resposta autenticada de `/api/reports/mine`, `/api/reports/admin`, `/api/users`, `/api/categories` e das rotas de mensagens, e então ajustar o decoder conforme o JSON observado.

## Design system

Os componentes compartilhados em `src/shared/components` seguem a pré-visualização aprovada: fundo quase preto, superfícies cinza-escuras, ações em âmbar e encerramento em verde. `StatusBadge` calcula o texto visual somente a partir de `closedAt` (`null` → “Em andamento”; valor preenchido → “Encerrada”), sem status próprio no frontend. Formulários associam labels, dicas e erros; o modal prende e restaura o foco; tabelas podem ser percorridas horizontalmente pelo teclado.

Em desenvolvimento, `/design-system` mostra exemplos visuais dos componentes, explicitamente sem dados ou operações reais. Essa rota não é incluída no roteamento de produção. Para executar os testes de navegador em uma máquina sem o Chromium do Playwright, use o Edge instalado: no PowerShell, `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:e2e`.
