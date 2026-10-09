import { httpClient, type RequestOptions } from '../../shared/api/httpClient'
import type { UUID } from '../../shared/api/contracts'

function path(scope: 'mine' | 'admin', protocol: string, id?: UUID): string {
  const base = `/api/reports/${scope}/${encodeURIComponent(protocol)}/attachments`
  return id === undefined ? base : `${base}/${encodeURIComponent(id)}`
}

// O backend pode responder 503 quando anexos estão desabilitados.
// A camada de apresentação deve respeitar VITE_ATTACHMENTS_ENABLED.
export const attachmentsApi = {
  uploadMine: (protocol: string, files: readonly File[], options?: RequestOptions) => {
    const form = new FormData()
    files.forEach((file) => form.append('files', file))
    return httpClient.postFormData(path('mine', protocol), form, options)
  },
  downloadMine: (protocol: string, id: UUID, options?: RequestOptions) =>
    httpClient.getBlob(path('mine', protocol, id), options),
  downloadAdmin: (protocol: string, id: UUID, options?: RequestOptions) =>
    httpClient.getBlob(path('admin', protocol, id), options),
}
