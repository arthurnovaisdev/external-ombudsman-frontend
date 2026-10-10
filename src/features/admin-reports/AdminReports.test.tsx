import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { AppRoutes } from '../../app/router/AppRoutes'
import { AuthProvider } from '../auth/AuthProvider'
import { memoryToken } from '../../shared/auth/memoryToken'
import type { ReportAdminSummaryResponseDTO } from '../../shared/api/contracts'
import { fixtures } from '../../test/handlers'
import { server } from '../../test/server'

const url = 'http://localhost:8080/api/reports/admin'

function renderFlow() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/login']}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>
    </QueryClientProvider>,
  )
}

async function login() {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'admin')
  await user.type(screen.getByLabelText(/^Senha/), 'senha-correta')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { name: 'Dashboard' })
  return user
}

function page(items: readonly ReportAdminSummaryResponseDTO[], number: number, size: number) {
  return { content: items.slice(number * size, (number + 1) * size), number, size,
    totalElements: items.length, totalPages: Math.ceil(items.length / size) }
}

afterEach(() => memoryToken.clear())

it('dashboard usa a primeira página, totalElements e atalhos sem contadores por situação', async () => {
  const calls: string[] = []
  const closed = { ...fixtures.summary, protocol: 'DEN-2026-CLOSED01', closedAt: '2026-10-09T11:00:00Z' }
  server.use(http.get(url, ({ request }) => {
    calls.push(new URL(request.url).search)
    return HttpResponse.json({ content: [closed, fixtures.summary], number: 0, size: 5,
      totalElements: 23, totalPages: 5 })
  }))
  renderFlow()
  await login()
  expect(await screen.findByText('23')).toBeInTheDocument()
  expect(calls).toContain('?page=0&size=5')
  const shortcuts = screen.getByRole('navigation', { name: 'Atalhos administrativos' })
  expect(within(shortcuts).getByRole('link', { name: /Clientes/ })).toHaveAttribute('href', '/admin/clientes')
  expect(within(shortcuts).getByRole('link', { name: /Categorias/ })).toHaveAttribute('href', '/admin/categorias')
  expect(screen.getByRole('link', { name: 'Ver todas as manifestações' })).toHaveAttribute('href', '/admin/manifestacoes')
  expect(screen.getByText('Encerrada')).toBeInTheDocument()
  expect(screen.getByText('Em andamento')).toBeInTheDocument()
  expect(screen.getAllByText('Cliente Exemplo')[0]).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /em andamento|encerradas/i })).not.toBeInTheDocument()
})

it('lista dados administrativos e navega por páginas do servidor sem filtros nem ordenação local', async () => {
  const items = Array.from({ length: 12 }, (_, index): ReportAdminSummaryResponseDTO => ({
    ...fixtures.summary,
    protocol: `DEN-2026-AAAAAAA${'ABCDEFGHJKLM'[index]}`,
    description: `Descrição ${index + 1}`,
    ownerName: `Cliente ${index + 1}`,
    ownerUsername: `cliente${index + 1}`,
    createdAt: index === 0 ? '2026-01-01T10:00:00Z' : '2026-10-09T10:00:00Z',
  }))
  const calls: string[] = []
  server.use(http.get(url, ({ request }) => {
    const parsed = new URL(request.url)
    calls.push(parsed.search)
    return HttpResponse.json(page(items, Number(parsed.searchParams.get('page')), Number(parsed.searchParams.get('size'))))
  }))
  renderFlow()
  const user = await login()
  await user.click(screen.getByRole('link', { name: 'Ver todas as manifestações' }))
  expect(await screen.findByText('12 manifestações')).toBeInTheDocument()
  expect(calls).toContain('?page=0&size=10')
  const cards = within(screen.getByRole('main')).getAllByRole('article')
  expect(cards).toHaveLength(10)
  expect(within(cards[0]).getByText(items[0].protocol)).toBeInTheDocument()
  expect(within(cards[0]).getByText('Cliente 1')).toBeInTheDocument()
  expect(within(cards[0]).getByText('(cliente1)')).toBeInTheDocument()
  expect(within(cards[0]).getByText('Descrição 1')).toBeInTheDocument()
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Próxima' }))
  expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument()
  await waitFor(() => expect(within(screen.getByRole('main')).getAllByRole('article')).toHaveLength(2))
  expect(calls).toContain('?page=1&size=10')
  expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
})

it('exibe vazio, carregamento e erro com retry', async () => {
  let release: (() => void) | undefined
  let attempts = 0
  server.use(http.get(url, async ({ request }) => {
    if (++attempts === 1) {
      await new Promise<void>((resolve) => { release = resolve })
      return HttpResponse.json({ status: 500, erro: 'Falha', timestamp: '2026-10-09T10:00:00' }, { status: 500 })
    }
    const parsed = new URL(request.url)
    return HttpResponse.json(page([], Number(parsed.searchParams.get('page')), Number(parsed.searchParams.get('size'))))
  }))
  renderFlow()
  await login()
  expect(screen.getByLabelText('Carregando manifestações recentes')).toBeInTheDocument()
  await waitFor(() => expect(release).toBeTypeOf('function'))
  await act(async () => { release?.() })
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as manifestações.')
  await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(await screen.findByRole('heading', { name: 'Nenhuma manifestação registrada' })).toBeInTheDocument()
  expect(screen.getByText('0')).toBeInTheDocument()
})

it('listagem mostra erro, permite retry e informa quando não há registros', async () => {
  let listAttempts = 0
  server.use(http.get(url, ({ request }) => {
    const parsed = new URL(request.url)
    const size = Number(parsed.searchParams.get('size'))
    if (size === 10 && ++listAttempts === 1) {
      return HttpResponse.json({ status: 500, erro: 'Falha', timestamp: '2026-10-09T10:00:00' }, { status: 500 })
    }
    return HttpResponse.json(page([], Number(parsed.searchParams.get('page')), size))
  }))
  renderFlow()
  const user = await login()
  await user.click(screen.getByRole('link', { name: 'Ver todas as manifestações' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as manifestações.')
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(await screen.findByRole('heading', { name: 'Nenhuma manifestação registrada' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Paginação' })).not.toBeInTheDocument()
  expect(listAttempts).toBe(2)
})
