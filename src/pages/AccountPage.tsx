import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { Button, Card } from '../shared/components'
import styles from './ProtectedPages.module.css'

export function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <span className={styles.eyebrow}>Ouvidoria MBFREIRE</span>
        <h1>Minha conta</h1>
        <dl className={styles.details}>
          <div><dt>Nome</dt><dd>{user?.name}</dd></div>
          <div><dt>Username</dt><dd>{user?.username}</dd></div>
          <div><dt>Perfil</dt><dd>{user?.role}</dd></div>
          <div><dt>E-mail de contato</dt><dd>{user?.contactEmail ?? 'Não informado'}</dd></div>
        </dl>
        <p className={styles.note}>Dados recebidos de `/api/users/me`. A autorização dos recursos permanece no servidor.</p>
        <Button variant="secondary" onClick={() => { logout(); navigate('/login', { replace: true }) }}>Sair</Button>
      </Card>
    </main>
  )
}
