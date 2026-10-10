import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { categoriesApi } from '../categories/api'
import type { ReportRequestDTO } from '../../shared/api/contracts'
import { ApiError } from '../../shared/api/errors'
import { Alert, Button, Card, DateField, ErrorState, Protocol, SelectField, Skeleton, TextAreaField, TextField } from '../../shared/components'
import { clientReportsApi } from './api'
import styles from './CreateReportPage.module.css'

const categoryPageSize = 50
const categorySchema = z.string().min(1, 'Selecione uma categoria.')
const descriptionSchema = z.string().trim().min(1, 'Descreva a manifestação.').max(5000, 'Use no máximo 5.000 caracteres.')
const locationSchema = z.string().max(255, 'Use no máximo 255 caracteres.')

function todayLocal(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function validateDate(value: string): true | string {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Informe uma data válida.'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime()) || `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` !== value) {
    return 'Informe uma data válida.'
  }
  return value <= todayLocal() ? true : 'A data do ocorrido não pode estar no futuro.'
}

function validate<T>(schema: z.ZodType<T>, value: string): true | string {
  const result = schema.safeParse(value)
  return result.success ? true : result.error.issues[0]?.message ?? 'Valor inválido.'
}

interface FormValues {
  categoryId: string
  description: string
  incidentDate: string
  incidentLocation: string
}

export function CreateReportPage() {
  const queryClient = useQueryClient()
  const submitting = useRef(false)
  const [isSending, setIsSending] = useState(false)
  const [protocol, setProtocol] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { register, handleSubmit, setError, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: { categoryId: '', description: '', incidentDate: '', incidentLocation: '' },
  })
  const categories = useInfiniteQuery({
    queryKey: ['categories', 'report-form'],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => categoriesApi.list({ page: pageParam, size: categoryPageSize }, { signal }),
    getNextPageParam: (lastPage) => lastPage.number + 1 < lastPage.totalPages ? lastPage.number + 1 : undefined,
    retry: false,
  })
  const activeCategories = categories.data?.pages.flatMap((page) => page.content.filter((category) => category.active)) ?? []
  const categoryOptions = Array.from(new Map(activeCategories.map((category) => [category.id, { value: category.id, label: category.name }])).values())

  async function submit(values: FormValues) {
    if (submitting.current) return
    submitting.current = true
    setIsSending(true)
    setSubmitError(null)
    const body: ReportRequestDTO = {
      categoryId: values.categoryId,
      description: values.description.trim(),
      incidentDate: values.incidentDate || null,
      incidentLocation: values.incidentLocation.trim() || null,
    }
    try {
      const response = await clientReportsApi.create(body)
      if (typeof response?.protocol !== 'string' || response.protocol.length === 0) {
        throw new ApiError('invalid-response', 201, 'Não foi possível confirmar o registro. Tente novamente.')
      }
      void queryClient.invalidateQueries({ queryKey: ['client-reports'] })
      setProtocol(response.protocol)
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details) {
          for (const field of ['categoryId', 'description', 'incidentDate', 'incidentLocation'] as const) {
            if (error.details[field]) setError(field, { type: 'server', message: error.details[field] })
          }
        }
        if (error.kind === 'not-found' || (error.kind === 'bad-request' && /categoria/i.test(error.message))) {
          setValue('categoryId', '')
          setError('categoryId', { type: 'server', message: 'A categoria selecionada foi removida ou está inativa. Escolha outra categoria.' })
          void queryClient.invalidateQueries({ queryKey: ['categories', 'report-form'] })
        } else if (error.kind === 'rate-limited') {
          const wait = error.retryAfterSeconds === null ? '' : ` Aguarde ${error.retryAfterSeconds} segundos antes de tentar novamente.`
          setSubmitError(`Muitas tentativas.${wait}`)
        } else {
          setSubmitError(error.details ? 'Revise os campos indicados e tente novamente.' : error.message)
        }
      } else {
        setSubmitError('Não foi possível registrar a manifestação. Tente novamente.')
      }
    } finally {
      submitting.current = false
      setIsSending(false)
    }
  }

  if (protocol) {
    return (
      <div className={styles.page}>
        <Card className={styles.confirmation}>
          <span className={styles.eyebrow}>Registro concluído</span>
          <h1>Manifestação registrada</h1>
          <p>Guarde o protocolo para identificar esta manifestação.</p>
          <Protocol value={protocol} />
          <div className={styles.actions}>
            <Link className={styles.primaryLink} to={`/client/manifestacoes/${encodeURIComponent(protocol)}`}>Visualizar manifestação</Link>
            <Link className={styles.secondaryLink} to="/client/manifestacoes">Voltar para Minhas manifestações</Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Área do cliente</span>
          <h1>Nova manifestação</h1>
          <p>Conte o que aconteceu. Seus dados de acesso vinculam este registro à sua conta.</p>
        </div>
        <Link className={styles.secondaryLink} to="/client/manifestacoes">Minhas manifestações</Link>
      </div>
      <Card className={styles.formCard}>
        {categories.isPending ? <Skeleton height="4rem" label="Carregando categorias" /> : categories.isError && !categories.data ? (
          <ErrorState title="Não foi possível carregar as categorias" description="Tente novamente para selecionar uma categoria." onRetry={() => void categories.refetch()} />
        ) : (
          <>
            {categoryOptions.length === 0 && !categories.hasNextPage && <Alert tone="warning">Não há categorias ativas disponíveis para registrar uma manifestação.</Alert>}
            <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
              <SelectField
                id="categoryId" label="Categoria" placeholder="Selecione uma categoria" required
                options={categoryOptions} error={errors.categoryId?.message}
                {...register('categoryId', { validate: (value) => validate(categorySchema, value) })}
              />
              {categories.hasNextPage && (
                <Button variant="secondary" onClick={() => void categories.fetchNextPage()} busy={categories.isFetchingNextPage}>
                  Carregar mais categorias
                </Button>
              )}
              {categories.isFetchNextPageError && <Alert tone="error">Não foi possível carregar mais categorias. Tente novamente.</Alert>}
              <TextAreaField
                id="description" label="Descrição" required maxLength={5000} rows={8}
                hint="Até 5.000 caracteres." error={errors.description?.message}
                {...register('description', { validate: (value) => validate(descriptionSchema, value) })}
              />
              <div className={styles.optionalFields}>
                <DateField
                  id="incidentDate" label="Data do ocorrido" max={todayLocal()} hint="Opcional. Não pode ser futura."
                  error={errors.incidentDate?.message} {...register('incidentDate', { validate: validateDate })}
                />
                <TextField
                  id="incidentLocation" label="Local do ocorrido" maxLength={255} hint="Opcional. Até 255 caracteres."
                  error={errors.incidentLocation?.message}
                  {...register('incidentLocation', { validate: (value) => validate(locationSchema, value) })}
                />
              </div>
              {import.meta.env.VITE_ATTACHMENTS_ENABLED === 'true' && <div className={styles.attachments} aria-label="Anexos">
                <h2>Anexos</h2>
                <p>O envio de anexos é separado do registro da manifestação.</p>
              </div>}
              {submitError && <Alert tone="error">{submitError}</Alert>}
              <div className={styles.actions}>
                <Button type="submit" busy={isSubmitting || isSending} disabled={categoryOptions.length === 0}>Registrar manifestação</Button>
                <Link className={styles.secondaryLink} to="/client/manifestacoes">Cancelar</Link>
              </div>
            </form>
          </>
        )}
      </Card>
    </div>
  )
}
