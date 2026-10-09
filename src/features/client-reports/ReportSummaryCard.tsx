import { Link } from 'react-router-dom'
import type { ReportResponseDTO } from '../../shared/api/contracts'
import { Card, Protocol, StatusBadge } from '../../shared/components'
import { formatReportDate, summarizeDescription } from './presentation'
import styles from './ClientReports.module.css'

export function ReportSummaryCard({ report }: { report: ReportResponseDTO }) {
  return (
    <article><Card className={styles.reportCard}>
      <div className={styles.reportTop}>
        <Protocol value={report.protocol} />
        <StatusBadge closedAt={report.closedAt} />
      </div>
      <div className={styles.reportMeta}>
        <span><strong>Categoria:</strong> {report.category}</span>
        <span><strong>Criada em:</strong> <time dateTime={report.createdAt}>{formatReportDate(report.createdAt)}</time></span>
      </div>
      <p className={styles.reportDescription}>{summarizeDescription(report.description)}</p>
      <Link className={styles.detailLink} to={`/client/manifestacoes/${encodeURIComponent(report.protocol)}`}>
        Ver detalhes <span className="sr-only">da manifestação {report.protocol}</span><span aria-hidden="true"> →</span>
      </Link>
    </Card></article>
  )
}
