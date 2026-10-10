import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ChangePasswordRequestDTO, LoginRequestDTO, UserResponseDTO } from '../../shared/api/contracts'
import { ApiError } from '../../shared/api/errors'
import { memoryToken } from '../../shared/auth/memoryToken'
import { subscribeUnauthorized } from '../../shared/auth/unauthorized'
import { accountApi } from '../account/api'
import { authApi } from './api'

export type AppRole = 'CLIENT' | 'ADMIN'

interface AuthContextValue {
  user: UserResponseDTO | null
  profileLoading: boolean
  passwordChangedNotice: boolean
  login: (credentials: LoginRequestDTO) => Promise<UserResponseDTO>
  changePassword: (body: ChangePasswordRequestDTO) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isAppRole(role: string): role is AppRole { return role === 'CLIENT' || role === 'ADMIN' }

export function destinationFor(user: UserResponseDTO): string {
  if (!user.passwordChanged) return '/primeiro-acesso'
  if (user.role === 'ADMIN') return '/admin'
  if (user.role === 'CLIENT') return '/client'
  return '/access-denied'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<UserResponseDTO | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordChangedNotice, setPasswordChangedNotice] = useState(false)
  const generation = useRef(0)

  const logout = useCallback(() => {
    generation.current += 1
    memoryToken.clear()
    setUser(null)
    setProfileLoading(false)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => subscribeUnauthorized(logout), [logout])
  useEffect(() => () => { memoryToken.clear(); queryClient.clear() }, [queryClient])

  const login = useCallback(async (credentials: LoginRequestDTO): Promise<UserResponseDTO> => {
    setPasswordChangedNotice(false)
    logout()
    const attempt = ++generation.current
    const response = await authApi.login(credentials)
    if (attempt !== generation.current) throw new ApiError('cancelled', null)
    if (!response.token || !isAppRole(response.role)) {
      throw new ApiError('invalid-response', null)
    }
    memoryToken.set(response.token)
    setProfileLoading(true)
    try {
      const profile = await accountApi.me()
      if (attempt !== generation.current) throw new ApiError('cancelled', null)
      if (!profile.active) throw new ApiError('unauthorized', 401, 'Usuário desativado ou não autorizado.')
      if (!isAppRole(profile.role) || profile.role !== response.role || profile.passwordChanged !== response.passwordChanged) {
        throw new ApiError('invalid-response', null, 'Não foi possível confirmar sua conta. Entre novamente.')
      }
      setUser(profile)
      return profile
    } catch (error) {
      logout()
      throw error
    } finally {
      if (attempt === generation.current) setProfileLoading(false)
    }
  }, [logout])

  const changePassword = useCallback(async (body: ChangePasswordRequestDTO): Promise<void> => {
    await accountApi.changePassword(body)
    // O backend incrementa tokenVersion; o token atual deixa de ser válido.
    setPasswordChangedNotice(true)
    logout()
  }, [logout])

  return <AuthContext.Provider value={{ user, profileLoading, passwordChangedNotice, login, changePassword, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return context
}
