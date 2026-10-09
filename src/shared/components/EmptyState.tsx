import type { ReactNode } from 'react'
import styles from './Feedback.module.css'

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className={styles.state}>
      <span className={styles.stateIcon} aria-hidden="true">—</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  )
}
