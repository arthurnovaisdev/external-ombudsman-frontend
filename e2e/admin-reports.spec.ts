import { expect, test } from '@playwright/test'

const reports = Array.from({ length: 12 }, (_, index) => ({
  protocol: `DEN-2026-AAAAAAA${'ABCDEFGHJKLM'[index]}`,
  category: 'Atendimento',
  description: `Descrição da manifestação ${index + 1}`,
  createdAt: '2026-10-09T10:00:00Z',
  closedAt: index === 0 ? '2026-10-10T10:00:00Z' : null,
  ownerName: `Cliente ${index + 1}`,
  ownerUsername: `cliente${index + 1}`,
}))

for (const width of [375, 1280]) {
  test(`dashboard e listagem ADMIN em ${width}px`, async ({ page }) => {
    const requestedPages: string[] = []
    await page.setViewportSize({ width, height: 800 })
    await page.route('http://localhost:8080/api/**', async (route) => {
      const request = route.request()
      const parsed = new URL(request.url())
      const cors = {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
        'Access-Control-Allow-Headers': 'authorization,content-type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      }
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      if (parsed.pathname === '/api/auth/login') {
        return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
          token: 'admin-report-token', name: 'Admin Exemplo', role: 'ADMIN', passwordChanged: true,
        }) })
      }
      if (parsed.pathname === '/api/users/me') {
        return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
          id: '11111111-1111-4111-8111-111111111111', name: 'Admin Exemplo',
          username: 'admin', contactEmail: null, role: 'ADMIN', active: true, passwordChanged: true,
        }) })
      }
      if (parsed.pathname === '/api/reports/admin') {
        requestedPages.push(parsed.search)
        const number = Number(parsed.searchParams.get('page') ?? 0)
        const size = Number(parsed.searchParams.get('size') ?? 10)
        return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
          content: reports.slice(number * size, (number + 1) * size), number, size,
          totalElements: reports.length, totalPages: Math.ceil(reports.length / size),
        }) })
      }
      return route.fulfill({ status: 404, headers: cors })
    })

    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByLabel('Senha').fill('senha-correta')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Total de manifestações' })).toBeVisible()
    await expect(page.getByText('12', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Manifestações recentes' })).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(5)
    await expect(page.getByRole('navigation', { name: 'Atalhos administrativos' }).getByRole('link', { name: /Clientes/ })).toBeVisible()
    expect(requestedPages).toContain('?page=0&size=5')

    await page.getByRole('link', { name: 'Ver todas as manifestações' }).click()
    await expect(page.getByRole('heading', { name: 'Manifestações', exact: true })).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(10)
    await expect(page.getByText('Página 1 de 2')).toBeVisible()
    await expect(page.getByRole('article').first().getByText('Cliente 1')).toBeVisible()
    await expect(page.getByRole('article').first().getByText('(cliente1)')).toBeVisible()
    expect(requestedPages).toContain('?page=0&size=10')
    expect(await page.getByRole('searchbox').count()).toBe(0)
    expect(await page.getByRole('combobox').count()).toBe(0)
    await page.getByRole('button', { name: 'Próxima' }).click()
    await expect(page.getByText('Página 2 de 2')).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(2)
    expect(requestedPages).toContain('?page=1&size=10')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  })
}
