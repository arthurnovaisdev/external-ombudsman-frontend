import { afterEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { accountApi } from '../../features/account/api'
import { adminReportsApi } from '../../features/admin-reports/api'
import { attachmentsApi } from '../../features/attachments/api'
import { authApi } from '../../features/auth/api'
import { categoriesApi } from '../../features/categories/api'
import { clientReportsApi } from '../../features/client-reports/api'
import { reportMessagesApi } from '../../features/report-messages/api'
import { usersApi } from '../../features/users/api'
import { memoryToken } from '../auth/memoryToken'
import { fixtures } from '../../test/handlers'
import { server } from '../../test/server'
import { ApiError, parseRetryAfter } from './errors'
import { HttpClient } from './httpClient'

const origin = 'http://localhost:8080'
const timestamp = '2026-10-09T10:00:00'

afterEach(() => memoryToken.clear())

describe('cliente HTTP e contratos', () => {
  it('envia JSON, recebe login e não exige token na rota pública', async () => {
    expect(await authApi.login({ username: 'cliente', password: 'senha-correta' })).toEqual(fixtures.login)
    await expect(authApi.forgotPassword({ username: 'cliente' })).resolves.toBeUndefined()
    await expect(authApi.resetPassword({ token: 'a'.repeat(43), newPassword: 'nova-senha' })).resolves.toBeUndefined()
  })

  it('envia Bearer somente da memória, sem configurar cookies ou CSRF', async () => {
    let captured: RequestInit | undefined
    const client = new HttpClient({
      baseUrl: `${origin}/`, getToken: () => 'mock-jwt',
      fetchImpl: (input, init) => { captured = init; return fetch(input, init) },
    })
    expect(await client.get('/api/users/me')).toEqual(fixtures.user)
    const headers = new Headers(captured?.headers)
    expect(headers.get('Authorization')).toBe('Bearer mock-jwt')
    expect(headers.get('x-csrf-token')).toBeNull()
    expect(captured?.credentials).toBeUndefined()
  })

  it('mantém campos nulos e lê o total paginado somente em manifestações do cliente', async () => {
    memoryToken.set('mock-jwt')
    const first = await clientReportsApi.list({ page: 0, size: 1 })
    const second = await clientReportsApi.list({ page: 1, size: 1 })
    expect(first.content).toEqual([fixtures.report])
    expect(second.content).toEqual([fixtures.closedReport])
    expect(first).toMatchObject({ number: 0, size: 1, totalElements: 2, totalPages: 2 })
    expect(second).toMatchObject({ number: 1, size: 1, totalElements: 2, totalPages: 2 })
    expect(first.content[0].closedAt).toBeNull()
    expect(first.content[0].messagesPurgedAt).toBeNull()
    expect(second.content[0].closedAt).toBe('2026-10-09T11:00:00Z')
    expect(second.content[0].messagesPurgedAt).toBe('2026-11-09T11:00:00Z')
    expect((await categoriesApi.list({ page: 0, size: 20 })).content).toEqual([fixtures.category])
    expect((await reportMessagesApi.listMine(fixtures.protocol)).content).toEqual([fixtures.message])
    memoryToken.set('mock-admin-jwt')
    expect((await usersApi.list({ page: 0, size: 20 })).content).toEqual([fixtures.user])
    expect((await adminReportsApi.list({ page: 0, size: 10 })).content).toEqual([fixtures.summary])
  })

  it('usa apenas rotas existentes para leitura e escrita', async () => {
    memoryToken.set('mock-jwt')
    expect(await accountApi.me()).toEqual(fixtures.user)
    await expect(accountApi.changePassword({ currentPassword: 'antiga', newPassword: 'nova-senha' })).resolves.toBeUndefined()
    memoryToken.set('mock-admin-jwt')
    expect(await categoriesApi.create({ name: 'Atendimento', active: true })).toEqual(fixtures.category)
    memoryToken.set('mock-jwt')
    expect(await clientReportsApi.create({ categoryId: fixtures.category.id, description: 'Relato', incidentDate: null, incidentLocation: null }))
      .toEqual({ protocol: fixtures.protocol })
    expect(await clientReportsApi.detail(fixtures.protocol)).toEqual(fixtures.report)
    memoryToken.set('mock-admin-jwt')
    expect(await adminReportsApi.detail(fixtures.protocol)).toMatchObject({ attachments: [fixtures.attachment] })
    expect((await adminReportsApi.close(fixtures.protocol)).closedAt).toBe(fixtures.closedReport.closedAt)
    memoryToken.set('mock-jwt')
    expect(await reportMessagesApi.sendMine(fixtures.protocol, { body: 'Mensagem de teste' })).toEqual(fixtures.message)
  })

  it('respeita papéis e bloqueio de primeiro acesso nos mocks', async () => {
    memoryToken.set('mock-jwt')
    await expect(adminReportsApi.list()).rejects.toMatchObject({ kind: 'forbidden', status: 403 })
    memoryToken.set('mock-first-access')
    expect((await accountApi.me()).passwordChanged).toBe(false)
    await expect(accountApi.changePassword({ currentPassword: 'provisoria', newPassword: 'nova-senha' }))
      .resolves.toBeUndefined()
    await expect(clientReportsApi.list()).rejects.toMatchObject({
      kind: 'forbidden', status: 403,
      message: 'É necessário alterar a senha provisória antes de utilizar o sistema.',
    })
  })

  it('decodifica o erro comum e o erro de validação', async () => {
    await expect(authApi.login({ username: 'cliente', password: 'errada' })).rejects.toMatchObject({
      kind: 'unauthorized', status: 401, message: 'Username ou senha inválidos.', timestamp,
    })
    await expect(authApi.login({ username: '', password: 'senha-correta' })).rejects.toMatchObject({
      kind: 'bad-request', status: 400, details: { username: 'O username não pode estar vazio.' }, timestamp,
    })
  })

  it('classifica os status previstos e não confia em corpo inválido', async () => {
    const cases = [
      [400, 'bad-request'], [401, 'unauthorized'], [403, 'forbidden'], [404, 'not-found'],
      [409, 'conflict'], [413, 'payload-too-large'], [429, 'rate-limited'],
      [500, 'server-error'], [503, 'unavailable'],
    ] as const
    for (const [status, kind] of cases) {
      server.use(http.get(`${origin}/api/users/me`, () => HttpResponse.json({ status: 999, erro: 'Mensagem não confiável', timestamp }, { status })))
      await expect(accountApi.me()).rejects.toMatchObject({ kind, status, timestamp: null })
    }
  })

  it('preserva o erro confirmado do backend para todos os status previstos', async () => {
    const cases = [400, 401, 403, 404, 409, 413, 429, 500, 503] as const
    for (const status of cases) {
      server.use(http.get(`${origin}/api/users/me`, () =>
        HttpResponse.json({ status, erro: `Erro ${status}`, timestamp }, { status })))
      await expect(accountApi.me()).rejects.toMatchObject({ status, message: `Erro ${status}`, timestamp })
    }
  })

  it('lê Retry-After apenas como segundos válidos', async () => {
    await expect(authApi.login({ username: 'limited', password: 'senha-correta' })).rejects.toMatchObject({
      kind: 'rate-limited', status: 429, retryAfterSeconds: 60,
    })
    expect(parseRetryAfter('60')).toBe(60)
    expect(parseRetryAfter('-1')).toBeNull()
    expect(parseRetryAfter('9999999999999999')).toBeNull()
    expect(parseRetryAfter('Fri, 09 Oct 2026 12:00:00 GMT')).toBeNull()
  })

  it('envia FormData sem Content-Type manual e baixa Blob', async () => {
    memoryToken.set('mock-jwt')
    server.use(
      http.post(`${origin}/api/reports/mine/:protocol/attachments`, async ({ request }) => {
        expect(request.headers.get('Content-Type')).toMatch(/^multipart\/form-data; boundary=/)
        return new HttpResponse(null, { status: 201 })
      }),
      http.get(`${origin}/api/reports/mine/:protocol/attachments/:id`, () =>
        new HttpResponse('PDF!', { status: 200, headers: { 'Content-Type': 'application/pdf' } })),
    )
    await expect(attachmentsApi.uploadMine(fixtures.protocol, [new File(['PDF!'], 'comprovante.pdf', { type: 'application/pdf' })]))
      .resolves.toBeUndefined()
    const blob = await attachmentsApi.downloadMine(fixtures.protocol, fixtures.attachment.id)
    expect(blob).toBeInstanceOf(Blob)
    expect(await blob.text()).toBe('PDF!')
  })

  it('informa 503 quando anexos estão desabilitados no backend', async () => {
    memoryToken.set('mock-jwt')
    await expect(attachmentsApi.downloadMine(fixtures.protocol, fixtures.attachment.id)).rejects.toMatchObject({
      kind: 'unavailable', status: 503, message: 'A recuperação de anexos está temporariamente indisponível.',
    })
  })

  it('rejeita envelope paginado sem content', async () => {
    memoryToken.set('mock-jwt')
    server.use(http.get(`${origin}/api/categories`, () => HttpResponse.json({ items: [] })))
    await expect(categoriesApi.list()).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('rejeita total paginado ausente ou inválido nas manifestações do cliente', async () => {
    memoryToken.set('mock-jwt')
    server.use(http.get(`${origin}/api/reports/mine`, () => HttpResponse.json({ content: [fixtures.report] })))
    await expect(clientReportsApi.list({ page: 0, size: 10 })).rejects.toMatchObject({ kind: 'invalid-response' })
    server.use(http.get(`${origin}/api/reports/mine`, () => HttpResponse.json({
      content: [fixtures.report], number: 0, size: 10, totalElements: -1, totalPages: 1,
    })))
    await expect(clientReportsApi.list({ page: 0, size: 10 })).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('diferencia timeout de cancelamento explícito', async () => {
    const hangingFetch: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Abortado', 'AbortError')))
    })
    const client = new HttpClient({ baseUrl: origin, getToken: () => null, fetchImpl: hangingFetch, timeoutMs: 5 })
    await expect(client.get('/api/health')).rejects.toMatchObject({ kind: 'timeout' })
    const controller = new AbortController()
    const pending = client.get('/api/health', { signal: controller.signal, timeoutMs: 500 })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' })
  })

  it('mantém erros identificáveis pela classe ApiError', async () => {
    await expect(authApi.login({ username: 'cliente', password: 'errada' })).rejects.toBeInstanceOf(ApiError)
  })
})
