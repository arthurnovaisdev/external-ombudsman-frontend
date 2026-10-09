import { Button } from './Button'
import styles from './Feedback.module.css'

export function ErrorState({ title = 'Não foi possível carregar', description, onRetry }: {
  title?: string; description: string; onRetry: () => void
}) {
  return (
    <div role="alert" className={styles.state}>
      <span className={[styles.stateIcon, styles.errorIcon].join(' ')} aria-hidden="true">!</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <Button variant="secondary" onClick={onRetry}>Tentar novamente</Button>
    </div>
  )
}
