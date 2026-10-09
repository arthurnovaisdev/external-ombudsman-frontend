import type { ReactNode } from 'react'
import styles from './Feedback.module.css'

export type AlertTone = 'info' | 'success' | 'warning' | 'error'

export function Alert({ title, tone = 'info', children }: { title?: string; tone?: AlertTone; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={[styles.alert, styles[tone]].join(' ')}>
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </div>
  )
}
