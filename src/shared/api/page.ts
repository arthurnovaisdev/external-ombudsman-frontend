import { ApiError } from './errors'

// O código Java confirma Page<T>, mas não o JSON exato produzido pelo runtime.
// Consumimos apenas content; o restante do envelope aguarda validação real.
export interface PageContent<T> { content: T[] }

export function decodePageContent<T>(value: unknown): PageContent<T> {
  if (typeof value !== 'object' || value === null || !('content' in value) || !Array.isArray(value.content)) {
    throw new ApiError('invalid-response', null, 'O envelope paginado está inválido.')
  }
  return { content: value.content as T[] }
}

export interface PageRequest { page?: number; size?: number }

export function pageQuery(path: string, request: PageRequest): string {
  const params = new URLSearchParams()
  if (request.page !== undefined) params.set('page', String(request.page))
  if (request.size !== undefined) params.set('size', String(request.size))
  const query = params.toString()
  return query ? `${path}?${query}` : path
}
