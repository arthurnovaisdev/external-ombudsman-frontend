import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, Pagination, Skeleton } from '../../shared/components'
import { clientReportsApi } from './api'
import { ReportSummaryCard } from './ReportSummaryCard'
import styles from './ClientReports.module.css'

const pageSize = 10

function pageFromSearch(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 0
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : 0
}

export function ClientReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = pageFromSearch(searchParams.get('page'))
  const reports = useQuery({
    queryKey: ['client-reports', page, pageSize],
    queryFn: ({ signal }) => clientReportsApi.list({ page, size: pageSize }, { signal }),
    placeholderData: keepPreviousData,
    retry: false,
  })

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Área do cliente</span>
          <h1>Minhas manifestações</h1>
          <p className={styles.lead}>Acompanhe suas manifestações, começando pelas mais recentes.</p>
        </div>
        <Link className={styles.secondaryLink} to="/client">Voltar ao início</Link>
      </div>

      {reports.isPending || reports.isPlaceholderData ? <div className={styles.loadingList} aria-label="Carregando minhas manifestações"><Skeleton height="10rem" /><Skeleton height="10rem" /></div>
        : reports.isError ? <ErrorState description="Não foi possível carregar suas manifestações." onRetry={() => void reports.refetch()} />
          : reports.data.totalElements === 0 ? <EmptyState title="Nenhuma manifestação registrada" description="Seus registros aparecerão aqui após serem criados." />
            : page >= reports.data.totalPages ? <EmptyState title="Página não encontrada" description="Não há manifestações nesta página." action={<button type="button" className={styles.secondaryLink} onClick={() => setSearchParams({ page: '0' })}>Voltar à primeira página</button>} />
              : <>
                <p className={styles.count} aria-live="polite">{new Intl.NumberFormat('pt-BR').format(reports.data.totalElements)} manifestações</p>
                <div className={styles.reportList}>{reports.data.content.map((report) => <ReportSummaryCard key={report.protocol} report={report} />)}</div>
              </>}

      {reports.data && reports.data.totalPages > 1 && page < reports.data.totalPages && (
        <Pagination
          page={page}
          totalPages={reports.data.totalPages}
          hasNext={page + 1 < reports.data.totalPages}
          disabled={reports.isPlaceholderData || reports.isFetching}
          onPageChange={(next) => setSearchParams({ page: String(next) })}
        />
      )}
    </div>
  )
}
