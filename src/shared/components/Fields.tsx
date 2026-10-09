import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ValidationMessage } from './ValidationMessage'
import styles from './Fields.module.css'

interface FieldBase {
  id: string
  label: string
  hint?: string
  error?: string
}

function descriptionIds(id: string, hint?: string, error?: string, extra?: string): string | undefined {
  return [extra, hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
}

function FieldShell({ id, label, hint, error, required, children }: FieldBase & { required?: boolean; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}{required && <span className={styles.required} aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && <p id={`${id}-hint`} className={styles.hint}>{hint}</p>}
      {error && <ValidationMessage id={`${id}-error`}>{error}</ValidationMessage>}
    </div>
  )
}

type InputProps = FieldBase & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'>

function makeInput(type: 'text' | 'password' | 'date') {
  return forwardRef<HTMLInputElement, InputProps>(function InputField(
    { id, label, hint, error, required, className, 'aria-describedby': describedBy, ...props }, ref,
  ) {
    return (
      <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
        <input
          {...props}
          id={id}
          ref={ref}
          type={type}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={descriptionIds(id, hint, error, describedBy)}
          className={[styles.control, className].filter(Boolean).join(' ')}
        />
      </FieldShell>
    )
  })
}

export const TextField = makeInput('text')
export const PasswordField = makeInput('password')
export const DateField = makeInput('date')

export type TextAreaFieldProps = FieldBase & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { id, label, hint, error, required, className, 'aria-describedby': describedBy, ...props }, ref,
) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <textarea
        {...props}
        id={id}
        ref={ref}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={descriptionIds(id, hint, error, describedBy)}
        className={[styles.control, styles.textarea, className].filter(Boolean).join(' ')}
      />
    </FieldShell>
  )
})

export interface SelectOption { value: string; label: string; disabled?: boolean }
export type SelectFieldProps = FieldBase & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'> & { options: readonly SelectOption[]; placeholder?: string }

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { id, label, hint, error, required, className, options, placeholder, 'aria-describedby': describedBy, ...props }, ref,
) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <select
        {...props}
        id={id}
        ref={ref}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={descriptionIds(id, hint, error, describedBy)}
        className={[styles.control, className].filter(Boolean).join(' ')}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
      </select>
    </FieldShell>
  )
})
