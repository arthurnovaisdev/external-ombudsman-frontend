import { expect, test } from '@playwright/test'

for (const width of [375, 1280]) {
  test(`gestão de clientes ADMIN em ${width}px`, async ({ page }) => {
    const admin = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Admin Exemplo', username: 'admin', contactEmail: null, role: 'ADMIN', active: true, passwordChanged: true }
    const client = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Cliente Exemplo', username: 'cliente', contactEmail: 'cliente@exemplo.com', role: 'CLIENT', active: true, passwordChanged: false }
    let sentRegistration: Record<string, unknown> | null = null
    let deactivations = 0
    await page.setViewportSize({ width, height: 800 })
    await page.route('http://localhost:8080/api/**', async (route) => {
      const request = route.request()
      const parsed = new URL(request.url())
      const cors = {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
        'Access-Control-Allow-Headers': 'authorization,content-type',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      }
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      if (parsed.pathname === '/api/auth/login') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ token: 'admin-users-token', name: admin.name, role: 'ADMIN', passwordChanged: true }) })
      if (parsed.pathname === '/api/users/me') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(admin) })
      if (parsed.pathname === '/api/reports/admin') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ content: [], number: 0, size: 5, totalElements: 0, totalPages: 0 }) })
      if (parsed.pathname === '/api/users' && request.method() === 'GET') {
        const number = Number(parsed.searchParams.get('page') ?? 0)
        const size = Number(parsed.searchParams.get('size') ?? 20)
        const users = [admin, client]
        return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ content: users.slice(number * size, (number + 1) * size), number, size, totalElements: users.length, totalPages: Math.ceil(users.length / size) }) })
      }
      if (parsed.pathname === `/api/users/${client.id}/deactivate` && request.method() === 'PATCH') {
        deactivations += 1
        client.active = false
        return route.fulfill({ status: 204, headers: cors })
      }
      if (parsed.pathname === `/api/users/${client.id}/activate` && request.method() === 'PATCH') {
        client.active = true
        return route.fulfill({ status: 204, headers: cors })
      }
      if (parsed.pathname === '/api/auth/register' && request.method() === 'POST') {
        sentRegistration = request.postDataJSON() as Record<string, unknown>
        return route.fulfill({ status: 201, headers: cors })
      }
      return route.fulfill({ status: 404, headers: cors })
    })

    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByLabel('Senha').fill('senha-correta')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await page.getByRole('navigation', { name: 'Atalhos administrativos' }).getByRole('link', { name: /Clientes/ }).click()
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()
    const table = page.getByRole('region', { name: 'Tabela: Usuários cadastrados' })
    await expect(table).toBeVisible()
    await expect(table.getByRole('columnheader')).toHaveCount(6)
    await expect(table.getByText('Sua conta')).toBeVisible()
    await expect(table.getByRole('button', { name: 'Desativar Cliente Exemplo' })).toBeVisible()
    expect(await table.getByText(/criado em|data de criação/i).count()).toBe(0)
    await table.getByRole('button', { name: 'Desativar Cliente Exemplo' }).click()
    const dialog = page.getByRole('dialog', { name: 'Desativar usuário?' })
    await expect(dialog.getByText(/invalida os tokens anteriores/)).toBeVisible()
    expect(deactivations).toBe(0)
    await dialog.getByRole('button', { name: 'Confirmar desativação' }).click()
    await expect(table.getByRole('button', { name: 'Ativar Cliente Exemplo' })).toBeVisible()
    expect(deactivations).toBe(1)

    await page.getByRole('link', { name: 'Cadastrar cliente' }).click()
    await expect(page.getByRole('heading', { name: 'Cadastrar cliente' })).toBeVisible()
    await expect(page.getByText(/e-mail é opcional, mas recomendado/)).toBeVisible()
    await page.getByRole('textbox', { name: 'Nome' }).fill('Novo Cliente')
    await page.getByRole('textbox', { name: 'Username' }).fill('novo.cliente')
    await page.getByLabel(/^Senha provisória/).fill('senha-provisoria')
    await page.getByRole('button', { name: 'Cadastrar cliente' }).click()
    await expect(page.getByRole('heading', { name: 'Cliente cadastrado' })).toBeVisible()
    expect(sentRegistration).toEqual({ name: 'Novo Cliente', username: 'novo.cliente', contactEmail: null, password: 'senha-provisoria' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  })
}
