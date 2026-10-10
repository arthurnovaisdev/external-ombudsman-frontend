import { httpClient, type RequestOptions } from '../../shared/api/httpClient'
import { decodePageWithTotals, pageQuery, type PageRequest } from '../../shared/api/page'
import type { RegisterRequestDTO, UserResponseDTO, UUID } from '../../shared/api/contracts'

export const usersApi = {
  registerClient: (body: RegisterRequestDTO, options?: RequestOptions) =>
    httpClient.postCreatedVoid('/api/auth/register', body, options),
  list: async (page: PageRequest = {}, options?: RequestOptions) =>
    decodePageWithTotals<UserResponseDTO>(await httpClient.get<unknown>(pageQuery('/api/users', page), options)),
  byId: (id: UUID, options?: RequestOptions) =>
    httpClient.get<UserResponseDTO>(`/api/users/${encodeURIComponent(id)}`, options),
  deactivate: (id: UUID, options?: RequestOptions) =>
    httpClient.patchNoContentEmpty(`/api/users/${encodeURIComponent(id)}/deactivate`, options),
  activate: (id: UUID, options?: RequestOptions) =>
    httpClient.patchNoContentEmpty(`/api/users/${encodeURIComponent(id)}/activate`, options),
}
