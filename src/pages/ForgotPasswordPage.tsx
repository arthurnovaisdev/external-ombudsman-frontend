import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { authApi } from '../features/auth/api'
import { validateUsername } from '../features/auth/validation'
import { ApiError } from '../shared/api/errors'
import { Alert, BrandLogo, Button, Card, TextField } from '../shared/components'
import styles from './SessionPages.module.css'

interface FormValues { username: string }

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>()

  async function submit({ username }: FormValues) {
    setError(null)
    try {
      await authApi.forgotPassword({ username })
      setSubmitted(true)
    } catch (cause) {
      if (cause instanceof ApiError && cause.kind === 'rate-limited') {
        const wait = cause.retryAfterSeconds
        setError(wait === null ? 'Muitas tentativas. Aguarde antes de tentar novamente.' : `Muitas tentativas. Tente novamente em ${wait} segundos.`)
      } else {
        setError('Não foi possível processar a solicitação. Tente novamente mais tarde.')
      }
    }
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <div className={styles.brand}><BrandLogo className={styles.mark} /> MB.FREIRE</div>
        <h1>Esqueci minha senha</h1>
        <p className={styles.intro}>Informe seu username para solicitar a recuperação de acesso.</p>
        {submitted ? <Alert tone="success">Se a conta estiver apta, você receberá as instruções de recuperação no e-mail cadastrado.</Alert> : (
          <>
            {error && <Alert tone="error">{error}</Alert>}
            <form onSubmit={handleSubmit(submit)} noValidate className={styles.form}>
              <TextField id="username" label="Username" autoComplete="username" required error={errors.username?.message} {...register('username', { validate: validateUsername })} />
              <Button type="submit" busy={isSubmitting}>Solicitar recuperação</Button>
            </form>
          </>
        )}
        <Link className={styles.link} to="/login">Voltar ao login</Link>
      </Card>
    </main>
  )
}
