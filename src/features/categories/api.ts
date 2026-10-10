import { httpClient, type RequestOptions } from '../../shared/api/httpClient'
import { decodePageWithTotals, pageQuery, type PageRequest } from '../../shared/api/page'
import type { CategoryRequestDTO, CategoryResponseDTO } from '../../shared/api/contracts'

export const categoriesApi = {
  list: async (page: PageRequest = {}, options?: RequestOptions) =>
    decodePageWithTotals<CategoryResponseDTO>(await httpClient.get<unknown>(pageQuery('/api/categories', page), options)),
  create: (body: CategoryRequestDTO, options?: RequestOptions) =>
    httpClient.postCreated<CategoryResponseDTO>('/api/categories', body, options),
}
