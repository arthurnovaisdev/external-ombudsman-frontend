import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { Alert, Button, Card, EmptyState, ErrorState, Pagination, Protocol, Skeleton, StatusBadge, TextAreaField } from '../../shared/components'
import { ApiError } from '../../shared/api/errors'
import { reportMessagesApi } from '../report-messages/api'
import { clientReportsApi } from './api'
import { formatReportDate } from './presentation'
import styles from './ClientReports.module.css'

const messagesPageSize = 20
const messageSchema = z.string().trim().min(1, 'Escreva uma mensagem.').max(10_000, 'Use no máximo 10.000 caracteres.')

function pageFromSearch(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 0
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : 0
}

function messageAuthor(role: string): string {
  return role === 'CLIENT' ? 'Você' : 'Equipe da Ouvidoria'
}

interface MessageForm { body: string }

export function ClientReportDetailPage() {
  const { protocol } = useParams<{ protocol: string }>()
  return <ClientReportDetail key={protocol} protocol={protocol} />
}

function ClientReportDetail({ protocol }: { protocol: string | undefined }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = pageFromSearch(searchParams.get('messagesPage'))
  const queryClient = useQueryClient()
  const submitting = useRef(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sentNotice, setSentNotice] = useState(false)
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<MessageForm>({ defaultValues: { body: '' } })

  const report = useQuery({
    queryKey: ['client-report', protocol],
    queryFn: ({ signal }) => clientReportsApi.detail(protocol!, { signal }),
    enabled: Boolean(protocol),
    retry: false,
  })
  const messages = useQuery({
    queryKey: ['client-report-messages', protocol, page, messagesPageSize],
    queryFn: ({ signal }) => reportMessagesApi.listMine(protocol!, { page, size: messagesPageSize }, { signal }),
    enabled: Boolean(protocol) && report.isSuccess,
    retry: false,
  })

  function changePage(next: number) {
    const params = new URLSearchParams(searchParams)
    if (next === 0) params.delete('messagesPage')
    else params.set('messagesPage', String(next))
    setSearchParams(params)
  }

  async function submit({ body }: MessageForm) {
    if (!protocol || submitting.current || report.data?.closedAt) return
    submitting.current = true
    setSendError(null)
    setSentNotice(false)
    try {
      await reportMessagesApi.sendMine(protocol, { body: body.trim() })
      reset()
      setSentNotice(true)
      void queryClient.invalidateQueries({ queryKey: ['client-report-messages', protocol] })
      void queryClient.invalidateQueries({ queryKey: ['client-report', protocol] })
      if (messages.data) changePage(Math.floor(messages.data.totalElements / messagesPageSize))
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details?.body) setError('body', { type: 'server', message: error.details.body })
        else if (error.kind === 'rate-limited') {
          const wait = error.retryAfterSeconds === null ? '' : ` Aguarde ${error.retryAfterSeconds} segundos.`
          setSendError(`Muitas tentativas.${wait}`)
        } else setSendError(error.message)
        if (error.kind === 'bad-request' || error.kind === 'not-found') {
          void queryClient.invalidateQueries({ queryKey: ['client-report', protocol] })
        }
      } else setSendError('Não foi possível enviar a mensagem. Tente novamente.')
    } finally {
      submitting.current = false
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Área do cliente</span>
          <h1>Detalhes da manifestação</h1>
        </div>
        <Link className={styles.secondaryLink} to="/client/manifestacoes">Voltar às manifestações</Link>
      </div>
      {report.isPending ? <Skeleton height="16rem" label="Carregando detalhes da manifestação" />
        : report.isError ? report.error instanceof ApiError && report.error.kind === 'not-found'
          ? <EmptyState title="Manifestação não encontrada" description="O protocolo não foi encontrado entre suas manifestações." />
          : <ErrorState description="Não foi possível carregar esta manifestação." onRetry={() => void report.refetch()} />
          : <>
            <Card className={styles.detailCard}>
              <div className={styles.reportTop}><Protocol value={report.data.protocol} /><StatusBadge closedAt={report.data.closedAt} /></div>
              <dl className={styles.detailFields}>
                <div><dt>Categoria</dt><dd>{report.data.category}</dd></div>
                <div><dt>Criada em</dt><dd><time dateTime={report.data.createdAt}>{formatReportDate(report.data.createdAt)}</time></dd></div>
                <div><dt>Data do ocorrido</dt><dd>{report.data.incidentDate ?? 'Não informada'}</dd></div>
                <div><dt>Local do ocorrido</dt><dd>{report.data.incidentLocation ?? 'Não informado'}</dd></div>
                <div className={styles.fullWidth}><dt>Descrição</dt><dd className={styles.fullDescription}>{report.data.description}</dd></div>
              </dl>
            </Card>

            <section aria-labelledby="messages-heading" className={styles.messagesSection}>
              <div className={styles.sectionHeading}><h2 id="messages-heading">Histórico de mensagens</h2></div>
              {report.data.messagesPurgedAt && <Alert tone="info">O histórico de mensagens foi removido conforme a política de retenção.</Alert>}
              {messages.isPending ? <Skeleton height="8rem" label="Carregando mensagens" />
                : messages.isError ? <ErrorState description="Não foi possível carregar as mensagens." onRetry={() => void messages.refetch()} />
                  : messages.data.totalElements === 0
                    ? !report.data.messagesPurgedAt && <EmptyState title="Nenhuma mensagem" description="As mensagens desta manifestação aparecerão aqui." />
                    : page >= messages.data.totalPages
                      ? <EmptyState title="Página de mensagens não encontrada" description="Não há mensagens nesta página." action={<Button variant="secondary" onClick={() => changePage(0)}>Voltar à primeira página</Button>} />
                      : <ol className={styles.messageList} start={page * messagesPageSize + 1}>
                        {messages.data.content.map((message) => <li key={message.id}>
                          <Card className={styles.messageCard}>
                            <div className={styles.messageMeta}>
                              <strong>{messageAuthor(message.authorRole)}</strong>
                              <time dateTime={message.createdAt}>{formatReportDate(message.createdAt)}</time>
                            </div>
                            <p className={styles.messageBody}>{message.body}</p>
                          </Card>
                        </li>)}
                      </ol>}
              {messages.data && messages.data.totalPages > 1 && page < messages.data.totalPages && (
                <Pagination page={page} totalPages={messages.data.totalPages} hasNext={page + 1 < messages.data.totalPages} disabled={messages.isFetching} onPageChange={changePage} />
              )}
            </section>

            {report.data.closedAt ? <Alert tone="info">Esta manifestação está encerrada. O histórico permanece disponível para leitura, mas novas mensagens não são permitidas.</Alert>
              : <Card className={styles.messageFormCard}>
                <h2>Enviar mensagem</h2>
                {sentNotice && <Alert tone="success">Mensagem enviada.</Alert>}
                {sendError && <Alert tone="error">{sendError}</Alert>}
                <form className={styles.messageForm} onSubmit={handleSubmit(submit)} noValidate>
                  <TextAreaField
                    id="message-body" label="Mensagem" required rows={5} maxLength={10_000}
                    hint="Até 10.000 caracteres." error={errors.body?.message}
                    {...register('body', { validate: (value) => {
                      const result = messageSchema.safeParse(value)
                      return result.success || result.error.issues[0]?.message || 'Mensagem inválida.'
                    } })}
                  />
                  <Button type="submit" busy={isSubmitting}>Enviar mensagem</Button>
                </form>
              </Card>}
          </>}
    </div>
  )
}
