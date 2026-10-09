import { httpClient, type RequestOptions } from '../../shared/api/httpClient'
import { decodePageContent, pageQuery, type PageRequest } from '../../shared/api/page'
import type { ReportAdminResponseDTO, ReportAdminSummaryResponseDTO } from '../../shared/api/contracts'

export const adminReportsApi = {
  list: async (page: PageRequest = {}, options?: RequestOptions) =>
    decodePageContent<ReportAdminSummaryResponseDTO>(await httpClient.get<unknown>(pageQuery('/api/reports/admin', page), options)),
  detail: (protocol: string, options?: RequestOptions) =>
    httpClient.get<ReportAdminResponseDTO>(`/api/reports/admin/${encodeURIComponent(protocol)}`, options),
  close: (protocol: string, options?: RequestOptions) =>
    httpClient.postEmpty<ReportAdminResponseDTO>(`/api/reports/admin/${encodeURIComponent(protocol)}/close`, options),
}
