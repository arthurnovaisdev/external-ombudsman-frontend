import { expect, test } from '@playwright/test'

for (const width of [375, 1280]) {
  test(`categorias ativas e cadastro ADMIN em ${width}px`, async ({ page }) => {
    const categories = Array.from({ length: 21 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      name: `Categoria ${index + 1}`,
      active: true,
    }))
    const requestedPages: string[] = []
    let sent: Record<string, unknown> | null = null
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
      if (parsed.pathname === '/api/auth/login') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ token: 'admin-categories-token', name: 'Admin Exemplo', role: 'ADMIN', passwordChanged: true }) })
      if (parsed.pathname === '/api/users/me') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Admin Exemplo', username: 'admin', contactEmail: null, role: 'ADMIN', active: true, passwordChanged: true }) })
      if (parsed.pathname === '/api/reports/admin') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ content: [], number: 0, size: 5, totalElements: 0, totalPages: 0 }) })
      if (parsed.pathname === '/api/categories' && request.method() === 'GET') {
        requestedPages.push(parsed.search)
        const number = Number(parsed.searchParams.get('page') ?? 0)
        const size = Number(parsed.searchParams.get('size') ?? 20)
        return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
          content: categories.slice(number * size, (number + 1) * size), number, size,
          totalElements: categories.length, totalPages: Math.ceil(categories.length / size),
        }) })
      }
      if (parsed.pathname === '/api/categories' && request.method() === 'POST') {
        sent = request.postDataJSON() as Record<string, unknown>
        const created = { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', name: sent.name, active: sent.active }
        categories.push(created as (typeof categories)[number])
        return route.fulfill({ status: 201, headers: cors, contentType: 'application/json', body: JSON.stringify(created) })
      }
      return route.fulfill({ status: 404, headers: cors })
    })

    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Username' }).fill('admin')
    await page.getByLabel('Senha').fill('senha-correta')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await page.getByRole('navigation', { name: 'Atalhos administrativos' }).getByRole('link', { name: /Categorias/ }).click()
    await expect(page.getByRole('heading', { name: 'Categorias' })).toBeVisible()
    await expect(page.getByText('Esta lista mostra apenas categorias ativas.')).toBeVisible()
    await expect(page.getByText('21 categorias ativas')).toBeVisible()
    await expect(page.getByText('Ativa', { exact: true })).toHaveCount(20)
    expect(requestedPages).toContain('?page=0&size=20')
    expect(await page.getByRole('button', { name: /editar|ativar|desativar|excluir/i }).count()).toBe(0)
    await page.getByRole('button', { name: 'Próxima' }).click()
    await expect(page.getByText('Página 2 de 2')).toBeVisible()
    await expect(page.getByText('Categoria 21')).toBeVisible()
    expect(requestedPages).toContain('?page=1&size=20')

    await page.getByRole('link', { name: 'Nova categoria' }).click()
    await expect(page.getByRole('heading', { name: 'Nova categoria' })).toBeVisible()
    await expect(page.getByText(/situação inicial/)).toContainText('Ativa')
    await page.getByRole('textbox', { name: 'Nome' }).fill('Categoria 22')
    await page.getByRole('button', { name: 'Cadastrar categoria' }).click()
    await expect(page.getByRole('heading', { name: 'Categoria cadastrada' })).toBeVisible()
    expect(sent).toEqual({ name: 'Categoria 22', active: true })
    await page.getByRole('link', { name: 'Ver categorias' }).click()
    await expect(page.getByText('22 categorias ativas')).toBeVisible()
    await page.getByRole('button', { name: 'Próxima' }).click()
    await expect(page.getByText('Categoria 22')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  })
}
