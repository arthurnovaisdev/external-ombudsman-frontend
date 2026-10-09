import { Link } from 'react-router-dom'
import styles from './NotFoundPage.module.css'

export function NotFoundPage() {
  return (
    <main className={styles.page}>
      <p className={styles.code}>404</p>
      <h1>Página não encontrada</h1>
      <p>Confira o endereço e tente novamente.</p>
      <Link to="/">Voltar ao início</Link>
    </main>
  )
}
