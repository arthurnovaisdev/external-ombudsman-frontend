import styles from './DataDisplay.module.css'

export function StatusBadge({ closedAt }: { closedAt: string | null }) {
  const closed = closedAt !== null
  return <span className={[styles.badge, closed ? styles.closed : styles.open].join(' ')}>{closed ? 'Encerrada' : 'Em andamento'}</span>
}
