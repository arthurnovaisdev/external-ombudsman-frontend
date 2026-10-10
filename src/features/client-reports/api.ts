import { httpClient, type RequestOptions } from '../../shared/api/httpClient'
import { decodePageWithTotals, pageQuery, type PageRequest } from '../../shared/api/page'
import type { ProtocolResponseDTO, ReportRequestDTO, ReportResponseDTO } from '../../shared/api/contracts'

export const clientReportsApi = {
  create: (body: ReportRequestDTO, options?: RequestOptions) =>
    httpClient.postCreated<ProtocolResponseDTO>('/api/reports', body, options),
  list: async (page: PageRequest = {}, options?: RequestOptions) =>
    decodePageWithTotals<ReportResponseDTO>(await httpClient.get<unknown>(pageQuery('/api/reports/mine', page), options)),
  detail: (protocol: string, options?: RequestOptions) =>
    httpClient.get<ReportResponseDTO>(`/api/reports/mine/${encodeURIComponent(protocol)}`, options),
}
