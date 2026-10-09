import { Navigate, Outlet } from 'react-router-dom'
import { destinationFor, useAuth, type AppRole } from '../../features/auth/AuthProvider'

export function PublicOnly() {
  const { user } = useAuth()
  return user ? <Navigate to={destinationFor(user)} replace /> : <Outlet />
}

export function RequireAuthenticated() {
  const { user } = useAuth()
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

export function RequireFirstAccess() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return user.passwordChanged ? <Navigate to={destinationFor(user)} replace /> : <Outlet />
}

export function RequirePasswordChanged() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return user.passwordChanged ? <Outlet /> : <Navigate to="/primeiro-acesso" replace />
}

export function RequireRole({ role }: { role: AppRole }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!user.passwordChanged) return <Navigate to="/primeiro-acesso" replace />
  return user.role === role ? <Outlet /> : <Navigate to="/access-denied" replace />
}
