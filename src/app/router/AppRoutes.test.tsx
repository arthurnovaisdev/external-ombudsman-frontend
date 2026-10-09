import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { AppRoutes } from './AppRoutes'

function renderAt(path: string) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider><AppRoutes /></AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('roteamento inicial', () => {
  it('abre a página inicial', () => {
    renderAt('/')

    expect(screen.getByRole('heading', { name: 'Ouvidoria MBFREIRE' })).toBeInTheDocument()
  })

  it('oferece retorno ao início quando a rota não existe', () => {
    renderAt('/rota-inexistente')

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
  })

  it('redireciona rota autenticada sem sessão para o login', () => {
    renderAt('/account')
    expect(screen.getByRole('heading', { name: 'Entrar na Ouvidoria' })).toBeInTheDocument()
  })
})
