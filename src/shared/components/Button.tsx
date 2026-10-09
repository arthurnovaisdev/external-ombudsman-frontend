import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'destructive'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  busy?: boolean
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', busy = false, disabled, className, children, type = 'button', ...props }, ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={[styles.button, styles[variant], className].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  )
})
