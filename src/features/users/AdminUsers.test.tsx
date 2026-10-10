import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { AppRoutes } from '../../app/router/AppRoutes'
import { AuthProvider } from '../auth/AuthProvider'
import { memoryToken } from '../../shared/auth/memoryToken'
import type { UserResponseDTO } from '../../shared/api/contracts'
import { fixtures } from '../../test/handlers'
import { server } from '../../test/server'

const origin = 'http://localhost:8080'
const usersUrl = `${origin}/api/users`
const timestamp = '2026-10-09T10:00:00'
const admin = { ...fixtures.user, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Admin Exemplo', username: 'admin', role: 'ADMIN' }
const client = { ...fixtures.user, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Cliente Exemplo', username: 'cliente', contactEmail: 'cliente@exemplo.com' }

function paged(items: UserResponseDTO[], number: number, size: number) {
  return { content: items.slice(number * size, (number + 1) * size), number, size, totalElements: items.length, totalPages: Math.ceil(items.length / size) }
}

function renderFlow() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/login']}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>
    </QueryClientProvider>,
  )
}

async function loginAndOpen() {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'admin')
  await user.type(screen.getByLabelText(/^Senha/), 'senha-correta')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { name: 'Dashboard' })
  await user.click(screen.getByRole('navigation', { name: 'Atalhos administrativos' }).querySelector('a[href="/admin/clientes"]')!)
  await screen.findByRole('heading', { name: 'Clientes' })
  return user
}

afterEach(() => memoryToken.clear())

it('tabela usa somente o DTO, pagina por nome do servidor e oculta autodesativação pelo /me', async () => {
  const users = [admin, ...Array.from({ length: 21 }, (_, index): UserResponseDTO => ({
    ...client, id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: `Cliente ${index + 1}`, username: `cliente${index + 1}`,
  }))]
  const calls: string[] = []
  server.use(
    http.get(`${usersUrl}/me`, () => HttpResponse.json(admin)),
    http.get(usersUrl, ({ request }) => {
      const url = new URL(request.url)
      calls.push(url.search)
      return HttpResponse.json(paged(users, Number(url.searchParams.get('page')), Number(url.searchParams.get('size'))))
    }),
  )
  renderFlow()
  const user = await loginAndOpen()
  expect(await screen.findByText('22 usuários')).toBeInTheDocument()
  expect(calls).toContain('?page=0&size=20')
  const table = screen.getByRole('region', { name: 'Tabela: Usuários cadastrados' })
  expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Nome', 'Username', 'E-mail', 'Perfil', 'Situação', 'Ação'])
  expect(within(table).queryByText(/criação|criado em/i)).not.toBeInTheDocument()
  const rows = within(table).getAllByRole('row')
  expect(within(rows[1]).getByText('Admin Exemplo')).toBeInTheDocument()
  expect(within(rows[1]).getByText('Sua conta')).toBeInTheDocument()
  expect(within(rows[1]).queryByRole('button')).not.toBeInTheDocument()
  expect(within(rows[2]).getByText('Cliente 1', { selector: 'td' })).toBeInTheDocument()
  expect(within(rows[2]).getByText('cliente@exemplo.com')).toBeInTheDocument()
  expect(within(rows[2]).getByRole('button', { name: 'Desativar Cliente 1' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Próxima' }))
  expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument()
  await waitFor(() => expect(within(screen.getByRole('region', { name: 'Tabela: Usuários cadastrados' })).getAllByRole('row')).toHaveLength(3))
  expect(calls).toContain('?page=1&size=20')
  expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
})

it('desativação exige confirmação, não é otimista e invalida tokens anteriores', async () => {
  let release: (() => void) | undefined
  let patches = 0
  let active = true
  let listCalls = 0
  server.use(
    http.get(`${usersUrl}/me`, () => HttpResponse.json(admin)),
    http.get(usersUrl, ({ request }) => {
      listCalls += 1
      const url = new URL(request.url)
      return HttpResponse.json(paged([admin, { ...client, active }], Number(url.searchParams.get('page')), Number(url.searchParams.get('size'))))
    }),
    http.patch(`${usersUrl}/${client.id}/deactivate`, () => {
      patches += 1
      return new Promise<Response>((resolve) => {
        release = () => { active = false; resolve(new HttpResponse(null, { status: 204 })) }
      })
    }),
  )
  renderFlow()
  const user = await loginAndOpen()
  const table = screen.getByRole('region', { name: 'Tabela: Usuários cadastrados' })
  await screen.findByText('2 usuários')
  await user.click(within(table).getByRole('button', { name: 'Desativar Cliente Exemplo' }))
  const dialog = screen.getByRole('dialog', { name: 'Desativar usuário?' })
  expect(within(dialog).getByText(/invalida os tokens anteriores/)).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(patches).toBe(0)
  await user.click(within(table).getByRole('button', { name: 'Desativar Cliente Exemplo' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar desativação' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar desativação' }))
  await waitFor(() => expect(patches).toBe(1))
  expect(within(table).getAllByText('Ativo')).toHaveLength(2)
  expect(screen.queryByText('Usuário Cliente Exemplo desativado.')).not.toBeInTheDocument()
  await act(async () => { release?.() })
  expect(await screen.findByText('Usuário Cliente Exemplo desativado.')).toBeInTheDocument()
  expect(within(table).getByText('Inativo')).toBeInTheDocument()
  expect(within(table).getByRole('button', { name: 'Ativar Cliente Exemplo' })).toBeInTheDocument()
  expect(listCalls).toBeGreaterThan(1)
})

it('ativação exige confirmação, espera 204 e trata erro do servidor sem alterar a linha', async () => {
  let activations = 0
  server.use(
    http.get(`${usersUrl}/me`, () => HttpResponse.json(admin)),
    http.get(usersUrl, ({ request }) => {
      const url = new URL(request.url)
      return HttpResponse.json(paged([admin, { ...client, active: false }], Number(url.searchParams.get('page')), Number(url.searchParams.get('size'))))
    }),
    http.patch(`${usersUrl}/${client.id}/activate`, () => {
      activations += 1
      return HttpResponse.json({ status: 500, erro: 'Falha ao ativar.', timestamp }, { status: 500 })
    }),
  )
  renderFlow()
  const user = await loginAndOpen()
  const button = await screen.findByRole('button', { name: 'Ativar Cliente Exemplo' })
  await user.click(button)
  expect(screen.getByRole('dialog', { name: 'Ativar usuário?' })).toBeInTheDocument()
  expect(activations).toBe(0)
  await user.click(screen.getByRole('button', { name: 'Confirmar ativação' }))
  expect(await screen.findByText('Falha ao ativar.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ativar Cliente Exemplo' })).toBeEnabled()
  expect(activations).toBe(1)
})

it('cadastro envia só campos do DTO, com e-mail nulo e sem role, após 201', async () => {
  let release: (() => void) | undefined
  let sent: unknown
  let posts = 0
  server.use(http.post(`${origin}/api/auth/register`, async ({ request }) => {
    posts += 1
    sent = await request.json()
    return new Promise<Response>((resolve) => { release = () => resolve(new HttpResponse(null, { status: 201 })) })
  }))
  renderFlow()
  const user = await loginAndOpen()
  await user.click(screen.getByRole('link', { name: 'Cadastrar cliente' }))
  expect(await screen.findByRole('heading', { name: 'Cadastrar cliente' })).toBeInTheDocument()
  expect(screen.getByText(/perfil será Cliente \(CLIENT\)/)).toBeInTheDocument()
  expect(screen.getByText(/e-mail é opcional, mas recomendado/)).toBeInTheDocument()
  await user.type(screen.getByRole('textbox', { name: 'Nome' }), ' Novo Cliente ')
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'novo.cliente')
  await user.type(screen.getByLabelText(/^Senha provisória/), 'senha-provisoria')
  const form = screen.getByRole('button', { name: 'Cadastrar cliente' }).closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  await waitFor(() => expect(posts).toBe(1))
  expect(sent).toEqual({ name: 'Novo Cliente', username: 'novo.cliente', contactEmail: null, password: 'senha-provisoria' })
  expect(screen.queryByRole('heading', { name: 'Cliente cadastrado' })).not.toBeInTheDocument()
  await act(async () => { release?.() })
  expect(await screen.findByRole('heading', { name: 'Cliente cadastrado' })).toBeInTheDocument()
  expect(screen.getByText(/senha provisória deverá ser alterada/)).toBeInTheDocument()
})

it('cadastro valida campos e mostra conflito sem inventar edição ou perfil ADMIN', async () => {
  let posts = 0
  server.use(http.post(`${origin}/api/auth/register`, () => {
    posts += 1
    return HttpResponse.json({ status: 400, detalhes: { username: 'Username já cadastrado no sistema.' }, timestamp }, { status: 400 })
  }))
  renderFlow()
  const user = await loginAndOpen()
  await user.click(screen.getByRole('link', { name: 'Cadastrar cliente' }))
  await user.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
  expect(await screen.findByText('Informe o nome.')).toBeInTheDocument()
  expect(posts).toBe(0)
  await user.type(screen.getByRole('textbox', { name: 'Nome' }), 'Cliente Novo')
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'novo')
  await user.type(screen.getByRole('textbox', { name: 'E-mail de contato' }), 'invalido')
  await user.type(screen.getByLabelText(/^Senha provisória/), '123456')
  await user.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
  expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
  expect(posts).toBe(0)
  await user.clear(screen.getByRole('textbox', { name: 'E-mail de contato' }))
  await user.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
  expect(await screen.findByText('Username já cadastrado no sistema.')).toBeInTheDocument()
  expect(posts).toBe(1)
  expect(screen.queryByRole('combobox', { name: /perfil/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /editar|excluir|redefinir senha/i })).not.toBeInTheDocument()
})
