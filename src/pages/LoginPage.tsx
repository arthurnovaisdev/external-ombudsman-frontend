import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { destinationFor, useAuth } from '../features/auth/AuthProvider'
import { validateLoginPassword, validateUsername } from '../features/auth/validation'
import { ApiError } from '../shared/api/errors'
import { Alert, Button, Card, PasswordField, Skeleton, TextField } from '../shared/components'
import styles from './SessionPages.module.css'

interface Credentials { username: string; password: string }

export function LoginPage() {
  const { login, profileLoading, passwordChangedNotice } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
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
        {passwordChangedNotice && <Alert tone="success">Senha alterada. Entre novamente.</Alert>}
        {location.state?.passwordReset === true && <Alert tone="success">Senha redefinida. Entre novamente.</Alert>}
        {serverError && <Alert tone="error">{serverError}</Alert>}
        {profileLoading && <div className={styles.profileLoading}><Skeleton width="1.25rem" height="1.25rem" label="Carregando perfil" /><span>Carregando seu perfil…</span></div>}
        <form onSubmit={handleSubmit(submit)} noValidate className={styles.form}>
          <TextField id="username" label="Username" autoComplete="username" required error={errors.username?.message} {...register('username', { validate: validateUsername })} />
          <PasswordField id="password" label="Senha" autoComplete="current-password" required error={errors.password?.message} {...register('password', { validate: validateLoginPassword })} />
          <Button type="submit" busy={isSubmitting}>Entrar</Button>
        </form>
        <Link className={styles.link} to="/esqueci-senha">Esqueci minha senha</Link>
        <p className={styles.note}>A sessão permanece apenas nesta aba e termina ao recarregar a página. A autorização dos dados é feita pelo servidor.</p>
      </Card>
    </main>
  )
}
