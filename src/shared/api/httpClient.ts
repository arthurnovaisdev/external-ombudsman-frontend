import { ApiError, httpError } from './errors'
import { memoryToken } from '../auth/memoryToken'
import { notifyUnauthorized } from '../auth/unauthorized'

export interface RequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

export interface HttpClientConfig {
  baseUrl: string
  getToken: () => string | null
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

type Body = { kind: 'json'; value: unknown } | { kind: 'form'; value: FormData }
type Result = 'json' | 'created' | 'void' | 'no-content' | 'blob'

export class HttpClient {
  private readonly baseUrl: string
  private readonly getToken: () => string | null
  private readonly defaultTimeoutMs: number
  private readonly fetchImpl?: typeof fetch

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.getToken = config.getToken
    this.defaultTimeoutMs = config.timeoutMs ?? 15_000
    this.fetchImpl = config.fetchImpl
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.send<T>('GET', path, 'json', undefined, options)
  }

  post<T>(path: string, value: unknown, options?: RequestOptions): Promise<T> {
    return this.send<T>('POST', path, 'json', { kind: 'json', value }, options)
  }

  postCreated<T>(path: string, value: unknown, options?: RequestOptions): Promise<T> {
    return this.send<T>('POST', path, 'created', { kind: 'json', value }, options)
  }

  postEmpty<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.send<T>('POST', path, 'json', undefined, options)
  }

  postVoid(path: string, value?: unknown, options?: RequestOptions): Promise<void> {
    return this.send<void>('POST', path, 'void', value === undefined ? undefined : { kind: 'json', value }, options)
  }

  patchVoid(path: string, value?: unknown, options?: RequestOptions): Promise<void> {
    return this.send<void>('PATCH', path, 'void', value === undefined ? undefined : { kind: 'json', value }, options)
  }

  patchNoContent(path: string, value: unknown, options?: RequestOptions): Promise<void> {
    return this.send<void>('PATCH', path, 'no-content', { kind: 'json', value }, options)
  }

  postFormData(path: string, value: FormData, options?: RequestOptions): Promise<void> {
    return this.send<void>('POST', path, 'void', { kind: 'form', value }, options)
  }

  getBlob(path: string, options?: RequestOptions): Promise<Blob> {
    return this.send<Blob>('GET', path, 'blob', undefined, options)
  }

  private async send<T>(method: string, path: string, result: Result, body?: Body, options: RequestOptions = {}): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new ApiError('invalid-response', null, 'O caminho da API é inválido.')
    }
    const controller = new AbortController()
    let timedOut = false
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new ApiError('invalid-response', null, 'O timeout configurado é inválido.')
    }
    const timeout = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
    const cancel = () => controller.abort()
    options.signal?.addEventListener('abort', cancel, { once: true })
    if (options.signal?.aborted) controller.abort()

    try {
      const headers = new Headers()
      const token = this.getToken()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      if (body?.kind === 'json') headers.set('Content-Type', 'application/json')
      const response = await (this.fetchImpl ?? fetch)(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body?.kind === 'json' ? JSON.stringify(body.value) : body?.value,
        signal: controller.signal,
      })

      if (!response.ok) {
        if (response.status === 401) notifyUnauthorized()
        const raw = await response.text()
        let payload: unknown
        try { payload = JSON.parse(raw) as unknown } catch { payload = null }
        throw httpError(response.status, payload, response.headers.get('Retry-After'))
      }
      if (result === 'created' && response.status !== 201) throw new ApiError('invalid-response', response.status)
      if (result === 'no-content') {
        if (response.status !== 204) throw new ApiError('invalid-response', response.status)
        return undefined as T
      }
      if (result === 'void') return undefined as T
      if (result === 'blob') return await response.blob() as T
      if (response.status === 204) throw new ApiError('invalid-response', response.status)
      try { return await response.json() as T } catch { throw new ApiError('invalid-response', response.status) }
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (timedOut) throw new ApiError('timeout', null)
      if (controller.signal.aborted) throw new ApiError('cancelled', null)
      throw new ApiError('network', null)
    } finally {
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', cancel)
    }
  }
}

export const httpClient = new HttpClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  getToken: memoryToken.get,
})
