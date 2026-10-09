import { memoryToken } from './memoryToken'

let listener: (() => void) | null = null

export function subscribeUnauthorized(callback: () => void): () => void {
  listener = callback
  return () => { if (listener === callback) listener = null }
}

// O cliente HTTP não depende do React; sem Provider montado, ainda descarta o token.
export function notifyUnauthorized(): void {
  memoryToken.clear()
  listener?.()
}
