import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Card, ErrorState, Protocol, Skeleton, StatusBadge } from '../../shared/components'
import { clientReportsApi } from './api'
import { formatReportDate } from './presentation'
import styles from './ClientReports.module.css'

export function ClientReportDetailPage() {
  const { protocol } = useParams<{ protocol: string }>()
  const report = useQuery({
    queryKey: ['client-report', protocol],
    queryFn: ({ signal }) => clientReportsApi.detail(protocol!, { signal }),
    enabled: Boolean(protocol),
    retry: false,
  })

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
        : report.isError ? <ErrorState description="Não foi possível carregar esta manifestação." onRetry={() => void report.refetch()} />
          : <Card className={styles.detailCard}>
            <div className={styles.reportTop}><Protocol value={report.data.protocol} /><StatusBadge closedAt={report.data.closedAt} /></div>
            <dl className={styles.detailFields}>
              <div><dt>Categoria</dt><dd>{report.data.category}</dd></div>
              <div><dt>Criada em</dt><dd><time dateTime={report.data.createdAt}>{formatReportDate(report.data.createdAt)}</time></dd></div>
              {report.data.incidentDate && <div><dt>Data do ocorrido</dt><dd>{report.data.incidentDate}</dd></div>}
              {report.data.incidentLocation && <div><dt>Local do ocorrido</dt><dd>{report.data.incidentLocation}</dd></div>}
              <div className={styles.fullWidth}><dt>Descrição</dt><dd className={styles.fullDescription}>{report.data.description}</dd></div>
            </dl>
          </Card>}
    </div>
  )
}
