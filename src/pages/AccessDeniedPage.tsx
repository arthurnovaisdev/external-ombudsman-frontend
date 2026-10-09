import { Link } from 'react-router-dom'
import { destinationFor, useAuth } from '../features/auth/AuthProvider'
import { Card } from '../shared/components'
import styles from './ProtectedPages.module.css'

export function AccessDeniedPage() {
  const { user } = useAuth()
  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <span className={styles.eyebrow}>Acesso restrito</span>
        <h1>Acesso negado</h1>
        <p>Este perfil não pode abrir esta área.</p>
        <p className={styles.note}>O bloqueio da navegação não substitui a autorização do servidor.</p>
        <Link to={user ? destinationFor(user) : '/login'}>Ir para minha área</Link>
      </Card>
    </main>
  )
}
