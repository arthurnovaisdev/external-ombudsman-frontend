import { useAuth, type AppRole } from '../features/auth/AuthProvider'
import { Card } from '../shared/components'
import styles from './ProtectedPages.module.css'

export function RoleHomePage({ role }: { role: AppRole }) {
  const { user } = useAuth()
  const title = role === 'CLIENT' ? 'Área do cliente' : 'Área administrativa'

  return (
    <section className={styles.page}>
      <Card className={styles.card}>
        <span className={styles.eyebrow}>Ouvidoria MBFREIRE</span>
        <h1>{title}</h1>
        <p>Olá, <span className={styles.longText}>{user?.name}</span>.</p>
      </Card>
    </section>
  )
}
