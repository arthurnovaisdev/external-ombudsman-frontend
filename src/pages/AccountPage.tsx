import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { accountApi } from '../features/account/api'
import { useAuth } from '../features/auth/AuthProvider'
import { validateCurrentPassword, validateNewPassword } from '../features/auth/validation'
import { ApiError } from '../shared/api/errors'
import { Alert, Button, Card, ErrorState, PasswordField, Skeleton } from '../shared/components'
import styles from './ProtectedPages.module.css'

interface PasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function AccountPage() {
  const { changePassword } = useAuth()
  const navigate = useNavigate()
  const submitting = useRef(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const profile = useQuery({
    queryKey: ['account', 'me'],
    queryFn: ({ signal }) => accountApi.me({ signal }),
    refetchOnMount: 'always',
    retry: false,
  })
  const { register, handleSubmit, getValues, setError, formState: { errors, isSubmitting } } = useForm<PasswordForm>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  async function submit(values: PasswordForm) {
    if (submitting.current) return
    submitting.current = true
    setServerError(null)
    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword })
      navigate('/login', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details?.currentPassword) setError('currentPassword', { type: 'server', message: error.details.currentPassword })
        if (error.details?.newPassword) setError('newPassword', { type: 'server', message: error.details.newPassword })
        setServerError(error.details ? 'Revise os campos indicados e tente novamente.' : error.message)
      } else setServerError('Não foi possível alterar a senha. Tente novamente.')
    } finally {
      submitting.current = false
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.accountContent}>
        <div className={styles.accountHeading}>
          <span className={styles.eyebrow}>Ouvidoria MBFREIRE</span>
          <h1>Minha conta</h1>
        </div>
        {profile.isPending ? <Skeleton height="16rem" label="Carregando minha conta" />
          : profile.isError ? <ErrorState title="Não foi possível carregar sua conta" description="Tente novamente para consultar seus dados." onRetry={() => void profile.refetch()} />
            : <>
              <Card className={styles.card}>
                <h2>Dados da conta</h2>
                <dl className={styles.details}>
                  <div><dt>Nome</dt><dd>{profile.data.name}</dd></div>
                  <div><dt>Username</dt><dd>{profile.data.username}</dd></div>
                  <div><dt>E-mail de contato</dt><dd>{profile.data.contactEmail ?? 'Não informado'}</dd></div>
                  <div><dt>Perfil</dt><dd>{profile.data.role === 'ADMIN' ? 'Administrador' : profile.data.role === 'CLIENT' ? 'Cliente' : profile.data.role}</dd></div>
                  <div><dt>Primeiro acesso</dt><dd>{profile.data.passwordChanged ? 'Senha provisória alterada' : 'Troca de senha pendente'}</dd></div>
                </dl>
              </Card>
              <Card className={styles.card}>
                <h2>Alterar senha</h2>
                {serverError && <Alert tone="error">{serverError}</Alert>}
                <form className={styles.passwordForm} onSubmit={handleSubmit(submit)} noValidate>
                  <PasswordField
                    id="account-current-password" label="Senha atual" autoComplete="current-password" required maxLength={100}
                    error={errors.currentPassword?.message}
                    {...register('currentPassword', { validate: validateCurrentPassword })}
                  />
                  <PasswordField
                    id="account-new-password" label="Nova senha" autoComplete="new-password" required minLength={6} maxLength={100}
                    hint="Entre 6 e 100 caracteres." error={errors.newPassword?.message}
                    {...register('newPassword', { validate: validateNewPassword })}
                  />
                  <PasswordField
                    id="account-confirm-password" label="Confirmar nova senha" autoComplete="new-password" required maxLength={100}
                    error={errors.confirmPassword?.message}
                    {...register('confirmPassword', { validate: (value) => {
                      if (!value) return 'Confirme a nova senha.'
                      if (value.length > 100) return 'Use no máximo 100 caracteres.'
                      return value === getValues('newPassword') || 'As senhas não coincidem.'
                    } })}
                  />
                  <Button type="submit" busy={isSubmitting}>Alterar senha</Button>
                </form>
              </Card>
            </>}
      </div>
    </section>
  )
}
