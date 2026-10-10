import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Card, EmptyState, ErrorState, Skeleton } from '../../shared/components'
import { adminReportsApi } from './api'
import { AdminReportSummaryCard } from './AdminReportSummaryCard'
import styles from './AdminReports.module.css'

const recentPageSize = 5

export function AdminDashboardPage() {
  const reports = useQuery({
    queryKey: ['admin-reports', 0, recentPageSize],
    queryFn: ({ signal }) => adminReportsApi.list({ page: 0, size: recentPageSize }, { signal }),
    retry: false,
  })

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Ouvidoria MBFREIRE</span>
          <h1>Dashboard</h1>
          <p className={styles.lead}>Acompanhe as manifestações recebidas pela ouvidoria.</p>
        </div>
      </div>

      <section aria-labelledby="total-heading" className={styles.totalSection}>
        <Card className={styles.totalCard}>
          <h2 id="total-heading">Total de manifestações</h2>
          {reports.isPending ? <Skeleton width="4rem" height="2.5rem" label="Carregando total de manifestações" />
            : reports.isError ? <span className={styles.unavailable}>Indisponível</span>
              : <strong className={styles.totalNumber}>{new Intl.NumberFormat('pt-BR').format(reports.data.totalElements)}</strong>}
          <p>Total informado pela paginação administrativa.</p>
        </Card>
      </section>

      <nav aria-label="Atalhos administrativos" className={styles.shortcuts}>
        <Link className={styles.shortcut} to="/admin/clientes">Clientes <span aria-hidden="true">→</span></Link>
        <Link className={styles.shortcut} to="/admin/categorias">Categorias <span aria-hidden="true">→</span></Link>
      </nav>

      <section aria-labelledby="recent-heading" className={styles.recentSection}>
        <div className={styles.sectionHeading}>
          <h2 id="recent-heading">Manifestações recentes</h2>
          <Link to="/admin/manifestacoes">Ver todas as manifestações</Link>
        </div>
        {reports.isPending ? <div className={styles.loadingList} aria-label="Carregando manifestações recentes"><Skeleton height="10rem" /><Skeleton height="10rem" /></div>
          : reports.isError ? <ErrorState description="Não foi possível carregar as manifestações." onRetry={() => void reports.refetch()} />
            : reports.data.content.length === 0 ? <EmptyState title="Nenhuma manifestação registrada" description="As manifestações dos clientes aparecerão aqui." />
              : <div className={styles.reportList}>{reports.data.content.map((report) => <AdminReportSummaryCard key={report.protocol} report={report} />)}</div>}
      </section>
    </div>
  )
}
