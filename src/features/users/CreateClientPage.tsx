import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import type { RegisterRequestDTO } from '../../shared/api/contracts'
import { ApiError } from '../../shared/api/errors'
import { Alert, Button, Card, PasswordField, TextField } from '../../shared/components'
import { validateUsername } from '../auth/validation'
import { usersApi } from './api'
import styles from './AdminUsers.module.css'

const nameSchema = z.string().trim().min(1, 'Informe o nome.').max(150, 'Use no máximo 150 caracteres.')
const emailSchema = z.email('Informe um e-mail válido.').max(150, 'Use no máximo 150 caracteres.')

interface FormValues {
  name: string
  username: string
  contactEmail: string
  password: string
}

function validateName(value: string): true | string {
  const result = nameSchema.safeParse(value)
  return result.success || result.error.issues[0]?.message || 'Nome inválido.'
}

function validateEmail(value: string): true | string {
  const trimmed = value.trim()
  if (!trimmed) return true
  const result = emailSchema.safeParse(trimmed)
  return result.success || result.error.issues[0]?.message || 'E-mail inválido.'
}

function validatePassword(value: string): true | string {
  if (!value?.trim()) return 'Informe a senha provisória.'
  return value.length >= 6 && value.length <= 100 ? true : 'Use entre 6 e 100 caracteres.'
}

export function CreateClientPage() {
  const queryClient = useQueryClient()
  const submitting = useRef(false)
  const [created, setCreated] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: { name: '', username: '', contactEmail: '', password: '' },
  })

  async function submit(values: FormValues) {
    if (submitting.current) return
    submitting.current = true
    setSubmitError(null)
    const body: RegisterRequestDTO = {
      name: values.name.trim(),
      username: values.username.trim(),
      contactEmail: values.contactEmail.trim() || null,
      password: values.password,
    }
    try {
      await usersApi.registerClient(body)
      reset()
      setCreated(true)
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details) {
          for (const field of ['name', 'username', 'contactEmail', 'password'] as const) {
            if (error.details[field]) setError(field, { type: 'server', message: error.details[field] })
          }
        }
        if (error.kind === 'rate-limited') {
          const wait = error.retryAfterSeconds === null ? '' : ` Aguarde ${error.retryAfterSeconds} segundos.`
          setSubmitError(`Muitas tentativas.${wait}`)
        } else setSubmitError(error.details ? 'Revise os campos indicados e tente novamente.' : error.message)
      } else setSubmitError('Não foi possível cadastrar o cliente. Tente novamente.')
    } finally {
      submitting.current = false
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>Área administrativa</span><h1>Cadastrar cliente</h1></div>
        <Link className={styles.secondaryLink} to="/admin/clientes">Voltar aos clientes</Link>
      </div>

      {created ? <Card className={styles.formCard}>
        <h2>Cliente cadastrado</h2>
        <Alert tone="success">O cliente foi cadastrado. A senha provisória deverá ser alterada no primeiro acesso.</Alert>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setCreated(false)}>Cadastrar outro cliente</Button>
          <Link className={styles.primaryLink} to="/admin/clientes">Ver clientes</Link>
        </div>
      </Card> : <Card className={styles.formCard}>
        <h2>Dados do novo cliente</h2>
        <p className={styles.lead}>O perfil será Cliente (CLIENT). O servidor define esse perfil.</p>
        <p className={styles.lead}>O e-mail é opcional, mas recomendado para permitir a recuperação de senha.</p>
        {submitError && <Alert tone="error">{submitError}</Alert>}
        <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
          <TextField id="client-name" label="Nome" required maxLength={150} autoComplete="name" error={errors.name?.message} {...register('name', { validate: validateName })} />
          <TextField id="client-username" label="Username" required minLength={3} maxLength={50} autoComplete="off" hint="3 a 50 caracteres; letras, números, ponto, hífen e underline." error={errors.username?.message} {...register('username', { validate: validateUsername })} />
          <TextField id="client-email" label="E-mail de contato" maxLength={150} autoComplete="email" hint="Opcional, mas recomendado para recuperação de senha." error={errors.contactEmail?.message} {...register('contactEmail', { validate: validateEmail })} />
          <PasswordField id="client-password" label="Senha provisória" required minLength={6} maxLength={100} autoComplete="new-password" hint="Entre 6 e 100 caracteres. O cliente deverá trocá-la no primeiro acesso." error={errors.password?.message} {...register('password', { validate: validatePassword })} />
          <Button type="submit" busy={isSubmitting}>Cadastrar cliente</Button>
        </form>
      </Card>}
    </div>
  )
}
