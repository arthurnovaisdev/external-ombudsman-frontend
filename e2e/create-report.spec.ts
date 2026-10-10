import { expect, test } from '@playwright/test'

const categoryId = '22222222-2222-4222-8222-222222222222'
const protocol = 'DEN-2026-ABCDEFGH'

for (const width of [375, 1280]) {
  test(`cadastro CLIENT em ${width}px`, async ({ page }) => {
    const categoryPages: string[] = []
    const submissions: { contentType: string | undefined; body: unknown }[] = []
    let uploads = 0
    await page.setViewportSize({ width, height: 800 })
    await page.route('http://localhost:8080/api/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const cors = {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
        'Access-Control-Allow-Headers': 'authorization,content-type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      }
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      if (url.pathname.includes('/attachments')) uploads += 1
      if (url.pathname === '/api/auth/login') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
        token: 'client-report-token', name: 'Cliente Exemplo', role: 'CLIENT', passwordChanged: true,
      }) })
      if (url.pathname === '/api/users/me') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
        id: '11111111-1111-4111-8111-111111111111', name: 'Cliente Exemplo', username: 'cliente',
        contactEmail: null, role: 'CLIENT', active: true, passwordChanged: true,
      }) })
      if (url.pathname === '/api/reports/mine') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
        content: [], number: 0, size: 5, totalElements: 0, totalPages: 0,
      }) })
      if (url.pathname === '/api/categories') {
        categoryPages.push(url.search)
        const first = Array.from({ length: 50 }, (_, index) => ({
          id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
          name: `Categoria ${index}`,
          active: index !== 0,
        }))
        return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
          content: url.searchParams.get('page') === '0' ? first : [{ id: categoryId, name: 'Atendimento', active: true }],
        }) })
      }
      if (url.pathname === '/api/reports' && request.method() === 'POST') {
        submissions.push({ contentType: request.headers()['content-type'], body: request.postDataJSON() })
        return route.fulfill({ status: 201, headers: cors, contentType: 'application/json', body: JSON.stringify({ protocol }) })
      }
      return route.fulfill({ status: 404, headers: cors })
    })

    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Username' }).fill('cliente')
    await page.getByLabel('Senha').fill('senha-correta')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.getByRole('link', { name: 'Nova manifestação' }).click()
    await expect(page.getByRole('heading', { name: 'Nova manifestação' })).toBeVisible()
    await expect(page.getByText('O envio de anexos está temporariamente indisponível.')).toBeVisible()
    await page.getByRole('button', { name: 'Carregar mais categorias' }).click()
    await expect(page.getByRole('option', { name: 'Atendimento' })).toBeAttached()
    await page.getByRole('combobox', { name: 'Categoria' }).selectOption(categoryId)
    await page.getByRole('textbox', { name: 'Descrição' }).fill('Relato de teste')
    await page.getByRole('button', { name: 'Registrar manifestação' }).click()
    await expect(page.getByRole('heading', { name: 'Manifestação registrada' })).toBeVisible()
    await expect(page.getByText(protocol)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Visualizar manifestação' })).toHaveAttribute('href', `/client/manifestacoes/${protocol}`)
    await expect(page.getByRole('link', { name: 'Voltar para Minhas manifestações' })).toHaveAttribute('href', '/client/manifestacoes')
    expect([...new Set(categoryPages)]).toEqual(['?page=0&size=50', '?page=1&size=50'])
    expect(submissions).toEqual([{ contentType: 'application/json', body: {
      categoryId, description: 'Relato de teste', incidentDate: null, incidentLocation: null,
    } }])
    expect(uploads).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  })
}
