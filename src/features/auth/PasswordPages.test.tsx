import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { AppRoutes } from '../../app/router/AppRoutes'
import { memoryToken } from '../../shared/auth/memoryToken'
import { server } from '../../test/server'
import { AuthProvider } from './AuthProvider'
import { captureResetTokenFromUrl } from './resetTokenUrl'

const origin = 'http://localhost:8080'
const resetToken = 'A'.repeat(43)

function renderPage(path: string, initialResetToken: string | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider><AppRoutes initialResetToken={initialResetToken} /></AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  memoryToken.clear()
  window.history.replaceState(null, '', '/')
})

it('valida username e tamanho da senha antes do login', async () => {
  renderPage('/login')
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'ab!')
  await user.type(screen.getByLabelText(/^Senha/), 'a'.repeat(101))
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  expect(screen.getByText('Use apenas letras, números, ponto, hífen e underline.')).toBeInTheDocument()
  expect(screen.getByText('Use no máximo 100 caracteres.')).toBeInTheDocument()
})

it('envia somente username e confirma recuperação sem revelar situação da conta', async () => {
  let payload: unknown
  server.use(http.post(`${origin}/api/auth/forgot-password`, async ({ request }) => {
    payload = await request.json()
    return new HttpResponse(null, { status: 200 })
  }))
  renderPage('/esqueci-senha')
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'cliente')
  await user.click(screen.getByRole('button', { name: 'Solicitar recuperação' }))
  expect(await screen.findByText(/Se a conta estiver apta/)).toBeInTheDocument()
  expect(payload).toEqual({ username: 'cliente' })
  expect(screen.queryByText(/não existe|desativad|sem e-mail/i)).not.toBeInTheDocument()
})

it('mostra espera segura quando a recuperação retorna 429', async () => {
  server.use(http.post(`${origin}/api/auth/forgot-password`, () =>
    HttpResponse.json({ status: 429, erro: 'Muitas tentativas.', timestamp: '2026-10-09T10:00:00' }, { status: 429, headers: { 'Retry-After': '60' } })))
  renderPage('/esqueci-senha')
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'cliente')
  await user.click(screen.getByRole('button', { name: 'Solicitar recuperação' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Tente novamente em 60 segundos.')
})

it('remove o token da URL antes da renderização e envia apenas token e nova senha', async () => {
  window.history.replaceState(null, '', `/reset-password?token=${resetToken}&outro=valor#fragmento`)
  const token = captureResetTokenFromUrl(window)
  expect(token).toBe(resetToken)
  expect(window.location.href).toBe('http://localhost:3000/reset-password')
  let payload: unknown
  let requestUrl: string | null = null
  server.use(http.post(`${origin}/api/auth/reset-password`, async ({ request }) => {
    payload = await request.json()
    requestUrl = request.url
    return new HttpResponse(null, { status: 200 })
  }))
  renderPage('/reset-password', token)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/^Nova senha/), 'nova-senha')
  await user.type(screen.getByLabelText(/^Confirmar nova senha/), 'nova-senha')
  await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))
  expect(await screen.findByText('Senha redefinida. Entre novamente.')).toBeInTheDocument()
  expect(payload).toEqual({ token: resetToken, newPassword: 'nova-senha' })
  expect(requestUrl).toBe(`${origin}/api/auth/reset-password`)
})

it('impede envio quando a confirmação de senha diverge', async () => {
  let requests = 0
  server.use(http.post(`${origin}/api/auth/reset-password`, () => { requests += 1; return new HttpResponse(null, { status: 200 }) }))
  renderPage('/reset-password', resetToken)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/^Nova senha/), 'nova-senha')
  await user.type(screen.getByLabelText(/^Confirmar nova senha/), 'outra-senha')
  await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))
  expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument()
  expect(requests).toBe(0)
})

it('não apresenta formulário quando falta token válido', () => {
  renderPage('/reset-password')
  expect(screen.getByRole('alert')).toHaveTextContent('Link inválido ou ausente.')
  expect(screen.queryByRole('button', { name: 'Redefinir senha' })).not.toBeInTheDocument()
})
