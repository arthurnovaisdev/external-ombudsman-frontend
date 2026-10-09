import { httpClient, type RequestOptions } from '../../shared/api/httpClient'
import { decodePageContent, pageQuery, type PageRequest } from '../../shared/api/page'
import type { RegisterRequestDTO, UserResponseDTO, UUID } from '../../shared/api/contracts'

export const usersApi = {
  registerClient: (body: RegisterRequestDTO, options?: RequestOptions) =>
    httpClient.postVoid('/api/auth/register', body, options),
  list: async (page: PageRequest = {}, options?: RequestOptions) =>
    decodePageContent<UserResponseDTO>(await httpClient.get<unknown>(pageQuery('/api/users', page), options)),
  byId: (id: UUID, options?: RequestOptions) =>
    httpClient.get<UserResponseDTO>(`/api/users/${encodeURIComponent(id)}`, options),
  deactivate: (id: UUID, options?: RequestOptions) =>
    httpClient.patchVoid(`/api/users/${encodeURIComponent(id)}/deactivate`, undefined, options),
  activate: (id: UUID, options?: RequestOptions) =>
    httpClient.patchVoid(`/api/users/${encodeURIComponent(id)}/activate`, undefined, options),
}
