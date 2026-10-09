import { Navigate, Route, Routes } from 'react-router-dom'
import { FoundationPage } from '../../pages/FoundationPage'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { DesignSystemPage } from '../../pages/DesignSystemPage'
import { LoginPage } from '../../pages/LoginPage'
import { FirstAccessPage } from '../../pages/FirstAccessPage'
import { RoleHomePage } from '../../pages/RoleHomePage'
import { AccountPage } from '../../pages/AccountPage'
import { AccessDeniedPage } from '../../pages/AccessDeniedPage'
import { useAuth } from '../../features/auth/AuthProvider'
import { PublicOnly, RequireAuthenticated, RequireFirstAccess, RequirePasswordChanged, RequireRole } from './guards'

function UnknownRoute() {
  const { user } = useAuth()
  return user && !user.passwordChanged ? <Navigate to="/first-access" replace /> : <NotFoundPage />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/" element={<FoundationPage />} />
        <Route path="/login" element={<LoginPage />} />
        {import.meta.env.DEV && <Route path="/design-system" element={<DesignSystemPage />} />}
      </Route>
      <Route element={<RequireAuthenticated />}>
        <Route element={<RequireFirstAccess />}>
          <Route path="/first-access" element={<FirstAccessPage />} />
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
