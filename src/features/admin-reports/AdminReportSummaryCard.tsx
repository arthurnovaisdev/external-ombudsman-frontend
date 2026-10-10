import type { ReportAdminSummaryResponseDTO } from '../../shared/api/contracts'
import { Link } from 'react-router-dom'
import { Card, Protocol, StatusBadge } from '../../shared/components'
import { formatReportDate, summarizeDescription } from '../client-reports/presentation'
import styles from './AdminReports.module.css'

export function AdminReportSummaryCard({ report }: { report: ReportAdminSummaryResponseDTO }) {
  return (
    <article><Card className={styles.reportCard}>
      <div className={styles.reportTop}>
        <Protocol value={report.protocol} />
        <StatusBadge closedAt={report.closedAt} />
      </div>
      <div className={styles.reportMeta}>
        <span><strong>Cliente:</strong> {report.ownerName} <span className={styles.username}>({report.ownerUsername})</span></span>
        <span><strong>Categoria:</strong> {report.category}</span>
        <span><strong>Criada em:</strong> <time dateTime={report.createdAt}>{formatReportDate(report.createdAt)}</time></span>
      </div>
      <p className={styles.reportDescription}>{summarizeDescription(report.description)}</p>
      <Link className={styles.detailLink} to={`/admin/manifestacoes/${encodeURIComponent(report.protocol)}`}>
        Ver detalhes <span className="sr-only">da manifestação {report.protocol}</span><span aria-hidden="true"> →</span>
      </Link>
    </Card></article>
  )
}
