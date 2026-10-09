import { expect, test } from '@playwright/test'

test('reload encerra a sessão sem restaurar JWT do navegador', async ({ page }) => {
  await page.route('http://localhost:8080/api/**', async (route) => {
    const request = route.request()
    const cors = {
      'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
      'Access-Control-Allow-Headers': 'authorization,content-type',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (request.url().endsWith('/api/auth/login')) {
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
        token: 'browser-mock-token', name: 'Cliente Teste', role: 'CLIENT', passwordChanged: true,
      }) })
    }
    if (request.url().endsWith('/api/users/me') && request.headers().authorization === 'Bearer browser-mock-token') {
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
        id: '11111111-1111-4111-8111-111111111111', name: 'Cliente Teste', username: 'cliente',
        contactEmail: null, role: 'CLIENT', active: true, passwordChanged: true,
      }) })
    }
    return route.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: JSON.stringify({
      status: 401, erro: 'Token ausente, inválido ou expirado', timestamp: '2026-10-09T10:00:00',
    }) })
  })

  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Username' }).fill('cliente')
  await page.getByLabel('Senha').fill('senha-correta')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Área do cliente' })).toBeVisible()
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookies: document.cookie })))
    .toEqual({ local: 0, session: 0, cookies: '' })

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Entrar na Ouvidoria' })).toBeVisible()
  await page.goto('/client')
  await expect(page.getByRole('heading', { name: 'Entrar na Ouvidoria' })).toBeVisible()
})

test('redefinição remove token da URL e envia somente os campos esperados', async ({ page }) => {
  const token = 'A'.repeat(43)
  let sentBody: unknown
  await page.route('http://localhost:8080/api/auth/reset-password', async (route) => {
    const request = route.request()
    const cors = {
      'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
    }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    sentBody = request.postDataJSON() as unknown
    return route.fulfill({ status: 200, headers: cors })
  })

  await page.goto(`/reset-password?token=${token}`)
  await expect(page.getByRole('heading', { name: 'Redefinir senha' })).toBeVisible()
  await expect(page).toHaveURL('http://127.0.0.1:5173/reset-password')
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')
  await page.locator('#new-password').fill('nova-senha')
  await page.locator('#confirm-password').fill('nova-senha')
  await page.getByRole('button', { name: 'Redefinir senha' }).click()
  await expect(page.getByText('Senha redefinida. Entre novamente.')).toBeVisible()
  expect(sentBody).toEqual({ token, newPassword: 'nova-senha' })
})
