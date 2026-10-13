import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import type { CategoryResponseDTO } from '../../shared/api/contracts'
import { ApiError } from '../../shared/api/errors'
import { Alert, Button, Card, ConfirmModal, EmptyState, ErrorState, Pagination, Skeleton } from '../../shared/components'
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
  const queryClient = useQueryClient()
  const acting = useRef(false)
  const noticeRef = useRef<HTMLDivElement>(null)
  const [target, setTarget] = useState<CategoryResponseDTO | null>(null)
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const categories = useQuery({
    queryKey: ['categories', 'admin-list', page, pageSize],
    queryFn: ({ signal }) => categoriesApi.listAdmin({ page, size: pageSize }, { signal }),
    placeholderData: keepPreviousData,
    retry: false,
  })

  useEffect(() => {
    if (notice && !categories.isFetching) noticeRef.current?.focus()
  }, [notice, categories.isFetching])

  function changePage(next: number) {
    const params = new URLSearchParams(searchParams)
    if (next === 0) params.delete('page')
    else params.set('page', String(next))
    setSearchParams(params)
  }

  async function confirmDeactivation() {
    if (!target?.active || acting.current) return
    acting.current = true
    setPending(true)
    setActionError(null)
    setNotice(null)
    try {
      await categoriesApi.deactivate(target.id)
      setTarget(null)
      setNotice(`Categoria ${target.name} desativada.`)
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
    } catch (error) {
      setTarget(null)
      if (error instanceof ApiError) {
        const messages: Partial<Record<typeof error.kind, string>> = {
          unauthorized: 'Sua sessão expirou. Entre novamente para desativar a categoria.',
          forbidden: 'Você não tem permissão para desativar esta categoria.',
          'not-found': 'Categoria não encontrada. Atualize a lista e tente novamente.',
          'rate-limited': 'Muitas requisições. Aguarde antes de tentar novamente.',
          network: 'Não foi possível conectar ao servidor. A categoria não foi alterada nesta tela.',
        }
        setActionError(messages[error.kind] ?? error.message)
      } else setActionError('Não foi possível desativar a categoria. Tente novamente.')
    } finally {
      acting.current = false
      setPending(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>Área administrativa</span><h1>Categorias</h1><p className={styles.lead}>Consulte a situação das categorias cadastradas.</p></div>
        <Link className={styles.primaryLink} to="/admin/categorias/nova">Nova categoria</Link>
      </div>

      {notice && <div ref={noticeRef} tabIndex={-1}><Alert tone="success">{notice}</Alert></div>}
      {actionError && <Alert tone="error">{actionError}</Alert>}

      {categories.isPending || categories.isPlaceholderData ? <div className={styles.loadingList} aria-label="Carregando categorias"><Skeleton height="5rem" /><Skeleton height="5rem" /></div>
        : categories.isError ? <ErrorState description={categories.error instanceof ApiError ? categories.error.message : 'Não foi possível carregar as categorias.'} onRetry={() => void categories.refetch()} />
          : categories.data.totalElements === 0 ? <EmptyState title="Nenhuma categoria cadastrada" description="Cadastre uma categoria para disponibilizá-la nas novas manifestações." />
            : page >= categories.data.totalPages ? <EmptyState title="Página não encontrada" description="Não há categorias nesta página." action={<Button variant="secondary" onClick={() => changePage(0)}>Voltar à primeira página</Button>} />
              : <>
                <p className={styles.count} aria-live="polite">{new Intl.NumberFormat('pt-BR').format(categories.data.totalElements)} categorias no total</p>
                <ul className={styles.categoryList}>{categories.data.content.map((category) => <li key={category.id}>
                  <Card className={styles.categoryCard}>
                    <strong>{category.name}</strong>
                    <span className={category.active ? styles.activeBadge : styles.inactiveBadge}>{category.active ? 'Ativa' : 'Inativa'}</span>
                    {category.active && <Button variant="destructive" disabled={pending} onClick={() => { setActionError(null); setNotice(null); setTarget(category) }}>Desativar <span className="sr-only">{category.name}</span></Button>}
                  </Card>
                </li>)}</ul>
              </>}

      {categories.data && categories.data.totalPages > 1 && page < categories.data.totalPages && (
        <Pagination page={page} totalPages={categories.data.totalPages} hasNext={page + 1 < categories.data.totalPages} disabled={categories.isPlaceholderData || categories.isFetching || pending} onPageChange={changePage} />
      )}

      <ConfirmModal
        open={target !== null}
        title="Desativar categoria?"
        description={`Confirme a desativação de ${target?.name ?? 'esta categoria'}. Ela deixará de estar disponível para novas manifestações, mas continuará identificando manifestações antigas.`}
        confirmLabel="Confirmar desativação"
        pending={pending}
        onCancel={() => setTarget(null)}
        onConfirm={() => void confirmDeactivation()}
      />
    </div>
  )
}
