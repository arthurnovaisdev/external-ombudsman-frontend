import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, EmptyState, ErrorState, Pagination, Skeleton } from '../../shared/components'
import { categoriesApi } from './api'
import styles from './AdminCategories.module.css'

const pageSize = 20

function pageFromSearch(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 0
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : 0
}

export function AdminCategoriesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = pageFromSearch(searchParams.get('page'))
  const categories = useQuery({
    queryKey: ['categories', 'admin-list', page, pageSize],
    queryFn: ({ signal }) => categoriesApi.list({ page, size: pageSize }, { signal }),
    placeholderData: keepPreviousData,
    retry: false,
  })

  function changePage(next: number) {
    const params = new URLSearchParams(searchParams)
    if (next === 0) params.delete('page')
    else params.set('page', String(next))
    setSearchParams(params)
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>Área administrativa</span><h1>Categorias</h1><p className={styles.lead}>Categorias disponíveis para novas manifestações.</p></div>
        <Link className={styles.primaryLink} to="/admin/categorias/nova">Nova categoria</Link>
      </div>

      <Alert tone="info">Esta lista mostra apenas categorias ativas.</Alert>

      {categories.isPending || categories.isPlaceholderData ? <div className={styles.loadingList} aria-label="Carregando categorias"><Skeleton height="5rem" /><Skeleton height="5rem" /></div>
        : categories.isError ? <ErrorState description="Não foi possível carregar as categorias ativas." onRetry={() => void categories.refetch()} />
          : categories.data.totalElements === 0 ? <EmptyState title="Nenhuma categoria ativa" description="Cadastre uma categoria para disponibilizá-la nas novas manifestações." />
            : page >= categories.data.totalPages ? <EmptyState title="Página não encontrada" description="Não há categorias nesta página." action={<Button variant="secondary" onClick={() => changePage(0)}>Voltar à primeira página</Button>} />
              : <>
                <p className={styles.count} aria-live="polite">{new Intl.NumberFormat('pt-BR').format(categories.data.totalElements)} categorias ativas</p>
                <ul className={styles.categoryList}>{categories.data.content.map((category) => <li key={category.id}>
                  <Card className={styles.categoryCard}><strong>{category.name}</strong><span className={styles.activeBadge}>Ativa</span></Card>
                </li>)}</ul>
              </>}

      {categories.data && categories.data.totalPages > 1 && page < categories.data.totalPages && (
        <Pagination page={page} totalPages={categories.data.totalPages} hasNext={page + 1 < categories.data.totalPages} disabled={categories.isPlaceholderData || categories.isFetching} onPageChange={changePage} />
      )}
    </div>
  )
}
