import { httpClient, type RequestOptions } from '../../shared/api/httpClient'
import type {
  ForgotPasswordRequestDTO, LoginRequestDTO, LoginResponseDTO,
  ResetPasswordRequestDTO,
} from '../../shared/api/contracts'

export const authApi = {
  login: (body: LoginRequestDTO, options?: RequestOptions) =>
    httpClient.post<LoginResponseDTO>('/api/auth/login', body, options),
  forgotPassword: (body: ForgotPasswordRequestDTO, options?: RequestOptions) =>
    httpClient.postVoid('/api/auth/forgot-password', body, options),
  resetPassword: (body: ResetPasswordRequestDTO, options?: RequestOptions) =>
    httpClient.postVoid('/api/auth/reset-password', body, options),
}
