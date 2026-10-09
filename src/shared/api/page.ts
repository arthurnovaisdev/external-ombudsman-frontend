import { ApiError } from './errors'

// O código Java confirma Page<T>, mas o JSON do runtime ainda precisa de
// validação HTTP autenticada. Mantenha os metadados em um decoder isolado.
export interface PageContent<T> { content: T[] }

export interface PageWithTotals<T> extends PageContent<T> {
  number: number
  size: number
  totalElements: number
  totalPages: number
}

export function decodePageContent<T>(value: unknown): PageContent<T> {
  if (typeof value !== 'object' || value === null || !('content' in value) || !Array.isArray(value.content)) {
    throw new ApiError('invalid-response', null, 'O envelope paginado está inválido.')
  }
  return { content: value.content as T[] }
}

export function decodePageWithTotals<T>(value: unknown): PageWithTotals<T> {
  const { content } = decodePageContent<T>(value)
  const page = value as Record<string, unknown>
  const valid = (field: unknown, minimum: number) =>
    typeof field === 'number' && Number.isSafeInteger(field) && field >= minimum
  if (!valid(page.number, 0) || !valid(page.size, 1) || !valid(page.totalElements, 0) || !valid(page.totalPages, 0)) {
    throw new ApiError('invalid-response', null, 'Os metadados da página estão inválidos.')
  }
  return {
    content,
    number: page.number as number,
    size: page.size as number,
    totalElements: page.totalElements as number,
    totalPages: page.totalPages as number,
  }
}

export interface PageRequest { page?: number; size?: number }

export function pageQuery(path: string, request: PageRequest): string {
  const params = new URLSearchParams()
  if (request.page !== undefined) params.set('page', String(request.page))
  if (request.size !== undefined) params.set('size', String(request.size))
  const query = params.toString()
  return query ? `${path}?${query}` : path
}
