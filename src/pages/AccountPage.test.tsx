import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { AppRoutes } from '../app/router/AppRoutes'
import { AuthProvider } from '../features/auth/AuthProvider'
import { memoryToken } from '../shared/auth/memoryToken'
import { fixtures } from '../test/handlers'
import { server } from '../test/server'

const profileUrl = 'http://localhost:8080/api/users/me'
const passwordUrl = `${profileUrl}/password`
const timestamp = '2026-10-09T10:00:00'

function renderFlow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

async function openAccount(username: 'cliente' | 'admin') {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: 'Username' }), username)
  await user.type(screen.getByLabelText(/^Senha/), 'senha-correta')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { name: username === 'admin' ? 'Área administrativa' : 'Área do cliente' })
  await user.click(screen.getByRole('button', { name: 'Menu' }))
  await user.click(within(screen.getByRole('navigation', { name: username === 'admin' ? 'Navegação administrativa' : 'Navegação do cliente' })).getByRole('link', { name: 'Minha conta' }))
  await screen.findByRole('heading', { name: 'Minha conta' })
  await screen.findByRole('heading', { name: 'Dados da conta' })
  return user
}

afterEach(() => memoryToken.clear())

it.each([
  ['cliente', 'Cliente', 'Cliente Exemplo'],
  ['admin', 'Administrador', 'Admin Exemplo'],
] as const)('mostra somente dados de /me em leitura para %s', async (username, role, name) => {
  let profileCalls = 0
  server.use(http.get(profileUrl, ({ request }) => {
    profileCalls += 1
    const admin = request.headers.get('Authorization') === 'Bearer mock-admin-jwt'
    return HttpResponse.json({ ...fixtures.user, name: admin ? 'Admin Exemplo' : 'Cliente Exemplo', username, role: admin ? 'ADMIN' : 'CLIENT', contactEmail: 'contato@exemplo.com' })
  }))
  renderFlow()
  await openAccount(username)
  const details = screen.getByRole('heading', { name: 'Dados da conta' }).closest('div')!
  expect(within(details).getByText(name)).toBeInTheDocument()
  expect(within(details).getByText(username)).toBeInTheDocument()
  expect(within(details).getByText('contato@exemplo.com')).toBeInTheDocument()
  expect(within(details).getByText(role)).toBeInTheDocument()
  expect(within(details).getByText('Senha provisória alterada')).toBeInTheDocument()
  expect(screen.queryAllByRole('textbox')).toHaveLength(0)
  expect(screen.queryByRole('button', { name: /editar|salvar perfil/i })).not.toBeInTheDocument()
  expect(profileCalls).toBeGreaterThanOrEqual(2)
})

it('após 204 remove token e todo o cache, informa sucesso e mostra somente login', async () => {
  let release: (() => void) | undefined
  let sentBody: unknown
  server.use(http.patch(passwordUrl, async ({ request }) => {
    sentBody = await request.json()
    await new Promise<void>((resolve) => { release = resolve })
    return new HttpResponse(null, { status: 204 })
  }))
  const client = renderFlow()
  const user = await openAccount('cliente')
  client.setQueryData(['privado'], { segredo: true })
  await user.type(screen.getByLabelText(/^Senha atual/), 'senha-correta')
  await user.type(screen.getByLabelText(/^Nova senha/), 'nova-senha')
  await user.type(screen.getByLabelText(/^Confirmar nova senha/), 'nova-senha')
  await user.click(screen.getByRole('button', { name: 'Alterar senha' }))
  await waitFor(() => expect(release).toBeTypeOf('function'))
  expect(memoryToken.get()).toBe('mock-jwt')
  expect(screen.getByRole('heading', { name: 'Minha conta' })).toBeInTheDocument()
  await act(async () => { release?.() })
  expect(await screen.findByRole('heading', { name: 'Entrar na Ouvidoria' })).toBeInTheDocument()
  expect(screen.getByText('Senha alterada. Entre novamente.')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Minha conta' })).not.toBeInTheDocument()
  expect(memoryToken.get()).toBeNull()
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  expect(sentBody).toEqual({ currentPassword: 'senha-correta', newPassword: 'nova-senha' })
})

it('ADMIN também encerra a sessão depois de trocar a senha', async () => {
  renderFlow()
  const user = await openAccount('admin')
  await user.type(screen.getByLabelText(/^Senha atual/), 'senha-correta')
  await user.type(screen.getByLabelText(/^Nova senha/), 'nova-senha')
  await user.type(screen.getByLabelText(/^Confirmar nova senha/), 'nova-senha')
  await user.click(screen.getByRole('button', { name: 'Alterar senha' }))
  expect(await screen.findByRole('heading', { name: 'Entrar na Ouvidoria' })).toBeInTheDocument()
  expect(memoryToken.get()).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Área administrativa' })).not.toBeInTheDocument()
})

it('valida limites e confirmação local sem enviar campos extras', async () => {
  let calls = 0
  server.use(http.patch(passwordUrl, () => { calls += 1; return new HttpResponse(null, { status: 204 }) }))
  renderFlow()
  const user = await openAccount('cliente')
  const current = screen.getByLabelText(/^Senha atual/)
  const next = screen.getByLabelText(/^Nova senha/)
  const confirm = screen.getByLabelText(/^Confirmar nova senha/)
  fireEvent.change(current, { target: { value: 'a'.repeat(101) } })
  fireEvent.change(next, { target: { value: 'abcde' } })
  fireEvent.change(confirm, { target: { value: 'diferente' } })
  await user.click(screen.getByRole('button', { name: 'Alterar senha' }))
  expect(await screen.findByText('Use no máximo 100 caracteres.')).toBeInTheDocument()
  expect(screen.getByText('Use entre 6 e 100 caracteres.')).toBeInTheDocument()
  expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument()
  expect(calls).toBe(0)
})

it('não encerra sessão com resposta diferente de 204 e mostra erro do backend', async () => {
  let attempts = 0
  server.use(http.patch(passwordUrl, () => {
    attempts += 1
    if (attempts === 1) return new HttpResponse(null, { status: 200 })
    return HttpResponse.json({ status: 400, erro: 'A senha atual está incorreta.', timestamp }, { status: 400 })
  }))
  renderFlow()
  const user = await openAccount('cliente')
  await user.type(screen.getByLabelText(/^Senha atual/), 'senha-incorreta')
  await user.type(screen.getByLabelText(/^Nova senha/), 'nova-senha')
  await user.type(screen.getByLabelText(/^Confirmar nova senha/), 'nova-senha')
  await user.click(screen.getByRole('button', { name: 'Alterar senha' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('O servidor retornou uma resposta inválida.')
  expect(memoryToken.get()).toBe('mock-jwt')
  await user.click(screen.getByRole('button', { name: 'Alterar senha' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('A senha atual está incorreta.')
  expect(screen.getByRole('heading', { name: 'Minha conta' })).toBeInTheDocument()
  expect(attempts).toBe(2)
})
