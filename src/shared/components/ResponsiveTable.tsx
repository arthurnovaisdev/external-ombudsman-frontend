import type { ReactNode } from 'react'
import styles from './DataDisplay.module.css'

export function ResponsiveTable({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className={styles.tableScroll} role="region" aria-label={`Tabela: ${caption}`} tabIndex={0}>
      <table className={styles.table}>
        <caption>{caption}</caption>
        {children}
      </table>
    </div>
  )
}
