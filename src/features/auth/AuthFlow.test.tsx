import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Link, MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { AppRoutes } from '../../app/router/AppRoutes'
import { accountApi } from '../account/api'
import { categoriesApi } from '../categories/api'
import { memoryToken } from '../../shared/auth/memoryToken'
import { server } from '../../test/server'
import { AuthProvider } from './AuthProvider'

function renderFlow(path = '/login') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <nav aria-label="Navegação de teste">
            <Link to="/client">Abrir cliente</Link>
            <Link to="/admin">Abrir admin</Link>
            <Link to="/account">Abrir conta</Link>
            <Link to="/login">Abrir login</Link>
            <Link to="/outra-rota">Abrir rota desconhecida</Link>
          </nav>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

async function enter(username: string, password = 'senha-correta') {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: 'Username' }), username)
  await user.type(screen.getByLabelText(/^Senha/), password)
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  return user
}

afterEach(() => memoryToken.clear())

it('entra com credenciais válidas, consulta /me e libera a área CLIENT', async () => {
  renderFlow()
  const user = await enter('cliente')
  expect(await screen.findByRole('heading', { name: 'Área do cliente' })).toBeInTheDocument()
  expect(memoryToken.get()).toBe('mock-jwt')
  await user.click(screen.getByRole('link', { name: 'Abrir conta' }))
  expect(screen.getByRole('heading', { name: 'Minha conta' })).toBeInTheDocument()
  expect(screen.getByText('cliente')).toBeInTheDocument()
})

it('mantém a sessão vazia após login inválido', async () => {
  renderFlow()
  await enter('cliente', 'errada')
  expect(await screen.findByRole('alert')).toHaveTextContent('Username ou senha inválidos.')
  expect(memoryToken.get()).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Área do cliente' })).not.toBeInTheDocument()
})

it('nega área administrativa a CLIENT e área do cliente a ADMIN', async () => {
  const client = renderFlow()
  const user = await enter('cliente')
  await screen.findByRole('heading', { name: 'Área do cliente' })
  await user.click(screen.getByRole('link', { name: 'Abrir admin' }))
  expect(screen.getByRole('heading', { name: 'Acesso negado' })).toBeInTheDocument()
  client.unmount()

  renderFlow()
  const adminUser = await enter('admin')
  expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  await adminUser.click(screen.getByRole('link', { name: 'Abrir cliente' }))
  expect(screen.getByRole('heading', { name: 'Acesso negado' })).toBeInTheDocument()
})

it('bloqueia todas as áreas no primeiro acesso e encerra sessão após trocar senha', async () => {
  let sentBody: unknown
  server.use(http.patch('http://localhost:8080/api/users/me/password', async ({ request }) => {
    sentBody = await request.json()
    return new HttpResponse(null, { status: 204 })
  }))
  renderFlow()
  const user = await enter('primeiroacesso')
  expect(await screen.findByRole('heading', { name: 'Alterar senha provisória' })).toBeInTheDocument()
  expect(screen.getByText('MB.FREIRE').parentElement?.querySelector('img')).toHaveAttribute('alt', '')
  expect(screen.getByText('Depois de alterar a senha, entre novamente.')).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'Abrir cliente' }))
  expect(screen.getByRole('heading', { name: 'Alterar senha provisória' })).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'Abrir conta' }))
  expect(screen.getByRole('heading', { name: 'Alterar senha provisória' })).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'Abrir rota desconhecida' }))
  expect(screen.getByRole('heading', { name: 'Alterar senha provisória' })).toBeInTheDocument()
  await user.type(screen.getByLabelText(/^Senha atual/), 'provisoria')
  await user.type(screen.getByLabelText(/^Nova senha/), 'nova-senha')
  await user.type(screen.getByLabelText(/^Confirmar nova senha/), 'nova-senha')
  await user.click(screen.getByRole('button', { name: 'Alterar senha' }))
  expect(await screen.findByRole('heading', { name: 'Entrar na Ouvidoria' })).toBeInTheDocument()
  expect(screen.getByText('Senha alterada. Entre novamente.')).toBeInTheDocument()
  expect(sentBody).toEqual({ currentPassword: 'provisoria', newPassword: 'nova-senha' })
  expect(memoryToken.get()).toBeNull()
})

it('não encerra primeiro acesso se a troca de senha não retornar 204', async () => {
  server.use(http.patch('http://localhost:8080/api/users/me/password', () => new HttpResponse(null, { status: 200 })))
  renderFlow()
  const user = await enter('primeiroacesso')
  await screen.findByRole('heading', { name: 'Alterar senha provisória' })
  await user.type(screen.getByLabelText(/^Senha atual/), 'provisoria')
  await user.type(screen.getByLabelText(/^Nova senha/), 'nova-senha')
  await user.type(screen.getByLabelText(/^Confirmar nova senha/), 'nova-senha')
  await user.click(screen.getByRole('button', { name: 'Alterar senha' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('O servidor retornou uma resposta inválida.')
  expect(screen.getByRole('heading', { name: 'Alterar senha provisória' })).toBeInTheDocument()
  expect(memoryToken.get()).toBe('mock-first-access')
})

it('rejeita usuário desativado no login e perfil inativo retornado por /me', async () => {
  const first = renderFlow()
  await enter('desativado')
  expect(await screen.findByRole('alert')).toHaveTextContent('Usuário desativado ou não autorizado.')
  expect(memoryToken.get()).toBeNull()
  first.unmount()

  renderFlow()
  await enter('inativo')
  expect(await screen.findByRole('alert')).toHaveTextContent('Usuário desativado ou não autorizado.')
  expect(memoryToken.get()).toBeNull()
})

it('encerra a sessão quando /me rejeita token expirado', async () => {
  renderFlow()
  await enter('expirado')
  expect(await screen.findByRole('alert')).toHaveTextContent('Sessão expirada')
  expect(memoryToken.get()).toBeNull()
})

it('encerra a sessão e limpa o cache após qualquer 401 autenticado', async () => {
  const { queryClient } = renderFlow()
  await enter('cliente')
  await screen.findByRole('heading', { name: 'Área do cliente' })
  queryClient.setQueryData(['privado'], { segredo: 'apenas em memória' })
  server.use(http.get('http://localhost:8080/api/categories', () =>
    HttpResponse.json({ status: 401, erro: 'Sessão expirada. Faça login novamente.', timestamp: '2026-10-09T10:00:00' }, { status: 401 })))
  await act(async () => { await expect(categoriesApi.list()).rejects.toMatchObject({ status: 401 }) })
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Entrar na Ouvidoria' })).toBeInTheDocument())
  expect(memoryToken.get()).toBeNull()
  expect(queryClient.getQueryData(['privado'])).toBeUndefined()
})

it('recarregar o aplicativo não restaura token nem usuário', async () => {
  const first = renderFlow()
  await enter('cliente')
  await screen.findByRole('heading', { name: 'Área do cliente' })
  first.unmount()
  expect(memoryToken.get()).toBeNull()
  renderFlow('/client')
  expect(screen.getByRole('heading', { name: 'Entrar na Ouvidoria' })).toBeInTheDocument()
})

it('logout local remove token, usuário e cache sem endpoint remoto', async () => {
  const { queryClient } = renderFlow()
  const user = await enter('cliente')
  await screen.findByRole('heading', { name: 'Área do cliente' })
  queryClient.setQueryData(['privado'], { segredo: true })
  await user.click(screen.getByRole('button', { name: 'Menu' }))
  await user.click(screen.getByRole('button', { name: 'Sair' }))
  expect(screen.getByRole('heading', { name: 'Entrar na Ouvidoria' })).toBeInTheDocument()
  expect(memoryToken.get()).toBeNull()
  expect(queryClient.getQueryData(['privado'])).toBeUndefined()
  await act(async () => { await expect(accountApi.me()).rejects.toMatchObject({ status: 401 }) })
})
