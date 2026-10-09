import { Button } from './Button'
import styles from './DataDisplay.module.css'

export interface PaginationProps {
  page: number // índice zero, como nos controllers Spring
  hasNext: boolean
  onPageChange: (page: number) => void
  totalPages?: number
  disabled?: boolean
}

export function Pagination({ page, hasNext, onPageChange, totalPages, disabled = false }: PaginationProps) {
  return (
    <nav aria-label="Paginação" className={styles.pagination}>
      <Button variant="secondary" disabled={disabled || page <= 0} onClick={() => onPageChange(page - 1)}>Anterior</Button>
      <span aria-live="polite" aria-atomic="true">Página {page + 1}{totalPages !== undefined && totalPages > 0 ? ` de ${totalPages}` : ''}</span>
      <Button variant="secondary" disabled={disabled || !hasNext} onClick={() => onPageChange(page + 1)}>Próxima</Button>
    </nav>
  )
}
