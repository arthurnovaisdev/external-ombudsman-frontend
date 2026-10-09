import styles from './FoundationPage.module.css'

export function FoundationPage() {
  return (
    <main className={styles.page}>
      <div className={styles.brand} aria-label="MB.FREIRE">
        <span className={styles.brandMark} aria-hidden="true">MB</span>
        <span>MB.FREIRE</span>
      </div>
      <section className={styles.content} aria-labelledby="page-title">
        <span className={styles.eyebrow}>Fundação do frontend</span>
        <h1 id="page-title">Ouvidoria MBFREIRE</h1>
        <p>
          A estrutura inicial da aplicação está pronta para receber os fluxos
          de acesso e as áreas de cliente e administração.
        </p>
      </section>
      <footer className={styles.footer}>Canal de relacionamento com clientes</footer>
    </main>
  )
}
