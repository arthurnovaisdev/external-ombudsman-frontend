import { http, HttpResponse, type HttpHandler } from 'msw'
import type {
  AttachmentResponseDTO, CategoryResponseDTO, LoginResponseDTO,
  ReportAdminResponseDTO, ReportAdminSummaryResponseDTO,
  ReportMessageResponseDTO, ReportResponseDTO, UserResponseDTO,
} from '../shared/api/contracts'

const origin = 'http://localhost:8080'
const protocol = 'DEN-2026-ABCDEFGH'
const timestamp = '2026-10-09T10:00:00'

export const fixtures = {
  protocol,
  login: { token: 'mock-jwt', name: 'Cliente Exemplo', role: 'CLIENT', passwordChanged: true } satisfies LoginResponseDTO,
  user: {
    id: '11111111-1111-4111-8111-111111111111', name: 'Cliente Exemplo', username: 'cliente',
    contactEmail: null, role: 'CLIENT', active: true, passwordChanged: true,
  } satisfies UserResponseDTO,
  category: { id: '22222222-2222-4222-8222-222222222222', name: 'Atendimento', active: true } satisfies CategoryResponseDTO,
  report: {
    protocol, category: 'Atendimento', description: 'Relato de teste', incidentDate: null,
    incidentLocation: null, createdAt: '2026-10-09T10:00:00Z', closedAt: null,
    messagesPurgedAt: null,
  } satisfies ReportResponseDTO,
  closedReport: {
    protocol, category: 'Atendimento', description: 'Relato de teste', incidentDate: null,
    incidentLocation: null, createdAt: '2026-10-09T10:00:00Z',
    closedAt: '2026-10-09T11:00:00Z', messagesPurgedAt: '2026-11-09T11:00:00Z',
  } satisfies ReportResponseDTO,
  summary: {
    protocol, category: 'Atendimento', description: 'Relato de teste',
    createdAt: '2026-10-09T10:00:00Z', closedAt: null,
    ownerName: 'Cliente Exemplo', ownerUsername: 'cliente',
  } satisfies ReportAdminSummaryResponseDTO,
  attachment: {
    id: '33333333-3333-4333-8333-333333333333', originalFileName: 'comprovante.pdf',
    contentType: 'application/pdf', fileSize: 4, createdAt: '2026-10-09T10:00:00',
  } satisfies AttachmentResponseDTO,
  message: {
    id: '44444444-4444-4444-8444-444444444444', authorName: 'Cliente Exemplo',
    authorUsername: 'cliente', authorRole: 'CLIENT', body: 'Mensagem de teste',
    createdAt: '2026-10-09T10:02:00Z',
  } satisfies ReportMessageResponseDTO,
}

const adminDetail: ReportAdminResponseDTO = {
  ...fixtures.report, ownerName: 'Cliente Exemplo', ownerUsername: 'cliente',
  ownerContactEmail: null, attachments: [fixtures.attachment],
}

function page<T>(request: Request, items: readonly T[]): { content: T[] } {
  const url = new URL(request.url)
  const number = Number(url.searchParams.get('page') ?? 0)
  const size = Number(url.searchParams.get('size') ?? 10)
  return { content: items.slice(number * size, (number + 1) * size) }
}

function error(status: number, erro: string, headers?: HeadersInit) {
  return HttpResponse.json({ status, erro, timestamp }, { status, headers })
}

function deny(request: Request, role: 'CLIENT' | 'ADMIN' | 'ANY' = 'ANY', allowFirstAccess = false): Response | null {
  const token = request.headers.get('Authorization')
  if (token === 'Bearer mock-expired') return error(401, 'Sessão expirada. Faça login novamente.')
  const actualRole = token === 'Bearer mock-admin-jwt' ? 'ADMIN'
    : token === 'Bearer mock-jwt' || token === 'Bearer mock-first-access' || token === 'Bearer mock-inactive' ? 'CLIENT' : null
  if (actualRole === null) return error(401, 'Token ausente, inválido ou expirado')
  if (token === 'Bearer mock-first-access' && !allowFirstAccess) {
    return error(403, 'É necessário alterar a senha provisória antes de utilizar o sistema.')
  }
  return role === 'ANY' || role === actualRole ? null : error(403, 'Você não tem permissão para acessar este recurso')
}

export const handlers: HttpHandler[] = [
  http.post(`${origin}/api/auth/login`, async ({ request }) => {
    const body = await request.json() as { username?: string; password?: string }
    if (!body.username) {
      return HttpResponse.json({ status: 400, detalhes: { username: 'O username não pode estar vazio.' }, timestamp }, { status: 400 })
    }
    if (body.username === 'limited') return error(429, 'Muitas tentativas. Aguarde antes de tentar novamente.', { 'Retry-After': '60' })
    if (body.username === 'desativado') return error(401, 'Usuário desativado ou não autorizado.')
    if (body.password !== 'senha-correta') return error(401, 'Username ou senha inválidos.')
    if (body.username === 'admin') return HttpResponse.json({ token: 'mock-admin-jwt', name: 'Admin Exemplo', role: 'ADMIN', passwordChanged: true } satisfies LoginResponseDTO)
    if (body.username === 'primeiroacesso') return HttpResponse.json({ token: 'mock-first-access', name: 'Cliente Exemplo', role: 'CLIENT', passwordChanged: false } satisfies LoginResponseDTO)
    if (body.username === 'expirado') return HttpResponse.json({ ...fixtures.login, token: 'mock-expired' })
    if (body.username === 'inativo') return HttpResponse.json({ ...fixtures.login, token: 'mock-inactive' })
    return HttpResponse.json(fixtures.login)
  }),
  http.post(`${origin}/api/auth/forgot-password`, () => new HttpResponse(null, { status: 200 })),
  http.post(`${origin}/api/auth/reset-password`, () => new HttpResponse(null, { status: 200 })),
  http.post(`${origin}/api/auth/register`, ({ request }) => deny(request, 'ADMIN') ?? new HttpResponse(null, { status: 201 })),
  http.get(`${origin}/api/users/me`, ({ request }) => {
    const denied = deny(request, 'ANY', true)
    if (denied) return denied
    const token = request.headers.get('Authorization')
    return HttpResponse.json({
      ...fixtures.user,
      name: token === 'Bearer mock-admin-jwt' ? 'Admin Exemplo' : fixtures.user.name,
      role: token === 'Bearer mock-admin-jwt' ? 'ADMIN' : 'CLIENT',
      active: token !== 'Bearer mock-inactive',
      passwordChanged: token !== 'Bearer mock-first-access',
    } satisfies UserResponseDTO)
  }),
  http.patch(`${origin}/api/users/me/password`, ({ request }) => deny(request, 'ANY', true) ?? new HttpResponse(null, { status: 204 })),
  http.get(`${origin}/api/users`, ({ request }) => deny(request, 'ADMIN') ?? HttpResponse.json(page(request, [fixtures.user]))),
  http.get(`${origin}/api/users/:id`, ({ request }) => deny(request, 'ADMIN') ?? HttpResponse.json(fixtures.user)),
  http.patch(`${origin}/api/users/:id/deactivate`, ({ request }) => deny(request, 'ADMIN') ?? new HttpResponse(null, { status: 204 })),
  http.patch(`${origin}/api/users/:id/activate`, ({ request }) => deny(request, 'ADMIN') ?? new HttpResponse(null, { status: 204 })),
  http.get(`${origin}/api/categories`, ({ request }) => deny(request) ?? HttpResponse.json(page(request, [fixtures.category]))),
  http.post(`${origin}/api/categories`, ({ request }) => deny(request, 'ADMIN') ?? HttpResponse.json(fixtures.category, { status: 201 })),
  http.post(`${origin}/api/reports`, ({ request }) => deny(request, 'CLIENT') ?? HttpResponse.json({ protocol }, { status: 201 })),
  http.get(`${origin}/api/reports/mine`, ({ request }) => deny(request, 'CLIENT') ?? HttpResponse.json(page(request, [fixtures.report, fixtures.closedReport]))),
  http.get(`${origin}/api/reports/mine/:protocol`, ({ request }) => deny(request, 'CLIENT') ?? HttpResponse.json(fixtures.report)),
  http.get(`${origin}/api/reports/admin`, ({ request }) => deny(request, 'ADMIN') ?? HttpResponse.json(page(request, [fixtures.summary]))),
  http.get(`${origin}/api/reports/admin/:protocol`, ({ request }) => deny(request, 'ADMIN') ?? HttpResponse.json(adminDetail)),
  http.post(`${origin}/api/reports/admin/:protocol/close`, ({ request }) => deny(request, 'ADMIN') ?? HttpResponse.json({ ...adminDetail, closedAt: fixtures.closedReport.closedAt })),
  http.get(`${origin}/api/reports/mine/:protocol/messages`, ({ request }) => deny(request, 'CLIENT') ?? HttpResponse.json(page(request, [fixtures.message]))),
  http.get(`${origin}/api/reports/admin/:protocol/messages`, ({ request }) => deny(request, 'ADMIN') ?? HttpResponse.json(page(request, [fixtures.message]))),
  http.post(`${origin}/api/reports/mine/:protocol/messages`, ({ request }) => deny(request, 'CLIENT') ?? HttpResponse.json(fixtures.message, { status: 201 })),
  http.post(`${origin}/api/reports/admin/:protocol/messages`, ({ request }) => deny(request, 'ADMIN') ?? HttpResponse.json(fixtures.message, { status: 201 })),
  http.post(`${origin}/api/reports/mine/:protocol/attachments`, ({ request }) => deny(request, 'CLIENT') ?? error(503, 'O envio de anexos está temporariamente indisponível.')),
  http.get(`${origin}/api/reports/mine/:protocol/attachments/:id`, ({ request }) => deny(request, 'CLIENT') ?? error(503, 'A recuperação de anexos está temporariamente indisponível.')),
  http.get(`${origin}/api/reports/admin/:protocol/attachments/:id`, ({ request }) => deny(request, 'ADMIN') ?? error(503, 'A recuperação de anexos está temporariamente indisponível.')),
]
