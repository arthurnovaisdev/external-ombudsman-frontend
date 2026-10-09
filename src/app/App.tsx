import { AppProviders } from './providers/AppProviders'
import { AppRoutes } from './router/AppRoutes'
import { ErrorBoundary } from '../shared/components/ErrorBoundary'

export function App({ initialResetToken }: { initialResetToken?: string | null }) {
  return (
    <AppProviders>
      <ErrorBoundary><AppRoutes initialResetToken={initialResetToken} /></ErrorBoundary>
    </AppProviders>
  )
}
