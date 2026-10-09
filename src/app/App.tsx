import { AppProviders } from './providers/AppProviders'
import { AppRoutes } from './router/AppRoutes'
import { ErrorBoundary } from '../shared/components/ErrorBoundary'

export function App() {
  return (
    <AppProviders>
      <ErrorBoundary><AppRoutes /></ErrorBoundary>
    </AppProviders>
  )
}
