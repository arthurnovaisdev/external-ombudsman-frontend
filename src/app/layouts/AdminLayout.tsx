import { AppShell, type NavigationItem } from './AppShell'

const adminItems: readonly NavigationItem[] = [
  { label: 'Dashboard', to: '/admin', end: true },
  { label: 'Manifestações', to: '/admin/manifestacoes' },
  { label: 'Clientes', to: '/admin/clientes' },
  { label: 'Categorias', to: '/admin/categorias' },
  { label: 'Minha conta', to: '/admin/conta' },
]

export function AdminLayout() {
  return <AppShell role="ADMIN" home="/admin" items={adminItems} />
}
