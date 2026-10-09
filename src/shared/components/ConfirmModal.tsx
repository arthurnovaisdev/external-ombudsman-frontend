import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import type { ButtonVariant } from './Button'
import styles from './ConfirmModal.module.css'

export interface ConfirmModalProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  variant?: Extract<ButtonVariant, 'primary' | 'destructive'>
  pending?: boolean
}

const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function ConfirmModal({ open, title, description, confirmLabel, onConfirm, onCancel, variant = 'destructive', pending = false }: ConfirmModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [open])

  if (!open) return null

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !pending) {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusable) ?? [])
    if (elements.length === 0) return
    const first = elements[0]
    const last = elements[elements.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onCancel() }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={styles.dialog}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className={styles.actions}>
          <Button ref={cancelRef} variant="secondary" disabled={pending} onClick={onCancel}>Cancelar</Button>
          <Button variant={variant} busy={pending} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>, document.body,
  )
}
