import { httpClient, type RequestOptions } from '../../shared/api/httpClient'
import { decodePageContent, pageQuery, type PageRequest } from '../../shared/api/page'
import type { ReportMessageRequestDTO, ReportMessageResponseDTO } from '../../shared/api/contracts'

function path(scope: 'mine' | 'admin', protocol: string): string {
  return `/api/reports/${scope}/${encodeURIComponent(protocol)}/messages`
}

export const reportMessagesApi = {
  listMine: async (protocol: string, page: PageRequest = {}, options?: RequestOptions) =>
    decodePageContent<ReportMessageResponseDTO>(await httpClient.get<unknown>(pageQuery(path('mine', protocol), page), options)),
  sendMine: (protocol: string, body: ReportMessageRequestDTO, options?: RequestOptions) =>
    httpClient.post<ReportMessageResponseDTO>(path('mine', protocol), body, options),
  listAdmin: async (protocol: string, page: PageRequest = {}, options?: RequestOptions) =>
    decodePageContent<ReportMessageResponseDTO>(await httpClient.get<unknown>(pageQuery(path('admin', protocol), page), options)),
  sendAdmin: (protocol: string, body: ReportMessageRequestDTO, options?: RequestOptions) =>
    httpClient.post<ReportMessageResponseDTO>(path('admin', protocol), body, options),
}
