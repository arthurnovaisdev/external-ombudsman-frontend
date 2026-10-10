import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { AppRoutes } from '../../app/router/AppRoutes'
import { AuthProvider } from '../auth/AuthProvider'
import { memoryToken } from '../../shared/auth/memoryToken'
import type { ReportResponseDTO } from '../../shared/api/contracts'
import { fixtures } from '../../test/handlers'
import { server } from '../../test/server'
import { summarizeDescription } from './presentation'

const url = 'http://localhost:8080/api/reports/mine'

function renderFlow() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/login']}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>
    </QueryClientProvider>,
  )
}

async function login() {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'cliente')
  await user.type(screen.getByLabelText(/^Senha/), 'senha-correta')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { name: 'Área do cliente' })
  return user
}

function page(items: readonly ReportResponseDTO[], number: number, size: number) {
  return {
    content: items.slice(number * size, (number + 1) * size),
    number, size, totalElements: items.length, totalPages: Math.ceil(items.length / size),
  }
}

afterEach(() => memoryToken.clear())

it('dashboard usa /me e a primeira página, mostra apenas total geral e recentes na ordem recebida', async () => {
  const calls: string[] = []
  server.use(http.get(url, ({ request }) => {
    calls.push(new URL(request.url).search)
    return HttpResponse.json({
      content: [fixtures.closedReport, fixtures.report], number: 0, size: 5,
      totalElements: 23, totalPages: 5,
    })
  }))
  renderFlow()
  await login()
  expect(await screen.findByText('23')).toBeInTheDocument()
  expect(calls).toContain('?page=0&size=5')
  expect(within(screen.getByRole('main')).getByText('Cliente Exemplo', { selector: 'strong' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nova manifestação' })).toHaveAttribute('href', '/client/manifestacoes/nova')
  expect(screen.getByRole('link', { name: 'Ver todas as manifestações' })).toHaveAttribute('href', '/client/manifestacoes')
  expect(screen.getByRole('heading', { name: 'Manifestações recentes' })).toBeInTheDocument()
  expect(screen.getByText('Encerrada')).toBeInTheDocument()
  expect(screen.getByText('Em andamento')).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /Ver detalhes da manifestação/ })[0]).toHaveAttribute('href', `/client/manifestacoes/${fixtures.closedReport.protocol}`)
  expect(screen.queryByRole('heading', { name: /abertas|encerradas/i })).not.toBeInTheDocument()
})

it('lista páginas reais sem reordenar e navega ao detalhe próprio', async () => {
  const reports = Array.from({ length: 12 }, (_, index): ReportResponseDTO => ({
    ...fixtures.report,
    protocol: `DEN-2026-AAAAAAA${'ABCDEFGHJKLM'[index]}`,
    description: `Descrição ${index + 1}`,
    createdAt: index === 0 ? '2026-01-01T10:00:00Z' : '2026-10-09T10:00:00Z',
  }))
  const calls: string[] = []
  server.use(http.get(url, ({ request }) => {
    const parsed = new URL(request.url)
    calls.push(parsed.search)
    return HttpResponse.json(page(reports, Number(parsed.searchParams.get('page')), Number(parsed.searchParams.get('size'))))
  }), http.get(`${url}/:protocol`, ({ params }) => {
    const report = reports.find((item) => item.protocol === params.protocol)
    return report ? HttpResponse.json(report) : HttpResponse.json({ status: 404, erro: 'Manifestação não encontrada.', timestamp: '2026-10-09T10:00:00' }, { status: 404 })
  }))
  renderFlow()
  const user = await login()
  await user.click(screen.getByRole('link', { name: 'Ver todas as manifestações' }))
  expect(await screen.findByText('12 manifestações')).toBeInTheDocument()
  expect(calls).toContain('?page=0&size=10')
  const detailLinks = screen.getAllByRole('link', { name: /Ver detalhes da manifestação/ })
  expect(detailLinks).toHaveLength(10)
  expect(detailLinks[0]).toHaveAttribute('href', `/client/manifestacoes/${reports[0].protocol}`)
  expect(detailLinks[1]).toHaveAttribute('href', `/client/manifestacoes/${reports[1].protocol}`)
  expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Próxima' }))
  expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument()
  await waitFor(() => expect(screen.getAllByRole('link', { name: /Ver detalhes da manifestação/ })).toHaveLength(2))
  expect(calls).toContain('?page=1&size=10')
  expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
  await user.click(screen.getAllByRole('link', { name: /Ver detalhes da manifestação/ })[0])
  expect(await screen.findByRole('heading', { name: 'Detalhes da manifestação' })).toBeInTheDocument()
  expect(screen.getByText(reports[10].description)).toBeInTheDocument()
})

it('mostra estados vazios no dashboard e na listagem', async () => {
  server.use(http.get(url, ({ request }) => {
    const parsed = new URL(request.url)
    return HttpResponse.json(page([], Number(parsed.searchParams.get('page')), Number(parsed.searchParams.get('size'))))
  }))
  renderFlow()
  const user = await login()
  expect(await screen.findByText('0')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Nenhuma manifestação registrada' })).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'Ver todas as manifestações' }))
  expect(await screen.findByRole('heading', { name: 'Nenhuma manifestação registrada' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Paginação' })).not.toBeInTheDocument()
})

it('mostra erro com retry no dashboard e na listagem', async () => {
  let dashboardAttempts = 0
  let listAttempts = 0
  server.use(http.get(url, ({ request }) => {
    const size = Number(new URL(request.url).searchParams.get('size'))
    if (size === 5 && ++dashboardAttempts === 1) return HttpResponse.json({ status: 500, erro: 'Falha', timestamp: '2026-10-09T10:00:00' }, { status: 500 })
    if (size === 10 && ++listAttempts === 1) return HttpResponse.json({ status: 500, erro: 'Falha', timestamp: '2026-10-09T10:00:00' }, { status: 500 })
    return HttpResponse.json(page([fixtures.report], 0, size))
  }))
  renderFlow()
  const user = await login()
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar suas manifestações.')
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(await screen.findByText('1')).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'Ver todas as manifestações' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar suas manifestações.')
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(await screen.findByText('1 manifestações')).toBeInTheDocument()
  expect(dashboardAttempts).toBe(2)
  expect(listAttempts).toBe(2)
})

it('exibe carregamento antes da resposta paginada', async () => {
  let release: (() => void) | undefined
  server.use(http.get(url, async ({ request }) => {
    await new Promise<void>((resolve) => { release = resolve })
    const parsed = new URL(request.url)
    return HttpResponse.json(page([fixtures.report], Number(parsed.searchParams.get('page')), Number(parsed.searchParams.get('size'))))
  }))
  renderFlow()
  await login()
  expect(screen.getByLabelText('Carregando manifestações recentes')).toBeInTheDocument()
  await waitFor(() => expect(release).toBeTypeOf('function'))
  await act(async () => { release?.() })
  expect(await screen.findByText('1')).toBeInTheDocument()
})

it('resume descrições longas sem inventar campos', () => {
  expect(summarizeDescription('  Texto\n com   espaços  ')).toBe('Texto com espaços')
  expect(summarizeDescription('a'.repeat(151))).toHaveLength(150)
  expect(summarizeDescription('a'.repeat(151))).toMatch(/…$/)
})
