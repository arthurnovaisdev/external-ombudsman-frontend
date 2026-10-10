import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../app/router/AppRoutes'
import { AuthProvider } from '../auth/AuthProvider'
import { memoryToken } from '../../shared/auth/memoryToken'
import type { CategoryResponseDTO } from '../../shared/api/contracts'
import { fixtures } from '../../test/handlers'
import { server } from '../../test/server'

const url = 'http://localhost:8080/api/categories'
const timestamp = '2026-10-09T10:00:00'

function paged(items: CategoryResponseDTO[], number: number, size: number) {
  return { content: items.slice(number * size, (number + 1) * size), number, size, totalElements: items.length, totalPages: Math.ceil(items.length / size) }
}

function renderFlow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

async function loginAndOpen() {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'admin')
  await user.type(screen.getByLabelText(/^Senha/), 'senha-correta')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { name: 'Dashboard' })
  await user.click(within(screen.getByRole('navigation', { name: 'Atalhos administrativos' })).getByRole('link', { name: /Categorias/ }))
  await screen.findByRole('heading', { name: 'Categorias' })
  return user
}

afterEach(() => { memoryToken.clear(); vi.restoreAllMocks() })

it('lista somente categorias ativas retornadas pela API com paginação e sem ações inexistentes', async () => {
  const categories = Array.from({ length: 21 }, (_, index): CategoryResponseDTO => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: `Categoria ${index + 1}`,
    active: true,
  }))
  const calls: string[] = []
  server.use(http.get(url, ({ request }) => {
    const parsed = new URL(request.url)
    calls.push(parsed.search)
    return HttpResponse.json(paged(categories, Number(parsed.searchParams.get('page')), Number(parsed.searchParams.get('size'))))
  }))
  renderFlow()
  const user = await loginAndOpen()
  expect(await screen.findByText('21 categorias ativas')).toBeInTheDocument()
  expect(calls).toContain('?page=0&size=20')
  expect(screen.getByText(/A API retorna somente categorias ativas/)).toBeInTheDocument()
  expect(screen.getAllByText('Ativa')).toHaveLength(20)
  expect(screen.queryByRole('button', { name: /editar|ativar|desativar|excluir/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /inativas/i })).not.toBeInTheDocument()
  expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Próxima' }))
  expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument()
  await waitFor(() => expect(screen.getAllByText('Ativa')).toHaveLength(1))
  expect(screen.getByText('Categoria 21')).toBeInTheDocument()
  expect(calls).toContain('?page=1&size=20')
})

it('criação espera 201, envia somente name e active=true e invalida o select da manifestação', async () => {
  let release: (() => void) | undefined
  let sent: unknown
  let posts = 0
  server.use(http.post(url, async ({ request }) => {
    posts += 1
    sent = await request.json()
    return new Promise<Response>((resolve) => { release = () => resolve(HttpResponse.json({ ...fixtures.category, name: 'Nova categoria' }, { status: 201 })) })
  }))
  const client = renderFlow()
  const user = await loginAndOpen()
  client.setQueryData(['categories', 'report-form'], { pages: [{ content: [fixtures.category] }], pageParams: [0] })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  await user.click(screen.getByRole('link', { name: 'Nova categoria' }))
  expect(await screen.findByRole('heading', { name: 'Nova categoria' })).toBeInTheDocument()
  expect(screen.getByText(/situação inicial/)).toHaveTextContent('Ativa')
  await user.type(screen.getByRole('textbox', { name: 'Nome' }), '  Nova categoria  ')
  const form = screen.getByRole('button', { name: 'Cadastrar categoria' }).closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  await waitFor(() => expect(posts).toBe(1))
  expect(sent).toEqual({ name: 'Nova categoria', active: true })
  expect(screen.queryByRole('heading', { name: 'Categoria cadastrada' })).not.toBeInTheDocument()
  await act(async () => { release?.() })
  expect(await screen.findByRole('heading', { name: 'Categoria cadastrada' })).toBeInTheDocument()
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['categories'] })
  expect(client.getQueryState(['categories', 'report-form'])?.isInvalidated).toBe(true)
})

it('valida nome vazio e acima de 100, e apresenta duplicidade do backend no campo', async () => {
  let posts = 0
  server.use(http.post(url, () => {
    posts += 1
    return HttpResponse.json({ status: 400, erro: 'Já existe uma categoria com esse nome.', timestamp }, { status: 400 })
  }))
  renderFlow()
  const user = await loginAndOpen()
  await user.click(screen.getByRole('link', { name: 'Nova categoria' }))
  const field = screen.getByRole('textbox', { name: 'Nome' })
  await user.click(screen.getByRole('button', { name: 'Cadastrar categoria' }))
  expect(await screen.findByText('Informe o nome da categoria.')).toBeInTheDocument()
  expect(posts).toBe(0)
  fireEvent.change(field, { target: { value: 'a'.repeat(101) } })
  await user.click(screen.getByRole('button', { name: 'Cadastrar categoria' }))
  expect(await screen.findByText('Use no máximo 100 caracteres.')).toBeInTheDocument()
  expect(posts).toBe(0)
  fireEvent.change(field, { target: { value: 'Atendimento' } })
  await user.click(screen.getByRole('button', { name: 'Cadastrar categoria' }))
  expect(await screen.findByText('Já existe uma categoria com esse nome.')).toBeInTheDocument()
  expect(field).toHaveValue('Atendimento')
  expect(posts).toBe(1)
})

it('mostra erro, retry e vazio sem insinuar gerenciamento de inativas', async () => {
  let attempts = 0
  server.use(http.get(url, ({ request }) => {
    attempts += 1
    if (attempts === 1) return HttpResponse.json({ status: 500, erro: 'Falha', timestamp }, { status: 500 })
    const parsed = new URL(request.url)
    return HttpResponse.json(paged([], Number(parsed.searchParams.get('page')), Number(parsed.searchParams.get('size'))))
  }))
  renderFlow()
  const user = await loginAndOpen()
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as categorias ativas.')
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(await screen.findByRole('heading', { name: 'Nenhuma categoria ativa' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Paginação' })).not.toBeInTheDocument()
  expect(attempts).toBe(2)
})
