import type { CSSProperties } from 'react'
import styles from './Feedback.module.css'

export function Skeleton({ width = '100%', height = '1rem', label = 'Carregando conteúdo' }: {
  width?: CSSProperties['width']; height?: CSSProperties['height']; label?: string
}) {
  return (
    <span role="status" aria-label={label} className={styles.skeleton} style={{ width, height }}>
      <span className="sr-only">{label}</span>
    </span>
  )
}
