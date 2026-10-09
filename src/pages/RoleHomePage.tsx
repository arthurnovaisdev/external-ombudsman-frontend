import { Link, useNavigate } from 'react-router-dom'
import { useAuth, type AppRole } from '../features/auth/AuthProvider'
import { Button, Card } from '../shared/components'
import styles from './ProtectedPages.module.css'

export function RoleHomePage({ role }: { role: AppRole }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const title = role === 'CLIENT' ? 'Área do cliente' : 'Área administrativa'

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <span className={styles.eyebrow}>Ouvidoria MBFREIRE</span>
        <h1>{title}</h1>
        <p>Olá, {user?.name}. Sua sessão está ativa apenas nesta aba.</p>
        <p className={styles.note}>Esta página confirma a navegação protegida. O servidor continua responsável por autorizar cada recurso.</p>
        <div className={styles.actions}>
          <Link to="/account">Minha conta</Link>
          <Button variant="secondary" onClick={() => { logout(); navigate('/login', { replace: true }) }}>Sair</Button>
        </div>
      </Card>
    </main>
  )
}
