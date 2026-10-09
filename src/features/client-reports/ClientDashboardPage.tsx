import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { accountApi } from '../account/api'
import { Card, EmptyState, ErrorState, Skeleton } from '../../shared/components'
import { clientReportsApi } from './api'
import { ReportSummaryCard } from './ReportSummaryCard'
import styles from './ClientReports.module.css'

const recentPageSize = 5

export function ClientDashboardPage() {
  const profile = useQuery({ queryKey: ['account', 'me'], queryFn: ({ signal }) => accountApi.me({ signal }), retry: false })
  const reports = useQuery({
    queryKey: ['client-reports', 0, recentPageSize],
    queryFn: ({ signal }) => clientReportsApi.list({ page: 0, size: recentPageSize }, { signal }),
    retry: false,
  })

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Ouvidoria MBFREIRE</span>
          <h1>Área do cliente</h1>
          {profile.isPending ? <Skeleton width="15rem" label="Carregando perfil" /> : profile.isError ? null : <p className={styles.greeting}>Olá, <strong>{profile.data.name}</strong>.</p>}
        </div>
        <Link className={styles.primaryLink} to="/client/manifestacoes/nova">Nova manifestação</Link>
      </div>

      {profile.isError && <ErrorState title="Não foi possível carregar seu perfil" description="Tente novamente para atualizar a saudação." onRetry={() => void profile.refetch()} />}

      <section aria-labelledby="total-heading" className={styles.totalSection}>
        <Card className={styles.totalCard}>
          <h2 id="total-heading">Total de manifestações</h2>
          {reports.isPending ? <Skeleton width="4rem" height="2.5rem" label="Carregando total de manifestações" />
            : reports.isError ? <span className={styles.unavailable}>Indisponível</span>
              : <strong className={styles.totalNumber}>{new Intl.NumberFormat('pt-BR').format(reports.data.totalElements)}</strong>}
          <p>Total informado pela paginação das suas manifestações.</p>
        </Card>
      </section>

      <section aria-labelledby="recent-heading" className={styles.recentSection}>
        <div className={styles.sectionHeading}>
          <h2 id="recent-heading">Manifestações recentes</h2>
          <Link to="/client/manifestacoes">Ver todas as manifestações</Link>
        </div>
        {reports.isPending ? <div className={styles.loadingList} aria-label="Carregando manifestações recentes"><Skeleton height="9rem" /><Skeleton height="9rem" /></div>
          : reports.isError ? <ErrorState description="Não foi possível carregar suas manifestações." onRetry={() => void reports.refetch()} />
            : reports.data.content.length === 0 ? <EmptyState title="Nenhuma manifestação registrada" description="Quando você registrar uma manifestação, ela aparecerá aqui." />
              : <div className={styles.reportList}>{reports.data.content.map((report) => <ReportSummaryCard key={report.protocol} report={report} />)}</div>}
      </section>
    </div>
  )
}
