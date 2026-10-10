import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../features/auth/api'
import { validateNewPassword } from '../features/auth/validation'
import { ApiError } from '../shared/api/errors'
import { Alert, BrandLogo, Button, Card, PasswordField } from '../shared/components'
import styles from './SessionPages.module.css'

interface FormValues { newPassword: string; confirmPassword: string }
const tokenPattern = /^[A-Za-z0-9_-]{43}$/

export function ResetPasswordPage({ token: initialToken }: { token: string | null }) {
  const navigate = useNavigate()
  const [token, setToken] = useState(initialToken && tokenPattern.test(initialToken) ? initialToken : null)
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormValues>()

  async function submit(values: FormValues) {
    if (!token) return
    setServerError(null)
    if (values.newPassword !== values.confirmPassword) {
      setError('confirmPassword', { message: 'As senhas não coincidem.' })
      return
    }
    try {
      await authApi.resetPassword({ token, newPassword: values.newPassword })
      setToken(null)
      navigate('/login', { replace: true, state: { passwordReset: true } })
    } catch (cause) {
      if (cause instanceof ApiError && cause.kind === 'rate-limited') {
        setServerError('Muitas tentativas. Aguarde antes de tentar novamente.')
      } else if (cause instanceof ApiError && (cause.status === 400 || cause.status === 409)) {
        setServerError('Link inválido ou expirado. Solicite uma nova recuperação.')
      } else {
        setServerError('Não foi possível redefinir a senha. Tente novamente.')
      }
    }
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <div className={styles.brand}><BrandLogo className={styles.mark} /> MB.FREIRE</div>
        <h1>Redefinir senha</h1>
        {!token ? <Alert tone="error">Link inválido ou ausente. Solicite uma nova recuperação.</Alert> : (
          <>
            <p className={styles.intro}>Escolha uma nova senha para sua conta.</p>
            {serverError && <Alert tone="error">{serverError}</Alert>}
            <form onSubmit={handleSubmit(submit)} noValidate className={styles.form}>
              <PasswordField id="new-password" label="Nova senha" autoComplete="new-password" required error={errors.newPassword?.message} {...register('newPassword', { validate: validateNewPassword })} />
              <PasswordField id="confirm-password" label="Confirmar nova senha" autoComplete="new-password" required error={errors.confirmPassword?.message} {...register('confirmPassword', { required: 'Confirme a nova senha.' })} />
              <Button type="submit" busy={isSubmitting}>Redefinir senha</Button>
            </form>
          </>
        )}
        <Link className={styles.link} to="/esqueci-senha">Solicitar novo link</Link>
        <Link className={styles.link} to="/login">Voltar ao login</Link>
      </Card>
    </main>
  )
}
