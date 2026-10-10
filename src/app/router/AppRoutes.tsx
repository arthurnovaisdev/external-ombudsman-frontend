import { Navigate, Route, Routes } from 'react-router-dom'
import { FoundationPage } from '../../pages/FoundationPage'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { DesignSystemPage } from '../../pages/DesignSystemPage'
import { LoginPage } from '../../pages/LoginPage'
import { FirstAccessPage } from '../../pages/FirstAccessPage'
import { ForgotPasswordPage } from '../../pages/ForgotPasswordPage'
import { ResetPasswordPage } from '../../pages/ResetPasswordPage'
import { AccountPage } from '../../pages/AccountPage'
import { AccessDeniedPage } from '../../pages/AccessDeniedPage'
import { SectionPage } from '../../pages/SectionPage'
import { ClientLayout } from '../layouts/ClientLayout'
import { AdminLayout } from '../layouts/AdminLayout'
import { ClientDashboardPage } from '../../features/client-reports/ClientDashboardPage'
import { ClientReportsPage } from '../../features/client-reports/ClientReportsPage'
import { ClientReportDetailPage } from '../../features/client-reports/ClientReportDetailPage'
import { CreateReportPage } from '../../features/client-reports/CreateReportPage'
import { AdminDashboardPage } from '../../features/admin-reports/AdminDashboardPage'
import { AdminReportsPage } from '../../features/admin-reports/AdminReportsPage'
import { AdminReportDetailPage } from '../../features/admin-reports/AdminReportDetailPage'
import { AdminUsersPage } from '../../features/users/AdminUsersPage'
import { CreateClientPage } from '../../features/users/CreateClientPage'
import { useAuth } from '../../features/auth/AuthProvider'
import { PublicOnly, RequireAuthenticated, RequireFirstAccess, RequirePasswordChanged, RequireRole } from './guards'

function UnknownRoute() {
  const { user } = useAuth()
  return user && !user.passwordChanged ? <Navigate to="/primeiro-acesso" replace /> : <NotFoundPage />
}

function AccountRedirect() {
  const { user } = useAuth()
  return <Navigate to={user?.role === 'ADMIN' ? '/admin/conta' : '/client/conta'} replace />
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
          <Route path="/account" element={<AccountRedirect />} />
          <Route path="/access-denied" element={<AccessDeniedPage />} />
          <Route element={<RequireRole role="CLIENT" />}>
            <Route path="/client" element={<ClientLayout />}>
              <Route index element={<ClientDashboardPage />} />
              <Route path="manifestacoes" element={<ClientReportsPage />} />
              <Route path="manifestacoes/nova" element={<CreateReportPage />} />
              <Route path="manifestacoes/:protocol" element={<ClientReportDetailPage />} />
              <Route path="conta" element={<AccountPage />} />
            </Route>
          </Route>
          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="manifestacoes" element={<AdminReportsPage />} />
              <Route path="manifestacoes/:protocol" element={<AdminReportDetailPage />} />
              <Route path="clientes" element={<AdminUsersPage />} />
              <Route path="clientes/novo" element={<CreateClientPage />} />
              <Route path="categorias" element={<SectionPage title="Categorias" />} />
              <Route path="conta" element={<AccountPage />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<UnknownRoute />} />
    </Routes>
  )
}
