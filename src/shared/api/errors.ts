import type { ErrorResponseDTO, ValidationErrorResponseDTO } from './contracts'

export type ApiErrorKind =
  | 'bad-request' | 'unauthorized' | 'forbidden' | 'not-found'
  | 'conflict' | 'payload-too-large' | 'rate-limited'
  | 'server-error' | 'unavailable' | 'http-error'
  | 'timeout' | 'cancelled' | 'network' | 'invalid-response'

const knownStatusKinds: Record<number, ApiErrorKind> = {
  400: 'bad-request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  413: 'payload-too-large',
  429: 'rate-limited',
  500: 'server-error',
  503: 'unavailable',
}

const fallbackMessages: Record<ApiErrorKind, string> = {
  'bad-request': 'A requisição é inválida.',
  unauthorized: 'É necessário entrar novamente.',
  forbidden: 'Você não tem permissão para esta ação.',
  'not-found': 'Recurso não encontrado.',
  conflict: 'A operação entrou em conflito com os dados existentes.',
  'payload-too-large': 'O arquivo excede o tamanho permitido.',
  'rate-limited': 'Muitas tentativas. Aguarde antes de tentar novamente.',
  'server-error': 'Erro interno do servidor.',
  unavailable: 'O serviço está temporariamente indisponível.',
  'http-error': 'Não foi possível concluir a requisição.',
  timeout: 'A requisição demorou demais.',
  cancelled: 'A requisição foi cancelada.',
  network: 'Não foi possível conectar ao servidor.',
  'invalid-response': 'O servidor retornou uma resposta inválida.',
}

export class ApiError extends Error {
  readonly name = 'ApiError'

  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number | null,
    message = fallbackMessages[kind],
    readonly timestamp: string | null = null,
    readonly details: Record<string, string> | null = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringDetails(value: unknown): Record<string, string> | null {
  if (!isRecord(value) || !Object.values(value).every((item) => typeof item === 'string')) {
    return null
  }
  return value as Record<string, string>
}

export function parseErrorResponse(value: unknown): ErrorResponseDTO | ValidationErrorResponseDTO | null {
  if (!isRecord(value) || typeof value.status !== 'number' || typeof value.timestamp !== 'string') {
    return null
  }
  if (typeof value.erro === 'string') {
    return { status: value.status, erro: value.erro, timestamp: value.timestamp }
  }
  const detalhes = stringDetails(value.detalhes)
  return detalhes ? { status: value.status, detalhes, timestamp: value.timestamp } : null
}

// O filtro atual envia segundos inteiros. Valores malformados ou excessivos são ignorados.
export function parseRetryAfter(value: string | null): number | null {
  if (value === null || !/^\d{1,6}$/.test(value.trim())) return null
  const seconds = Number(value.trim())
  return Number.isSafeInteger(seconds) && seconds <= 86_400 ? seconds : null
}

export function httpError(status: number, payload: unknown, retryAfter: string | null): ApiError {
  const kind = knownStatusKinds[status] ?? 'http-error'
  const parsed = parseErrorResponse(payload)
  if (parsed?.status !== status) {
    return new ApiError(kind, status, undefined, null, null, parseRetryAfter(retryAfter))
  }
  if ('erro' in parsed) {
    return new ApiError(kind, status, parsed.erro, parsed.timestamp, null, parseRetryAfter(retryAfter))
  }
  return new ApiError(kind, status, undefined, parsed.timestamp, parsed.detalhes, parseRetryAfter(retryAfter))
}
