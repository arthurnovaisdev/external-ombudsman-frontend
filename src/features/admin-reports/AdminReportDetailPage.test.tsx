import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Link, MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/router/AppRoutes'
import { AuthProvider } from '../auth/AuthProvider'
import { memoryToken } from '../../shared/auth/memoryToken'
import type { ReportMessageResponseDTO } from '../../shared/api/contracts'
import { fixtures } from '../../test/handlers'
import { server } from '../../test/server'

const origin = 'http://localhost:8080'
const detailUrl = `${origin}/api/reports/admin/${fixtures.protocol}`
const messagesUrl = `${detailUrl}/messages`
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
          {foreignLink && <Link to="/admin/manifestacoes/DEN-2026-BBBBBBBB">Abrir protocolo inexistente</Link>}
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

async function loginAndOpen(foreign = false) {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'admin')
  await user.type(screen.getByLabelText(/^Senha/), 'senha-correta')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { name: 'Dashboard' })
  await user.click(await screen.findByRole('link', { name: foreign ? 'Abrir protocolo inexistente' : /Ver detalhes da manifestação/ }))
  await screen.findByRole('heading', { name: 'Detalhes da manifestação' })
  return user
}

afterEach(() => {
  memoryToken.clear()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it('mostra detalhe completo e mensagens na ordem do backend sem anexos quando desabilitados', async () => {
  const messages: ReportMessageResponseDTO[] = [
    { ...fixtures.message, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', body: 'Primeira mensagem', authorName: 'Admin Exemplo', authorUsername: 'admin', authorRole: 'ADMIN', createdAt: '2026-10-09T12:00:00Z' },
    { ...fixtures.message, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', body: 'Segunda mensagem', createdAt: '2026-10-09T10:00:00Z' },
  ]
  const pages: string[] = []
  server.use(
    http.get(detailUrl, () => HttpResponse.json({ ...fixtures.report, ownerName: 'Cliente Exemplo', ownerUsername: 'cliente', ownerContactEmail: 'contato@exemplo.com', attachments: [fixtures.attachment], incidentDate: '2026-10-08', incidentLocation: 'Escritório' })),
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
  expect(screen.getByText('Relato de teste')).toBeInTheDocument()
  expect(screen.getByText('2026-10-08')).toBeInTheDocument()
  expect(screen.getByText('Escritório')).toBeInTheDocument()
  expect(screen.getByText('Cliente Exemplo')).toBeInTheDocument()
  expect(screen.getByText('cliente')).toBeInTheDocument()
  expect(screen.getByText('contato@exemplo.com')).toBeInTheDocument()
  expect(screen.getByText('Em andamento')).toBeInTheDocument()
  expect(screen.getByText('Admin Exemplo (admin)')).toBeInTheDocument()
  const history = within(screen.getByRole('region', { name: 'Histórico de mensagens' })).getByRole('list')
  expect(within(history).getAllByText(/mensagem/i).map((item) => item.textContent)).toEqual(['Primeira mensagem', 'Segunda mensagem'])
  expect(pages).toContain('?page=0&size=20')
  expect(screen.queryByRole('heading', { name: 'Anexos' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Baixar anexo/ })).not.toBeInTheDocument()
})

it('pagina mensagens sem reordenar localmente', async () => {
  const items = Array.from({ length: 21 }, (_, index): ReportMessageResponseDTO => ({
    ...fixtures.message, id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    body: `Mensagem ${index + 1}`, createdAt: index === 0 ? '2026-10-09T12:00:00Z' : '2026-10-09T10:00:00Z',
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
  await user.click(screen.getByRole('button', { name: 'Próxima' }))
  expect(await screen.findByText('Mensagem 21')).toBeInTheDocument()
  expect(screen.queryByText('Mensagem 1')).not.toBeInTheDocument()
  expect(pages).toContain('?page=1&size=20')
})

it('aguarda HTTP 201 para limpar a resposta e atualizar mensagens', async () => {
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
      expect(await request.json()).toEqual({ body: 'Resposta administrativa' })
      await new Promise<void>((resolve) => { release = resolve })
      const created = { ...fixtures.message, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', body: 'Resposta administrativa' }
      items.push(created)
      return HttpResponse.json(created, { status: 201 })
    }),
  )
  renderFlow()
  const user = await loginAndOpen()
  await screen.findByText('Mensagem de teste')
  const field = screen.getByRole('textbox', { name: 'Mensagem' })
  await user.type(field, 'Resposta administrativa')
  const form = screen.getByRole('button', { name: 'Enviar resposta' }).closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  await waitFor(() => expect(posts).toBe(1))
  expect(field).toHaveValue('Resposta administrativa')
  expect(screen.queryByText('Resposta administrativa', { selector: 'p' })).not.toBeInTheDocument()
  await act(async () => { release?.() })
  expect(await screen.findByText('Resposta administrativa', { selector: 'p' })).toBeInTheDocument()
  expect(field).toHaveValue('')
})

it('valida o limite de 10.000 caracteres e preserva a resposta rejeitada pelo servidor', async () => {
  let posts = 0
  server.use(http.post(messagesUrl, () => {
    posts += 1
    return HttpResponse.json({ status: 400, detalhes: { body: 'Mensagem inválida no servidor.' }, timestamp }, { status: 400 })
  }))
  renderFlow()
  const user = await loginAndOpen()
  const field = screen.getByRole('textbox', { name: 'Mensagem' })
  fireEvent.change(field, { target: { value: 'a'.repeat(10_001) } })
  await user.click(screen.getByRole('button', { name: 'Enviar resposta' }))
  expect(await screen.findByText('Use no máximo 10.000 caracteres.')).toBeInTheDocument()
  expect(posts).toBe(0)
  fireEvent.change(field, { target: { value: 'Resposta válida' } })
  await user.click(screen.getByRole('button', { name: 'Enviar resposta' }))
  expect(await screen.findByText('Mensagem inválida no servidor.')).toBeInTheDocument()
  expect(field).toHaveValue('Resposta válida')
  expect(posts).toBe(1)
})

it('encerramento exige modal e aguarda HTTP 200 antes de bloquear novas respostas', async () => {
  let release: (() => void) | undefined
  let closes = 0
  let closedAt: string | null = null
  server.use(http.get(detailUrl, () => HttpResponse.json({ ...fixtures.report, ownerName: 'Cliente Exemplo', ownerUsername: 'cliente', ownerContactEmail: null, attachments: [fixtures.attachment], closedAt })), http.post(`${detailUrl}/close`, () => {
    closes += 1
    return new Promise<Response>((resolve) => {
      release = () => {
        closedAt = '2026-10-09T11:00:00Z'
        resolve(HttpResponse.json({ ...fixtures.report, ownerName: 'Cliente Exemplo', ownerUsername: 'cliente', ownerContactEmail: null, attachments: [fixtures.attachment], closedAt }))
      }
    })
  }))
  const client = renderFlow()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const user = await loginAndOpen()
  await user.click(screen.getByRole('button', { name: 'Encerrar manifestação' }))
  const dialog = screen.getByRole('dialog', { name: 'Encerrar manifestação?' })
  expect(within(dialog).getByText(/Novas mensagens e uploads de anexos do cliente serão bloqueados/)).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(closes).toBe(0)
  await user.click(screen.getByRole('button', { name: 'Encerrar manifestação' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar encerramento' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar encerramento' }))
  await waitFor(() => expect(closes).toBe(1))
  expect(screen.getByText('Em andamento')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enviar resposta' })).toBeDisabled()
  await act(async () => { release?.() })
  expect(await screen.findByText('Encerrada')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Enviar resposta' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Encerrar manifestação' })).not.toBeInTheDocument()
  expect(screen.getByText(/novas mensagens e anexos não são permitidos/)).toBeInTheDocument()
  await waitFor(() => {
    const keys = invalidate.mock.calls.map(([options]) => options?.queryKey)
    expect(keys).toContainEqual(['admin-report', fixtures.protocol])
    expect(keys).toContainEqual(['admin-reports'])
    expect(keys).toContainEqual(['admin-report-messages', fixtures.protocol])
  })
})

it('falha de encerramento mantém a manifestação aberta e permite tentar novamente', async () => {
  server.use(http.post(`${detailUrl}/close`, () => HttpResponse.json({ status: 500, erro: 'Falha ao encerrar.', timestamp }, { status: 500 })))
  renderFlow()
  const user = await loginAndOpen()
  await user.click(screen.getByRole('button', { name: 'Encerrar manifestação' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar encerramento' }))
  expect(await screen.findByText('Falha ao encerrar.')).toBeInTheDocument()
  expect(screen.getByText('Em andamento')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enviar resposta' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Encerrar manifestação' })).toBeEnabled()
})

it('manifestação encerrada preserva histórico sem ações de resposta ou reabertura', async () => {
  server.use(http.get(detailUrl, () => HttpResponse.json({ ...fixtures.closedReport, ownerName: 'Cliente Exemplo', ownerUsername: 'cliente', ownerContactEmail: null, attachments: [] })))
  renderFlow()
  await loginAndOpen()
  expect(await screen.findByText('Encerrada')).toBeInTheDocument()
  expect(screen.getByText(/histórico de mensagens foi removido/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Enviar resposta' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Encerrar manifestação' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /reabrir/i })).not.toBeInTheDocument()
})

it('mostra metadados e download somente com flag ativa', async () => {
  vi.stubEnv('VITE_ATTACHMENTS_ENABLED', 'true')
  const objectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:anexo')
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  let downloads = 0
  server.use(http.get(`${detailUrl}/attachments/${fixtures.attachment.id}`, () => {
    downloads += 1
    return new HttpResponse(new Blob(['teste'], { type: 'application/pdf' }), { status: 200 })
  }))
  renderFlow()
  const user = await loginAndOpen()
  expect(await screen.findByRole('heading', { name: 'Anexos' })).toBeInTheDocument()
  expect(screen.getByText('comprovante.pdf', { selector: 'strong' })).toBeInTheDocument()
  expect(screen.getByText(/application\/pdf/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Baixar anexo/ }))
  await waitFor(() => expect(downloads).toBe(1))
  await waitFor(() => expect(objectUrl).toHaveBeenCalledOnce())
  expect(revoke).toHaveBeenCalledWith('blob:anexo')
})

it('protocolo inexistente não consulta mensagens', async () => {
  let messagesCalls = 0
  server.use(
    http.get(`${origin}/api/reports/admin/DEN-2026-BBBBBBBB`, () => HttpResponse.json({ status: 404, erro: 'Manifestação não encontrada.', timestamp }, { status: 404 })),
    http.get(`${origin}/api/reports/admin/DEN-2026-BBBBBBBB/messages`, () => {
      messagesCalls += 1
      return HttpResponse.json(paged([], 0, 20))
    }),
  )
  renderFlow(true)
  await loginAndOpen(true)
  expect(await screen.findByRole('heading', { name: 'Manifestação não encontrada' })).toBeInTheDocument()
  expect(messagesCalls).toBe(0)
})
