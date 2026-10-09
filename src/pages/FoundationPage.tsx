import styles from './FoundationPage.module.css'
import { Link } from 'react-router-dom'

export function FoundationPage() {
  return (
    <main className={styles.page}>
      <div className={styles.brand} aria-label="MB.FREIRE">
        <span className={styles.brandMark} aria-hidden="true">MB</span>
        <span>MB.FREIRE</span>
      </div>
      <section className={styles.content} aria-labelledby="page-title">
        <span className={styles.eyebrow}>Acesso autenticado</span>
        <h1 id="page-title">Ouvidoria MBFREIRE</h1>
        <p>
          Canal seguro de relacionamento para clientes cadastrados e equipe autorizada.
        </p>
        <Link className={styles.entry} to="/login">Entrar na Ouvidoria</Link>
      </section>
      <footer className={styles.footer}>Canal de relacionamento com clientes</footer>
    </main>
  )
}
