import { expect, test } from '@playwright/test'

for (const role of ['CLIENT', 'ADMIN'] as const) {
  test(`Minha conta ${role} encerra sessão após 204`, async ({ page }) => {
    const width = role === 'CLIENT' ? 375 : 1280
    const username = role === 'CLIENT' ? 'cliente' : 'admin'
    const name = role === 'CLIENT' ? 'Cliente Exemplo' : 'Admin Exemplo'
    const token = role === 'CLIENT' ? 'client-token' : 'admin-token'
    const sentBodies: unknown[] = []
    let profileCalls = 0
    await page.setViewportSize({ width, height: 800 })
    await page.route('http://localhost:8080/api/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const cors = {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
        'Access-Control-Allow-Headers': 'authorization,content-type',
        'Access-Control-Allow-Methods': 'GET,PATCH,POST,OPTIONS',
      }
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      if (url.pathname === '/api/auth/login') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
        token, name, role, passwordChanged: true,
      }) })
      if (url.pathname === '/api/users/me' && request.method() === 'GET') {
        profileCalls += 1
        return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
          id: '11111111-1111-4111-8111-111111111111', name, username,
          contactEmail: 'contato@exemplo.com', role, active: true, passwordChanged: true,
        }) })
      }
      if (url.pathname === '/api/users/me/password' && request.method() === 'PATCH') {
        sentBodies.push(request.postDataJSON())
        return route.fulfill({ status: 204, headers: cors })
      }
      if (url.pathname === '/api/reports/mine') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
        content: [], number: 0, size: 5, totalElements: 0, totalPages: 0,
      }) })
      return route.fulfill({ status: 404, headers: cors })
    })

    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Username' }).fill(username)
    await page.getByLabel('Senha').fill('senha-correta')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { name: role === 'CLIENT' ? 'Área do cliente' : 'Dashboard' })).toBeVisible()
    if (role === 'CLIENT') await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('link', { name: 'Minha conta', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Dados da conta' })).toBeVisible()
    await expect(page.getByText('contato@exemplo.com')).toBeVisible()
    await expect(page.getByText('Senha provisória alterada')).toBeVisible()
    await page.getByLabel('Senha atual').fill('senha-correta')
    await page.getByLabel(/^Nova senha/).fill('nova-senha')
    await page.getByLabel('Confirmar nova senha').fill('nova-senha')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page).toHaveURL('http://127.0.0.1:5173/login')
    await expect(page.getByText('Senha alterada. Entre novamente.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Minha conta' })).toHaveCount(0)
    expect(sentBodies).toEqual([{ currentPassword: 'senha-correta', newPassword: 'nova-senha' }])
    expect(profileCalls).toBeGreaterThanOrEqual(2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  })
}
