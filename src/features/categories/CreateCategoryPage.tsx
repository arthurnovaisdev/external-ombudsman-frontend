import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '../../shared/api/errors'
import { Alert, Button, Card, TextField } from '../../shared/components'
import { categoriesApi } from './api'
import styles from './AdminCategories.module.css'

const nameSchema = z.string().trim().min(1, 'Informe o nome da categoria.').max(100, 'Use no máximo 100 caracteres.')

interface FormValues { name: string }

function validateName(value: string): true | string {
  const result = nameSchema.safeParse(value)
  return result.success || result.error.issues[0]?.message || 'Nome inválido.'
}

export function CreateCategoryPage() {
  const queryClient = useQueryClient()
  const submitting = useRef(false)
  const [created, setCreated] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({ defaultValues: { name: '' } })

  async function submit(values: FormValues) {
    if (submitting.current) return
    submitting.current = true
    setSubmitError(null)
    try {
      await categoriesApi.create({ name: values.name.trim(), active: true })
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      reset()
      setCreated(true)
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details?.name) setError('name', { type: 'server', message: error.details.name })
        else if (error.kind === 'conflict' || /já existe uma categoria/i.test(error.message)) {
          setError('name', { type: 'server', message: error.message })
        } else if (error.kind === 'rate-limited') {
          const wait = error.retryAfterSeconds === null ? '' : ` Aguarde ${error.retryAfterSeconds} segundos.`
          setSubmitError(`Muitas tentativas.${wait}`)
        } else setSubmitError(error.details ? 'Revise o campo indicado e tente novamente.' : error.message)
      } else setSubmitError('Não foi possível cadastrar a categoria. Tente novamente.')
    } finally {
      submitting.current = false
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>Área administrativa</span><h1>Nova categoria</h1></div>
        <Link className={styles.secondaryLink} to="/admin/categorias">Voltar às categorias</Link>
      </div>

      {created ? <Card className={styles.formCard}>
        <h2>Categoria cadastrada</h2>
        <Alert tone="success">A categoria ativa foi criada e está disponível para novas manifestações.</Alert>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setCreated(false)}>Cadastrar outra categoria</Button>
          <Link className={styles.primaryLink} to="/admin/categorias">Ver categorias</Link>
        </div>
      </Card> : <Card className={styles.formCard}>
        <h2>Dados da categoria</h2>
        <p className={styles.lead}>A categoria será criada com a situação inicial <span className={styles.activeBadge}>Ativa</span>.</p>
        {submitError && <Alert tone="error">{submitError}</Alert>}
        <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
          <TextField id="category-name" label="Nome" required maxLength={100} hint="Até 100 caracteres." error={errors.name?.message} {...register('name', { validate: validateName })} />
          <Button type="submit" busy={isSubmitting}>Cadastrar categoria</Button>
        </form>
      </Card>}
    </div>
  )
}
