import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { memoryToken } from '../../shared/auth/memoryToken'
import { server } from '../../test/server'
import { AppRoutes } from '../router/AppRoutes'

function renderLayout() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider><AppRoutes /></AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function login(username: string) {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: 'Username' }), username)
  await user.type(screen.getByLabelText(/^Senha/), 'senha-correta')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  return user
}

afterEach(() => memoryToken.clear())

it('mostra apenas a navegação CLIENT e marca a rota ativa', async () => {
  renderLayout()
  const user = await login('cliente')
  await screen.findByRole('heading', { name: 'Área do cliente' })
  const menu = screen.getByRole('button', { name: 'Menu' })
  await user.click(menu)
  const nav = screen.getByRole('navigation', { name: 'Navegação do cliente' })
  expect(within(nav).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
  expect(within(nav).getByRole('link', { name: 'Manifestações' })).toHaveAttribute('href', '/client/manifestacoes')
  expect(within(nav).queryByRole('link', { name: 'Clientes' })).not.toBeInTheDocument()
  expect(within(nav).queryByRole('link', { name: 'Categorias' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute('href', '#conteudo-principal')
  await user.click(within(nav).getByRole('link', { name: 'Manifestações' }))
  expect(screen.getByRole('heading', { name: 'Minhas manifestações' })).toBeInTheDocument()
  await user.click(menu)
  expect(within(screen.getByRole('navigation', { name: 'Navegação do cliente' })).getByRole('link', { name: 'Manifestações' })).toHaveAttribute('aria-current', 'page')
})

it('mostra apenas a navegação ADMIN e fecha o menu móvel com Escape', async () => {
  renderLayout()
  const user = await login('admin')
  await screen.findByRole('heading', { name: 'Área administrativa' })
  const menu = screen.getByRole('button', { name: 'Menu' })
  await user.click(menu)
  const nav = screen.getByRole('navigation', { name: 'Navegação administrativa' })
  expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  expect(within(nav).getByRole('link', { name: 'Clientes' })).toBeInTheDocument()
  expect(within(nav).getByRole('link', { name: 'Categorias' })).toBeInTheDocument()
  expect(within(nav).queryByRole('link', { name: 'Início' })).not.toBeInTheDocument()
  expect(menu).toHaveAttribute('aria-expanded', 'true')
  const mobileNav = document.getElementById(menu.getAttribute('aria-controls')!)
  expect(mobileNav).not.toBeNull()
  within(mobileNav!).getByRole('link', { name: 'Clientes' }).focus()
  await user.keyboard('{Escape}')
  expect(menu).toHaveAttribute('aria-expanded', 'false')
  expect(menu).toHaveFocus()
  await user.click(menu)
  await user.click(within(document.getElementById(menu.getAttribute('aria-controls')!)!).getByRole('link', { name: 'Categorias' }))
  expect(screen.getByRole('heading', { name: 'Categorias' })).toBeInTheDocument()
  expect(menu).toHaveAttribute('aria-expanded', 'false')
})

it('preserva nome longo no perfil sem truncar seu conteúdo acessível', async () => {
  const longName = 'Nome muito longo de cliente responsável pela manifestação e pelo acompanhamento'
  server.use(http.get('http://localhost:8080/api/users/me', () => HttpResponse.json({
    id: '11111111-1111-4111-8111-111111111111', name: longName, username: 'cliente',
    contactEmail: null, role: 'CLIENT', active: true, passwordChanged: true,
  })))
  renderLayout()
  const user = await login('cliente')
  await screen.findByRole('heading', { name: 'Área do cliente' })
  expect(screen.getByTitle(longName)).toHaveTextContent(longName)
  await user.click(screen.getByRole('button', { name: 'Menu' }))
  expect(screen.getAllByText(longName).length).toBeGreaterThan(0)
})

it('exibe estado de carregamento enquanto confirma o perfil', async () => {
  let release: (() => void) | undefined
  server.use(http.get('http://localhost:8080/api/users/me', async () => {
    await new Promise<void>((resolve) => { release = resolve })
    return HttpResponse.json({
      id: '11111111-1111-4111-8111-111111111111', name: 'Cliente Exemplo', username: 'cliente',
      contactEmail: null, role: 'CLIENT', active: true, passwordChanged: true,
    })
  }))
  renderLayout()
  await login('cliente')
  expect(await screen.findByText('Carregando seu perfil…')).toBeInTheDocument()
  release?.()
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Área do cliente' })).toBeInTheDocument())
})
