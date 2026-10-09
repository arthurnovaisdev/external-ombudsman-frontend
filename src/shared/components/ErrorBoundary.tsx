import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './ErrorState'
import styles from './ErrorBoundary.module.css'

interface Props { children: ReactNode; onError?: (error: Error, info: ErrorInfo) => void }
interface State { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State { return { failed: true } }

  componentDidCatch(error: Error, info: ErrorInfo): void { this.props.onError?.(error, info) }

  render() {
    if (this.state.failed) {
      return (
        <main className={styles.root}>
          <ErrorState
            title="Algo deu errado"
            description="Não foi possível mostrar esta página. Tente novamente."
            onRetry={() => this.setState({ failed: false })}
          />
        </main>
      )
    }
    return this.props.children
  }
}
