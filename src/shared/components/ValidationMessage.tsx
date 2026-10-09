import styles from './Fields.module.css'

export function ValidationMessage({ id, children }: { id: string; children: string }) {
  return <p id={id} role="alert" className={styles.error}>{children}</p>
}
