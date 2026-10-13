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
import { categoriesApi } from './api'
import { fixtures } from '../../test/handlers'
import { server } from '../../test/server'

const url = 'http://localhost:8080/api/categories'
const adminUrl = `${url}/admin`
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

it('MSW permite a lista ativa ao CLIENT e restringe lista administrativa e PATCH ao ADMIN', async () => {
  memoryToken.set('mock-jwt')
  expect((await categoriesApi.list()).content).toEqual([fixtures.category])
  await expect(categoriesApi.listAdmin()).rejects.toMatchObject({ status: 403 })
  await expect(categoriesApi.deactivate(fixtures.category.id)).rejects.toMatchObject({ status: 403 })
  memoryToken.set('mock-admin-jwt')
  expect((await categoriesApi.listAdmin()).content).toEqual([fixtures.category, fixtures.inactiveCategory])
  await expect(categoriesApi.deactivate(fixtures.category.id)).resolves.toBeUndefined()
})

it('lista categorias ativas e inativas na ordem e paginação da API administrativa', async () => {
  const categories = Array.from({ length: 21 }, (_, index): CategoryResponseDTO => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: `Categoria ${index + 1}`,
    active: index % 2 === 0,
  }))
  const calls: string[] = []
  server.use(http.get(adminUrl, ({ request }) => {
    const parsed = new URL(request.url)
    calls.push(parsed.search)
    return HttpResponse.json(paged(categories, Number(parsed.searchParams.get('page')), Number(parsed.searchParams.get('size'))))
  }))
  renderFlow()
  const user = await loginAndOpen()
  expect(await screen.findByText('21 categorias no total')).toBeInTheDocument()
  expect(calls).toContain('?page=0&size=20')
  expect(screen.getAllByText('Ativa')).toHaveLength(10)
  expect(screen.getAllByText('Inativa')).toHaveLength(10)
  expect(screen.getAllByRole('button', { name: /^Desativar/ })).toHaveLength(10)
  expect(screen.queryByRole('button', { name: /editar|^ativar|excluir/i })).not.toBeInTheDocument()
  expect(within(screen.getByText('Categoria 2').closest('li')!).queryByRole('button', { name: /Desativar/ })).not.toBeInTheDocument()
  expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Próxima' }))
  expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument()
  await waitFor(() => expect(screen.getAllByText('Ativa')).toHaveLength(1))
  expect(screen.getByRole('button', { name: 'Desativar Categoria 21' })).toBeInTheDocument()
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

it('mostra erro, retry e vazio da listagem administrativa', async () => {
  let attempts = 0
  server.use(http.get(adminUrl, ({ request }) => {
    attempts += 1
    if (attempts === 1) return HttpResponse.json({ status: 500, erro: 'Falha', timestamp }, { status: 500 })
    const parsed = new URL(request.url)
    return HttpResponse.json(paged([], Number(parsed.searchParams.get('page')), Number(parsed.searchParams.get('size'))))
  }))
  renderFlow()
  const user = await loginAndOpen()
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha')
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(await screen.findByRole('heading', { name: 'Nenhuma categoria cadastrada' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Paginação' })).not.toBeInTheDocument()
  expect(attempts).toBe(2)
})

it('confirma por teclado, espera o 204 e invalida todas as consultas de categorias', async () => {
  let release: (() => void) | undefined
  let patches = 0
  let active = true
  server.use(
    http.get(adminUrl, ({ request }) => HttpResponse.json(paged([{ ...fixtures.category, active }], Number(new URL(request.url).searchParams.get('page')), 20))),
    http.patch(`${url}/${fixtures.category.id}/deactivate`, () => {
      patches += 1
      return new Promise<Response>((resolve) => { release = () => { active = false; resolve(new HttpResponse(null, { status: 204 })) } })
    }),
  )
  const client = renderFlow()
  const user = await loginAndOpen()
  client.setQueryData(['categories', 'report-form'], { pages: [{ content: [fixtures.category] }], pageParams: [0] })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const action = await screen.findByRole('button', { name: 'Desativar Atendimento' })
  action.focus()
  await user.keyboard('{Enter}')
  const dialog = screen.getByRole('dialog', { name: 'Desativar categoria?' })
  expect(within(dialog).getByText(/deixará de estar disponível para novas manifestações/)).toHaveTextContent('continuará identificando manifestações antigas')
  expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(action).toHaveFocus()
  expect(patches).toBe(0)
  await user.click(action)
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar desativação' }))
  await waitFor(() => expect(patches).toBe(1))
  expect(screen.getByText('Ativa')).toBeInTheDocument()
  expect(screen.queryByText('Categoria Atendimento desativada.')).not.toBeInTheDocument()
  expect(invalidate).not.toHaveBeenCalled()
  await act(async () => { release?.() })
  expect(await screen.findByText('Categoria Atendimento desativada.')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('Inativa')).toBeInTheDocument())
  await waitFor(() => expect(screen.getByText('Categoria Atendimento desativada.').closest('[tabindex]')).toHaveFocus())
  expect(screen.queryByRole('button', { name: 'Desativar Atendimento' })).not.toBeInTheDocument()
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['categories'] })
  expect(client.getQueryState(['categories', 'report-form'])?.isInvalidated).toBe(true)
})

it.each([
  [403, 'Você não tem permissão para desativar esta categoria.'],
  [404, 'Categoria não encontrada. Atualize a lista e tente novamente.'],
  [429, 'Muitas requisições. Aguarde antes de tentar novamente.'],
  [500, 'Erro interno do servidor.'],
])('mostra falha %i da desativação e preserva a categoria ativa', async (status, message) => {
  server.use(http.patch(`${url}/${fixtures.category.id}/deactivate`, () => HttpResponse.json({ status, erro: message, timestamp }, { status })))
  renderFlow()
  const user = await loginAndOpen()
  await user.click(await screen.findByRole('button', { name: 'Desativar Atendimento' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar desativação' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(screen.getByText('Ativa')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Desativar Atendimento' })).toBeInTheDocument()
})

it('mostra falha de rede sem sucesso nem atualização definitiva', async () => {
  server.use(http.patch(`${url}/${fixtures.category.id}/deactivate`, () => HttpResponse.error()))
  renderFlow()
  const user = await loginAndOpen()
  await user.click(await screen.findByRole('button', { name: 'Desativar Atendimento' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar desativação' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar ao servidor.')
  expect(screen.getByText('Ativa')).toBeInTheDocument()
})

it('encerra a sessão e explica o 401 no login', async () => {
  server.use(http.patch(`${url}/${fixtures.category.id}/deactivate`, () => HttpResponse.json({ status: 401, erro: 'Token expirado', timestamp }, { status: 401 })))
  renderFlow()
  const user = await loginAndOpen()
  await user.click(await screen.findByRole('button', { name: 'Desativar Atendimento' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar desativação' }))
  expect(await screen.findByRole('heading', { name: 'Entrar na Ouvidoria' })).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou. Entre novamente.')
})
