import { AppShell, type NavigationItem } from './AppShell'

const clientItems: readonly NavigationItem[] = [
  { label: 'Início', to: '/client', end: true },
  { label: 'Manifestações', to: '/client/manifestacoes' },
  { label: 'Minha conta', to: '/client/conta' },
]

export function ClientLayout() {
  return <AppShell role="CLIENT" home="/client" items={clientItems} />
}
