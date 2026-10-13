import { httpClient, type RequestOptions } from '../../shared/api/httpClient'
import { decodePageWithTotals, pageQuery, type PageRequest } from '../../shared/api/page'
import type { CategoryRequestDTO, CategoryResponseDTO } from '../../shared/api/contracts'

export const categoriesApi = {
  list: async (page: PageRequest = {}, options?: RequestOptions) =>
    decodePageWithTotals<CategoryResponseDTO>(await httpClient.get<unknown>(pageQuery('/api/categories', page), options)),
  listAdmin: async (page: PageRequest = {}, options?: RequestOptions) =>
    decodePageWithTotals<CategoryResponseDTO>(await httpClient.get<unknown>(pageQuery('/api/categories/admin', page), options)),
  create: (body: CategoryRequestDTO, options?: RequestOptions) =>
    httpClient.postCreated<CategoryResponseDTO>('/api/categories', body, options),
  deactivate: (id: string, options?: RequestOptions) =>
    httpClient.patchNoContentEmpty(`/api/categories/${encodeURIComponent(id)}/deactivate`, options),
}
