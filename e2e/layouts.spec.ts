import { expect, test } from '@playwright/test'

const longName = 'NomeExtremamenteLongoDePessoaResponsavelPelaConta'.repeat(4)

for (const role of ['CLIENT', 'ADMIN'] as const) {
  for (const width of [375, 768, 1280]) {
    test(`layout ${role} em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.route('http://localhost:8080/api/**', async (route) => {
        const request = route.request()
        const cors = {
          'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
          'Access-Control-Allow-Headers': 'authorization,content-type',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        }
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
        if (request.url().endsWith('/api/auth/login')) {
          return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
            token: 'layout-test-token', name: longName, role, passwordChanged: true,
          }) })
        }
        if (request.url().endsWith('/api/users/me')) {
          return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
            id: '11111111-1111-4111-8111-111111111111', name: longName,
            username: role === 'ADMIN' ? 'admin' : 'cliente', contactEmail: null,
            role, active: true, passwordChanged: true,
          }) })
        }
        if (new URL(request.url()).pathname === '/api/reports/mine') {
          const parsed = new URL(request.url())
          const number = Number(parsed.searchParams.get('page') ?? 0)
          const size = Number(parsed.searchParams.get('size') ?? 10)
          const reports = [{
            protocol: 'DEN-2026-ABCDEFGH', category: 'Atendimento', description: 'Relato de teste',
            incidentDate: null, incidentLocation: null, createdAt: '2026-10-09T10:00:00Z',
            closedAt: null, messagesPurgedAt: null,
          }]
          return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
            content: reports.slice(number * size, (number + 1) * size), number, size,
            totalElements: reports.length, totalPages: Math.ceil(reports.length / size),
          }) })
        }
        return route.fulfill({ status: 404, headers: cors })
      })

      await page.goto('/login')
      await page.getByRole('textbox', { name: 'Username' }).fill(role === 'ADMIN' ? 'admin' : 'cliente')
      await page.getByLabel('Senha').fill('senha-correta')
      await page.getByRole('button', { name: 'Entrar' }).click()
      await expect(page.getByRole('heading', { name: role === 'ADMIN' ? 'Dashboard' : 'Área do cliente' })).toBeVisible()

      const menu = page.getByRole('button', { name: 'Menu' })
      if (width < 1088) {
        await expect(menu).toBeVisible()
        await menu.click()
        await expect(menu).toHaveAttribute('aria-expanded', 'true')
      } else {
        await expect(menu).toBeHidden()
      }

      const nav = page.getByRole('navigation', { name: role === 'ADMIN' ? 'Navegação administrativa' : 'Navegação do cliente' })
      await expect(nav).toBeVisible()
      await expect(nav.getByRole('link', { name: role === 'ADMIN' ? 'Dashboard' : 'Início' })).toHaveAttribute('aria-current', 'page')
      if (role === 'ADMIN') {
        await expect(nav.getByRole('link', { name: 'Clientes' })).toBeVisible()
        await expect(nav.getByRole('link', { name: 'Categorias' })).toBeVisible()
        expect(await nav.getByRole('link', { name: 'Início' }).count()).toBe(0)
      } else {
        expect(await nav.getByRole('link', { name: 'Clientes' }).count()).toBe(0)
        expect(await nav.getByRole('link', { name: 'Categorias' }).count()).toBe(0)
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(overflow).toBe(false)
      const skipLink = page.getByRole('link', { name: 'Pular para o conteúdo' })
      await expect(skipLink).toHaveAttribute('href', '#conteudo-principal')
      await skipLink.focus()
      await skipLink.press('Enter')
      await expect(page.locator('#conteudo-principal')).toBeFocused()
      await nav.getByRole('link', { name: role === 'ADMIN' ? 'Clientes' : 'Manifestações' }).click()
      await expect(page.getByRole('heading', { name: role === 'ADMIN' ? 'Clientes' : 'Minhas manifestações' })).toBeVisible()
      if (width < 1088) await menu.click()
      const activeNav = page.getByRole('navigation', { name: role === 'ADMIN' ? 'Navegação administrativa' : 'Navegação do cliente' })
      await expect(activeNav.getByRole('link', { name: role === 'ADMIN' ? 'Clientes' : 'Manifestações' })).toHaveAttribute('aria-current', 'page')
    })
  }
}
