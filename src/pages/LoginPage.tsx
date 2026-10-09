import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { destinationFor, useAuth } from '../features/auth/AuthProvider'
import { ApiError } from '../shared/api/errors'
import { Alert, Button, Card, PasswordField, TextField } from '../shared/components'
import styles from './SessionPages.module.css'

interface Credentials { username: string; password: string }

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Credentials>()

  async function submit(values: Credentials) {
    setServerError(null)
    try {
      const user = await login(values)
      navigate(destinationFor(user), { replace: true })
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Não foi possível entrar. Tente novamente.')
    }
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <div className={styles.brand}><span className={styles.mark} aria-hidden="true">mb</span> MB.FREIRE</div>
        <h1>Entrar na Ouvidoria</h1>
        <p className={styles.intro}>Acesso exclusivo para clientes cadastrados e equipe autorizada.</p>
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <form onSubmit={handleSubmit(submit)} noValidate className={styles.form}>
          <TextField id="username" label="Username" autoComplete="username" required error={errors.username?.message} {...register('username', { required: 'Informe o username.' })} />
          <PasswordField id="password" label="Senha" autoComplete="current-password" required error={errors.password?.message} {...register('password', { required: 'Informe a senha.' })} />
          <Button type="submit" busy={isSubmitting}>Entrar</Button>
        </form>
        <p className={styles.note}>A sessão permanece apenas nesta aba e termina ao recarregar a página. A autorização dos dados é feita pelo servidor.</p>
      </Card>
    </main>
  )
}
