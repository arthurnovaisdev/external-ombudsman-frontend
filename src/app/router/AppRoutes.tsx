import { Navigate, Route, Routes } from 'react-router-dom'
import { FoundationPage } from '../../pages/FoundationPage'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { DesignSystemPage } from '../../pages/DesignSystemPage'
import { LoginPage } from '../../pages/LoginPage'
import { FirstAccessPage } from '../../pages/FirstAccessPage'
import { ForgotPasswordPage } from '../../pages/ForgotPasswordPage'
import { ResetPasswordPage } from '../../pages/ResetPasswordPage'
import { RoleHomePage } from '../../pages/RoleHomePage'
import { AccountPage } from '../../pages/AccountPage'
import { AccessDeniedPage } from '../../pages/AccessDeniedPage'
import { useAuth } from '../../features/auth/AuthProvider'
import { PublicOnly, RequireAuthenticated, RequireFirstAccess, RequirePasswordChanged, RequireRole } from './guards'

function UnknownRoute() {
  const { user } = useAuth()
  return user && !user.passwordChanged ? <Navigate to="/primeiro-acesso" replace /> : <NotFoundPage />
}

export function AppRoutes({ initialResetToken }: { initialResetToken?: string | null }) {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/" element={<FoundationPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage token={initialResetToken ?? null} />} />
        {import.meta.env.DEV && <Route path="/design-system" element={<DesignSystemPage />} />}
      </Route>
      <Route element={<RequireAuthenticated />}>
        <Route element={<RequireFirstAccess />}>
          <Route path="/primeiro-acesso" element={<FirstAccessPage />} />
          <Route path="/first-access" element={<Navigate to="/primeiro-acesso" replace />} />
        </Route>
        <Route element={<RequirePasswordChanged />}>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/access-denied" element={<AccessDeniedPage />} />
          <Route element={<RequireRole role="CLIENT" />}>
            <Route path="/client" element={<RoleHomePage role="CLIENT" />} />
          </Route>
          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="/admin" element={<RoleHomePage role="ADMIN" />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<UnknownRoute />} />
    </Routes>
  )
}
