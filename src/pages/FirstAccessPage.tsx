import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { ApiError } from '../shared/api/errors'
import { Alert, Button, Card, PasswordField } from '../shared/components'
import styles from './SessionPages.module.css'

interface PasswordForm { currentPassword: string; newPassword: string; confirmPassword: string }

export function FirstAccessPage() {
  const { changePassword, logout } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<PasswordForm>()

  async function submit(values: PasswordForm) {
    setServerError(null)
    if (values.newPassword !== values.confirmPassword) {
      setError('confirmPassword', { message: 'As senhas não coincidem.' })
      return
    }
    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword })
      navigate('/login', { replace: true })
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Não foi possível alterar a senha. Tente novamente.')
    }
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <div className={styles.brand}><span className={styles.mark} aria-hidden="true">mb</span> MB.FREIRE</div>
        <h1>Alterar senha provisória</h1>
        <Alert tone="warning">Antes de utilizar o sistema, substitua sua senha provisória.</Alert>
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <form onSubmit={handleSubmit(submit)} noValidate className={styles.form}>
          <PasswordField id="current-password" label="Senha atual" autoComplete="current-password" required error={errors.currentPassword?.message} {...register('currentPassword', { required: 'Informe a senha atual.' })} />
          <PasswordField id="new-password" label="Nova senha" autoComplete="new-password" required error={errors.newPassword?.message} {...register('newPassword', { required: 'Informe a nova senha.', minLength: { value: 6, message: 'Use pelo menos 6 caracteres.' }, maxLength: { value: 100, message: 'Use no máximo 100 caracteres.' } })} />
          <PasswordField id="confirm-password" label="Confirmar nova senha" autoComplete="new-password" required error={errors.confirmPassword?.message} {...register('confirmPassword', { required: 'Confirme a nova senha.' })} />
          <Button type="submit" busy={isSubmitting}>Alterar senha</Button>
        </form>
        <Button variant="secondary" onClick={() => { logout(); navigate('/login', { replace: true }) }}>Sair</Button>
        <p className={styles.note}>Após a alteração, o token atual é invalidado e será necessário entrar novamente.</p>
      </Card>
    </main>
  )
}
