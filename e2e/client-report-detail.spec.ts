import { expect, test } from '@playwright/test'

const protocol = 'DEN-2026-ABCDEFGH'
const report = {
  protocol, category: 'Atendimento', description: 'Relato de teste', incidentDate: '2026-10-08',
  incidentLocation: 'Escritório', createdAt: '2026-10-09T10:00:00Z', closedAt: null, messagesPurgedAt: null,
}

for (const width of [375, 1280]) {
  test(`detalhe CLIENT e mensagens em ${width}px`, async ({ page }) => {
    const requests: string[] = []
    const sentBodies: unknown[] = []
    const messages = Array.from({ length: 21 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      authorName: index === 0 ? 'Admin Interno' : 'Cliente Exemplo',
      authorUsername: index === 0 ? 'admin.secreto' : 'cliente',
      authorRole: index === 0 ? 'ADMIN' : 'CLIENT',
      body: `Mensagem ${index + 1}`, createdAt: `2026-10-09T10:${String(index).padStart(2, '0')}:00Z`,
    }))
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
      if (url.pathname === '/api/auth/login') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
        token: 'client-report-token', name: 'Cliente Exemplo', role: 'CLIENT', passwordChanged: true,
      }) })
      if (url.pathname === '/api/users/me') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
        id: '11111111-1111-4111-8111-111111111111', name: 'Cliente Exemplo', username: 'cliente',
        contactEmail: null, role: 'CLIENT', active: true, passwordChanged: true,
      }) })
      if (url.pathname === '/api/reports/mine') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
        content: [report], number: 0, size: 5, totalElements: 1, totalPages: 1,
      }) })
      if (url.pathname === `/api/reports/mine/${protocol}`) return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(report) })
      if (url.pathname === `/api/reports/mine/${protocol}/messages`) {
        if (request.method() === 'POST') {
          sentBodies.push(request.postDataJSON())
          const created = { ...messages[1], id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', body: 'Resposta enviada' }
          messages.push(created)
          return route.fulfill({ status: 201, headers: cors, contentType: 'application/json', body: JSON.stringify(created) })
        }
        requests.push(url.search)
        const number = Number(url.searchParams.get('page'))
        const size = Number(url.searchParams.get('size'))
        return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
          content: messages.slice(number * size, (number + 1) * size), number, size,
          totalElements: messages.length, totalPages: Math.ceil(messages.length / size),
        }) })
      }
      return route.fulfill({ status: 404, headers: cors })
    })

    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Username' }).fill('cliente')
    await page.getByLabel('Senha').fill('senha-correta')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.getByRole('link', { name: /Ver detalhes da manifestação/ }).click()
    await expect(page.getByRole('heading', { name: 'Histórico de mensagens' })).toBeVisible()
    await expect(page.getByText('Equipe da Ouvidoria')).toBeVisible()
    await expect(page.getByText('admin.secreto')).toHaveCount(0)
    await expect(page.getByText('Mensagem 1', { exact: true })).toBeVisible()
    await expect(page.getByText('Página 1 de 2')).toBeVisible()
    await page.getByRole('button', { name: 'Próxima' }).click()
    await expect(page.getByText('Mensagem 21')).toBeVisible()
    await page.getByRole('textbox', { name: 'Mensagem' }).fill('Resposta enviada')
    await page.getByRole('button', { name: 'Enviar mensagem' }).click()
    await expect(page.getByText('Resposta enviada', { exact: true })).toBeVisible()
    expect(requests).toContain('?page=0&size=20')
    expect(requests).toContain('?page=1&size=20')
    expect(sentBodies).toEqual([{ body: 'Resposta enviada' }])
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  })
}
