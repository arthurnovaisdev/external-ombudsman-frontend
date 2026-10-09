import { Card } from '../shared/components'
import styles from './ProtectedPages.module.css'

export function SectionPage({ title }: { title: string }) {
  return (
    <section className={styles.page}>
      <Card className={styles.card}>
        <span className={styles.eyebrow}>Ouvidoria MBFREIRE</span>
        <h1>{title}</h1>
        <p>Esta seção ainda não possui uma tela funcional nesta etapa.</p>
        <p className={styles.note}>A navegação não substitui a autorização do servidor.</p>
      </Card>
    </section>
  )
}
