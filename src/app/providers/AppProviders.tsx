import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ToastProvider } from '../../shared/components/Toast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><ToastProvider>{children}</ToastProvider></BrowserRouter>
    </QueryClientProvider>
  )
}
