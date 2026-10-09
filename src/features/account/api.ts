import { httpClient, type RequestOptions } from '../../shared/api/httpClient'
import type { ChangePasswordRequestDTO, UserResponseDTO } from '../../shared/api/contracts'

export const accountApi = {
  me: (options?: RequestOptions) => httpClient.get<UserResponseDTO>('/api/users/me', options),
  changePassword: (body: ChangePasswordRequestDTO, options?: RequestOptions) =>
    httpClient.patchNoContent('/api/users/me/password', body, options),
}
