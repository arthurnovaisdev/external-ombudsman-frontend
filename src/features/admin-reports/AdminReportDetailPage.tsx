import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import type { AttachmentResponseDTO, ReportAdminResponseDTO } from '../../shared/api/contracts'
import { ApiError } from '../../shared/api/errors'
import { Alert, Button, Card, ConfirmModal, EmptyState, ErrorState, Pagination, Protocol, Skeleton, StatusBadge, TextAreaField } from '../../shared/components'
import { attachmentsApi } from '../attachments/api'
import { formatReportDate } from '../client-reports/presentation'
import { reportMessagesApi } from '../report-messages/api'
import { adminReportsApi } from './api'
import styles from './AdminReports.module.css'

const messagesPageSize = 20
const messageSchema = z.string().trim().min(1, 'Escreva uma mensagem.').max(10_000, 'Use no máximo 10.000 caracteres.')

function pageFromSearch(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 0
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : 0
}

function formatFileSize(value: number | null): string {
  return value === null ? 'Tamanho não informado' : `${new Intl.NumberFormat('pt-BR').format(value)} bytes`
}

interface MessageForm { body: string }

export function AdminReportDetailPage() {
  const { protocol } = useParams<{ protocol: string }>()
  return <AdminReportDetail key={protocol} protocol={protocol} />
}

function AdminReportDetail({ protocol }: { protocol: string | undefined }) {
  const attachmentsEnabled = import.meta.env.VITE_ATTACHMENTS_ENABLED === 'true'
  const [searchParams, setSearchParams] = useSearchParams()
  const page = pageFromSearch(searchParams.get('messagesPage'))
  const queryClient = useQueryClient()
  const sending = useRef(false)
  const closing = useRef(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [closePending, setClosePending] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sentNotice, setSentNotice] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<MessageForm>({ defaultValues: { body: '' } })

  const report = useQuery({
    queryKey: ['admin-report', protocol],
    queryFn: ({ signal }) => adminReportsApi.detail(protocol!, { signal }),
    enabled: Boolean(protocol),
    retry: false,
  })
  const messages = useQuery({
    queryKey: ['admin-report-messages', protocol, page, messagesPageSize],
    queryFn: ({ signal }) => reportMessagesApi.listAdmin(protocol!, { page, size: messagesPageSize }, { signal }),
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
    if (!protocol || sending.current || closing.current || closeOpen || report.data?.closedAt) return
    sending.current = true
    setSendError(null)
    setSentNotice(false)
    try {
      await reportMessagesApi.sendAdmin(protocol, { body: body.trim() })
      reset()
      setSentNotice(true)
      void queryClient.invalidateQueries({ queryKey: ['admin-report-messages', protocol] })
      void queryClient.invalidateQueries({ queryKey: ['admin-report', protocol] })
      if (messages.data) changePage(Math.floor(messages.data.totalElements / messagesPageSize))
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details?.body) setError('body', { type: 'server', message: error.details.body })
        else if (error.kind === 'rate-limited') {
          const wait = error.retryAfterSeconds === null ? '' : ` Aguarde ${error.retryAfterSeconds} segundos.`
          setSendError(`Muitas tentativas.${wait}`)
        } else setSendError(error.message)
        if (error.kind === 'bad-request' || error.kind === 'not-found') {
          void queryClient.invalidateQueries({ queryKey: ['admin-report', protocol] })
        }
      } else setSendError('Não foi possível enviar a mensagem. Tente novamente.')
    } finally {
      sending.current = false
    }
  }

  async function confirmClose() {
    if (!protocol || closing.current || sending.current || report.data?.closedAt) return
    closing.current = true
    setClosePending(true)
    setCloseError(null)
    try {
      const closed: ReportAdminResponseDTO = await adminReportsApi.close(protocol)
      queryClient.setQueryData(['admin-report', protocol], closed)
      setCloseOpen(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-report', protocol] }),
        queryClient.invalidateQueries({ queryKey: ['admin-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-report-messages', protocol] }),
      ])
    } catch (error) {
      setCloseOpen(false)
      setCloseError(error instanceof ApiError ? error.message : 'Não foi possível encerrar a manifestação. Tente novamente.')
      if (error instanceof ApiError && (error.kind === 'bad-request' || error.kind === 'not-found')) {
        void queryClient.invalidateQueries({ queryKey: ['admin-report', protocol] })
      }
    } finally {
      closing.current = false
      setClosePending(false)
    }
  }

  async function downloadAttachment(attachment: AttachmentResponseDTO) {
    if (!attachmentsEnabled || !protocol || downloadingId) return
    setDownloadingId(attachment.id)
    setDownloadError(null)
    try {
      const blob = await attachmentsApi.downloadAdmin(protocol, attachment.id)
      const url = URL.createObjectURL(blob)
      try {
        const link = document.createElement('a')
        link.href = url
        link.download = attachment.originalFileName
        document.body.appendChild(link)
        link.click()
        link.remove()
      } finally {
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      setDownloadError(error instanceof ApiError ? error.message : 'Não foi possível baixar o anexo.')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>Área administrativa</span><h1>Detalhes da manifestação</h1></div>
        <Link className={styles.secondaryLink} to="/admin/manifestacoes">Voltar às manifestações</Link>
      </div>

      {report.isPending ? <Skeleton height="16rem" label="Carregando detalhes da manifestação" />
        : report.isError ? report.error instanceof ApiError && report.error.kind === 'not-found'
          ? <EmptyState title="Manifestação não encontrada" description="O protocolo informado não foi encontrado." />
          : <ErrorState description="Não foi possível carregar esta manifestação." onRetry={() => void report.refetch()} />
          : <>
            <Card className={styles.detailCard}>
              <div className={styles.reportTop}><Protocol value={report.data.protocol} /><StatusBadge closedAt={report.data.closedAt} /></div>
              <h2>Manifestação</h2>
              <dl className={styles.detailFields}>
                <div><dt>Categoria</dt><dd>{report.data.category}</dd></div>
                <div><dt>Criada em</dt><dd><time dateTime={report.data.createdAt}>{formatReportDate(report.data.createdAt)}</time></dd></div>
                <div><dt>Data do ocorrido</dt><dd>{report.data.incidentDate ?? 'Não informada'}</dd></div>
                <div><dt>Local do ocorrido</dt><dd>{report.data.incidentLocation ?? 'Não informado'}</dd></div>
                {report.data.closedAt && <div><dt>Encerrada em</dt><dd><time dateTime={report.data.closedAt}>{formatReportDate(report.data.closedAt)}</time></dd></div>}
                <div className={styles.fullWidth}><dt>Descrição</dt><dd className={styles.fullDescription}>{report.data.description}</dd></div>
              </dl>
              <h2>Proprietário</h2>
              <dl className={styles.detailFields}>
                <div><dt>Nome</dt><dd>{report.data.ownerName}</dd></div>
                <div><dt>Username</dt><dd>{report.data.ownerUsername}</dd></div>
                <div><dt>E-mail de contato</dt><dd>{report.data.ownerContactEmail ?? 'Não informado'}</dd></div>
              </dl>
            </Card>

            {attachmentsEnabled && <section aria-labelledby="attachments-heading" className={styles.detailSection}>
              <h2 id="attachments-heading">Anexos</h2>
              {downloadError && <Alert tone="error">{downloadError}</Alert>}
              {report.data.attachments.length === 0 ? <EmptyState title="Nenhum anexo" description="Esta manifestação não possui anexos." />
                : <ul className={styles.attachmentList}>{report.data.attachments.map((attachment) => <li key={attachment.id}>
                  <Card className={styles.attachmentCard}>
                    <div><strong>{attachment.originalFileName}</strong><p>{attachment.contentType} · {formatFileSize(attachment.fileSize)} · <time dateTime={attachment.createdAt}>{formatReportDate(attachment.createdAt)}</time></p></div>
                    <Button variant="secondary" busy={downloadingId === attachment.id} disabled={Boolean(downloadingId)} onClick={() => void downloadAttachment(attachment)}>Baixar anexo <span className="sr-only">{attachment.originalFileName}</span></Button>
                  </Card>
                </li>)}</ul>}
            </section>}

            <section aria-labelledby="messages-heading" className={styles.detailSection}>
              <h2 id="messages-heading">Histórico de mensagens</h2>
              {report.data.messagesPurgedAt && <Alert tone="info">O histórico de mensagens foi removido conforme a política de retenção.</Alert>}
              {messages.isPending ? <Skeleton height="8rem" label="Carregando mensagens" />
                : messages.isError ? <ErrorState description="Não foi possível carregar as mensagens." onRetry={() => void messages.refetch()} />
                  : messages.data.totalElements === 0
                    ? !report.data.messagesPurgedAt && <EmptyState title="Nenhuma mensagem" description="As mensagens desta manifestação aparecerão aqui." />
                    : page >= messages.data.totalPages
                      ? <EmptyState title="Página de mensagens não encontrada" description="Não há mensagens nesta página." action={<Button variant="secondary" onClick={() => changePage(0)}>Voltar à primeira página</Button>} />
                      : <ol className={styles.messageList} start={page * messagesPageSize + 1}>{messages.data.content.map((message) => <li key={message.id}>
                        <Card className={styles.messageCard}>
                          <div className={styles.messageMeta}>
                            <strong>{message.authorName} ({message.authorUsername})</strong>
                            <time dateTime={message.createdAt}>{formatReportDate(message.createdAt)}</time>
                          </div>
                          <p className={styles.messageBody}>{message.body}</p>
                        </Card>
                      </li>)}</ol>}
              {messages.data && messages.data.totalPages > 1 && page < messages.data.totalPages && (
                <Pagination page={page} totalPages={messages.data.totalPages} hasNext={page + 1 < messages.data.totalPages} disabled={messages.isFetching} onPageChange={changePage} />
              )}
            </section>

            {report.data.closedAt ? <Alert tone="info">Esta manifestação está encerrada. O histórico permanece disponível para leitura, mas novas mensagens e anexos não são permitidos.</Alert>
              : <>
                <Card className={styles.messageFormCard}>
                  <h2>Responder ao cliente</h2>
                  {sentNotice && <Alert tone="success">Mensagem enviada.</Alert>}
                  {sendError && <Alert tone="error">{sendError}</Alert>}
                  <form className={styles.messageForm} onSubmit={handleSubmit(submit)} noValidate>
                    <TextAreaField id="admin-message-body" label="Mensagem" required rows={5} maxLength={10_000} hint="Até 10.000 caracteres." error={errors.body?.message}
                      {...register('body', { validate: (value) => {
                        const result = messageSchema.safeParse(value)
                        return result.success || result.error.issues[0]?.message || 'Mensagem inválida.'
                      } })} />
                    <Button type="submit" busy={isSubmitting} disabled={closePending || closeOpen}>Enviar resposta</Button>
                  </form>
                </Card>
                <section aria-labelledby="close-heading" className={styles.closeSection}>
                  <h2 id="close-heading">Encerramento</h2>
                  <p>Ao encerrar, novas mensagens e uploads de anexos do cliente serão bloqueados.</p>
                  {closeError && <Alert tone="error">{closeError}</Alert>}
                  <Button variant="destructive" disabled={isSubmitting || closePending} onClick={() => setCloseOpen(true)}>Encerrar manifestação</Button>
                </section>
              </>}
          </>}

      <ConfirmModal open={closeOpen} title="Encerrar manifestação?" description="Confirme o encerramento desta manifestação. Novas mensagens e uploads de anexos do cliente serão bloqueados. Esta ação não oferece reabertura." confirmLabel="Confirmar encerramento" pending={closePending} onCancel={() => setCloseOpen(false)} onConfirm={() => void confirmClose()} />
    </div>
  )
}
