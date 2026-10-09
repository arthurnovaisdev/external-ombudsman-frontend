import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AlertTone } from './Alert'
import styles from './Toast.module.css'

interface ToastItem { id: number; message: string; tone: AlertTone }
interface ToastApi { notify: (message: string, tone?: AlertTone) => void }

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const notify = useCallback((message: string, tone: AlertTone = 'info') => {
    const id = ++nextId.current
    setToasts((current) => [...current, { id, message, tone }])
    timers.current.set(id, setTimeout(() => dismiss(id), 6_000))
  }, [dismiss])

  useEffect(() => {
    const pending = timers.current
    return () => { pending.forEach(clearTimeout); pending.clear() }
  }, [])

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className={styles.stack} aria-label="Notificações">
        {toasts.map((toast) => (
          <div key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'} className={[styles.toast, styles[toast.tone]].join(' ')}>
            <span>{toast.message}</span>
            <button type="button" aria-label={`Dispensar notificação: ${toast.message}`} onClick={() => dismiss(toast.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider.')
  return context
}
