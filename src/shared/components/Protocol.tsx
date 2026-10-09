import styles from './DataDisplay.module.css'

export function Protocol({ value }: { value: string }) {
  return (
    <span className={styles.protocol}>
      <span>Protocolo</span>
      <code>{value}</code>
    </span>
  )
}
