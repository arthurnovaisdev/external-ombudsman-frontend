import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Link, MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { AppRoutes } from '../../app/router/AppRoutes'
import { AuthProvider } from '../auth/AuthProvider'
import { memoryToken } from '../../shared/auth/memoryToken'
import type { ReportMessageResponseDTO } from '../../shared/api/contracts'
import { fixtures } from '../../test/handlers'
import { server } from '../../test/server'

const origin = 'http://localhost:8080'
const detailUrl = `${origin}/api/reports/mine/${fixtures.protocol}`
const messagesUrl = `${detailUrl}/messages`
const foreignProtocol = 'DEN-2026-BBBBBBBB'
const timestamp = '2026-10-09T10:00:00'

function paged<T>(items: T[], number: number, size: number) {
  return { content: items.slice(number * size, (number + 1) * size), number, size, totalElements: items.length, totalPages: Math.ceil(items.length / size) }
}

function renderFlow(foreignLink = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          {foreignLink && <Link to={`/client/manifestacoes/${foreignProtocol}`}>Abrir outro protocolo</Link>}
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

async function loginAndOpen(protocol = fixtures.protocol) {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'cliente')
  await user.type(screen.getByLabelText(/^Senha/), 'senha-correta')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  if (protocol === foreignProtocol) {
    await user.click(await screen.findByRole('link', { name: 'Abrir outro protocolo' }))
  } else {
    await user.click(await screen.findByRole('link', { name: 'Ver todas as manifestações' }))
    const link = screen.getAllByRole('link', { name: /Ver detalhes da manifestação/ }).find((item) => item.getAttribute('href')?.endsWith(protocol))
    expect(link).toBeDefined()
    await user.click(link!)
  }
  await screen.findByRole('heading', { name: 'Detalhes da manifestação' })
  return user
}

afterEach(() => memoryToken.clear())

it('mostra dados, mensagens na ordem do backend e nunca expõe username de ADMIN', async () => {
  const messages: ReportMessageResponseDTO[] = [
    { ...fixtures.message, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', body: 'Primeira mensagem', authorRole: 'ADMIN', authorName: 'Admin Interno', authorUsername: 'segredo.admin', createdAt: '2026-10-09T10:00:00Z' },
    { ...fixtures.message, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', body: 'Segunda mensagem', createdAt: '2026-10-09T11:00:00Z' },
  ]
  const pages: string[] = []
  server.use(
    http.get(detailUrl, () => HttpResponse.json({ ...fixtures.report, incidentDate: '2026-10-08', incidentLocation: 'Escritório' })),
    http.get(messagesUrl, ({ request }) => {
      pages.push(new URL(request.url).search)
      return HttpResponse.json(paged(messages, 0, 20))
    }),
  )
  renderFlow()
  await loginAndOpen()
  expect(await screen.findByText('Primeira mensagem')).toBeInTheDocument()
  expect(screen.getByText('Segunda mensagem')).toBeInTheDocument()
  expect(screen.getByText(fixtures.protocol)).toBeInTheDocument()
  expect(screen.getByText('Atendimento')).toBeInTheDocument()
  expect(screen.getByText('Relato de teste')).toBeInTheDocument()
  expect(screen.getByText('2026-10-08')).toBeInTheDocument()
  expect(screen.getByText('Escritório')).toBeInTheDocument()
  expect(screen.getByText('Em andamento')).toBeInTheDocument()
  expect(screen.getByText('Equipe da Ouvidoria')).toBeInTheDocument()
  expect(screen.queryByText('segredo.admin')).not.toBeInTheDocument()
  expect(screen.queryByText('Admin Interno')).not.toBeInTheDocument()
  const history = within(screen.getByRole('region', { name: 'Histórico de mensagens' })).getByRole('list')
  expect(within(history).getAllByText(/mensagem/i).map((item) => item.textContent)).toEqual(['Primeira mensagem', 'Segunda mensagem'])
  expect(pages).toContain('?page=0&size=20')
  expect(screen.queryByText(/anexo/i)).not.toBeInTheDocument()
})

it('pagina mensagens crescentes sem ordenação local', async () => {
  const items = Array.from({ length: 21 }, (_, index): ReportMessageResponseDTO => ({
    ...fixtures.message,
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    body: `Mensagem ${index + 1}`,
    createdAt: index === 0 ? '2026-10-09T12:00:00Z' : '2026-10-09T10:00:00Z',
  }))
  const pages: string[] = []
  server.use(http.get(messagesUrl, ({ request }) => {
    const url = new URL(request.url)
    pages.push(url.search)
    return HttpResponse.json(paged(items, Number(url.searchParams.get('page')), Number(url.searchParams.get('size'))))
  }))
  renderFlow()
  const user = await loginAndOpen()
  expect(await screen.findByText('Mensagem 1')).toBeInTheDocument()
  expect(screen.getByText('Mensagem 20')).toBeInTheDocument()
  expect(screen.queryByText('Mensagem 21')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Próxima' }))
  expect(await screen.findByText('Mensagem 21')).toBeInTheDocument()
  expect(screen.queryByText('Mensagem 1')).not.toBeInTheDocument()
  expect(pages).toContain('?page=1&size=20')
})

it('espera HTTP 201 antes de limpar o campo e atualizar o histórico', async () => {
  const items = [fixtures.message]
  let release: (() => void) | undefined
  let posts = 0
  server.use(
    http.get(messagesUrl, ({ request }) => {
      const url = new URL(request.url)
      return HttpResponse.json(paged(items, Number(url.searchParams.get('page')), Number(url.searchParams.get('size'))))
    }),
    http.post(messagesUrl, async ({ request }) => {
      posts += 1
      expect(await request.json()).toEqual({ body: 'Nova resposta' })
      await new Promise<void>((resolve) => { release = resolve })
      const created = { ...fixtures.message, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', body: 'Nova resposta' }
      items.push(created)
      return HttpResponse.json(created, { status: 201 })
    }),
  )
  renderFlow()
  const user = await loginAndOpen()
  await screen.findByText('Mensagem de teste')
  const field = screen.getByRole('textbox', { name: 'Mensagem' })
  await user.type(field, 'Nova resposta')
  const button = screen.getByRole('button', { name: 'Enviar mensagem' })
  fireEvent.submit(button.closest('form')!)
  fireEvent.submit(button.closest('form')!)
  await waitFor(() => expect(posts).toBe(1))
  expect(field).toHaveValue('Nova resposta')
  expect(screen.queryByText('Nova resposta', { selector: 'p' })).not.toBeInTheDocument()
  await act(async () => { release?.() })
  expect(await screen.findByText('Nova resposta', { selector: 'p' })).toBeInTheDocument()
  expect(field).toHaveValue('')
  expect(screen.getByText('Mensagem enviada.')).toBeInTheDocument()
})

it('valida limite de 10.000 caracteres e preserva a mensagem quando o servidor rejeita', async () => {
  let posts = 0
  server.use(http.post(messagesUrl, () => {
    posts += 1
    return HttpResponse.json({ status: 400, detalhes: { body: 'Mensagem inválida no servidor.' }, timestamp }, { status: 400 })
  }))
  renderFlow()
  const user = await loginAndOpen()
  await screen.findByText('Mensagem de teste')
  const field = screen.getByRole('textbox', { name: 'Mensagem' })
  fireEvent.change(field, { target: { value: 'a'.repeat(10_001) } })
  await user.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
  expect(await screen.findByText('Use no máximo 10.000 caracteres.')).toBeInTheDocument()
  expect(posts).toBe(0)
  fireEvent.change(field, { target: { value: 'Resposta válida' } })
  await user.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
  expect(await screen.findByText('Mensagem inválida no servidor.')).toBeInTheDocument()
  expect(field).toHaveValue('Resposta válida')
  expect(posts).toBe(1)
})

it('mantém histórico de manifestação encerrada e não oferece envio', async () => {
  const closed = fixtures.closedReport
  server.use(
    http.get(`${origin}/api/reports/mine/${closed.protocol}`, () => HttpResponse.json({ ...closed, messagesPurgedAt: null })),
    http.get(`${origin}/api/reports/mine/${closed.protocol}/messages`, () => HttpResponse.json(paged([fixtures.message], 0, 20))),
  )
  renderFlow()
  await loginAndOpen(closed.protocol)
  expect(await screen.findByText('Mensagem de teste')).toBeInTheDocument()
  expect(screen.getByText('Encerrada')).toBeInTheDocument()
  expect(screen.queryByText('O histórico de mensagens foi removido conforme a política de retenção.')).not.toBeInTheDocument()
  expect(screen.getByText(/novas mensagens não são permitidas/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Enviar mensagem' })).not.toBeInTheDocument()
})

it('não substitui aviso de retenção por estado de nenhuma mensagem', async () => {
  renderFlow()
  await loginAndOpen(fixtures.closedReport.protocol)
  expect(await screen.findByText('O histórico de mensagens foi removido conforme a política de retenção.')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByLabelText('Carregando mensagens')).not.toBeInTheDocument())
  expect(screen.queryByText('Nenhuma mensagem')).not.toBeInTheDocument()
})

it('trata protocolo de outro cliente como 404 sem consultar mensagens', async () => {
  let messagesCalls = 0
  server.use(http.get(`${origin}/api/reports/mine/${foreignProtocol}/messages`, () => {
    messagesCalls += 1
    return HttpResponse.json(paged([], 0, 20))
  }))
  renderFlow(true)
  await loginAndOpen(foreignProtocol)
  expect(await screen.findByRole('heading', { name: 'Manifestação não encontrada' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Histórico de mensagens' })).not.toBeInTheDocument()
  expect(messagesCalls).toBe(0)
})
