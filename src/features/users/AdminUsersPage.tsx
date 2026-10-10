import { useRef, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import type { UserResponseDTO } from '../../shared/api/contracts'
import { ApiError } from '../../shared/api/errors'
import { Alert, Button, ConfirmModal, EmptyState, ErrorState, Pagination, ResponsiveTable, Skeleton } from '../../shared/components'
import { accountApi } from '../account/api'
import { usersApi } from './api'
import styles from './AdminUsers.module.css'

const pageSize = 20

function pageFromSearch(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 0
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : 0
}

function roleLabel(role: string): string {
  return role === 'CLIENT' ? 'Cliente' : role === 'ADMIN' ? 'Administrador' : role
}

export function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = pageFromSearch(searchParams.get('page'))
  const queryClient = useQueryClient()
  const acting = useRef(false)
  const [target, setTarget] = useState<UserResponseDTO | null>(null)
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const profile = useQuery({
    queryKey: ['account', 'me'],
    queryFn: ({ signal }) => accountApi.me({ signal }),
    refetchOnMount: 'always',
    retry: false,
  })
  const users = useQuery({
    queryKey: ['admin-users', page, pageSize],
    queryFn: ({ signal }) => usersApi.list({ page, size: pageSize }, { signal }),
    placeholderData: keepPreviousData,
    retry: false,
  })

  function changePage(next: number) {
    const params = new URLSearchParams(searchParams)
    if (next === 0) params.delete('page')
    else params.set('page', String(next))
    setSearchParams(params)
  }

  async function confirmAction() {
    if (!target || acting.current || !profile.isSuccess || target.id === profile.data.id) return
    acting.current = true
    setPending(true)
    setActionError(null)
    setNotice(null)
    try {
      if (target.active) await usersApi.deactivate(target.id)
      else await usersApi.activate(target.id)
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setNotice(target.active ? `Usuário ${target.name} desativado.` : `Usuário ${target.name} ativado.`)
      setTarget(null)
    } catch (error) {
      setTarget(null)
      setActionError(error instanceof ApiError ? error.message : 'Não foi possível alterar a situação do usuário. Tente novamente.')
    } finally {
      acting.current = false
      setPending(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>Área administrativa</span><h1>Clientes</h1><p className={styles.lead}>Consulte os usuários cadastrados e gerencie a ativação das contas.</p></div>
        <Link className={styles.primaryLink} to="/admin/clientes/novo">Cadastrar cliente</Link>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}
      {profile.isError && <ErrorState title="Não foi possível confirmar sua conta" description="As ações ficam indisponíveis até que seu perfil seja carregado." onRetry={() => void profile.refetch()} />}

      {users.isPending || users.isPlaceholderData ? <div aria-label="Carregando clientes"><Skeleton height="13rem" /><Skeleton height="3rem" /></div>
        : users.isError ? <ErrorState description="Não foi possível carregar os clientes." onRetry={() => void users.refetch()} />
          : users.data.totalElements === 0 ? <EmptyState title="Nenhum usuário cadastrado" description="Os usuários cadastrados aparecerão aqui." />
            : page >= users.data.totalPages ? <EmptyState title="Página não encontrada" description="Não há clientes nesta página." action={<Button variant="secondary" onClick={() => changePage(0)}>Voltar à primeira página</Button>} />
              : <>
                <p className={styles.count} aria-live="polite">{new Intl.NumberFormat('pt-BR').format(users.data.totalElements)} usuários</p>
                <ResponsiveTable caption="Usuários cadastrados">
                  <thead><tr><th scope="col">Nome</th><th scope="col">Username</th><th scope="col">E-mail</th><th scope="col">Perfil</th><th scope="col">Situação</th><th scope="col">Ação</th></tr></thead>
                  <tbody>{users.data.content.map((user) => <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.username}</td>
                    <td>{user.contactEmail ?? 'Não informado'}</td>
                    <td>{roleLabel(user.role)}</td>
                    <td><span className={user.active ? styles.active : styles.inactive}>{user.active ? 'Ativo' : 'Inativo'}</span></td>
                    <td>{profile.isPending ? <span className={styles.muted}>Carregando perfil</span>
                      : profile.isError ? <span className={styles.muted}>Ação indisponível</span>
                        : user.id === profile.data.id ? <span className={styles.muted}>Sua conta</span>
                          : <Button variant={user.active ? 'destructive' : 'secondary'} disabled={pending} onClick={() => { setActionError(null); setNotice(null); setTarget(user) }}>
                            {user.active ? 'Desativar' : 'Ativar'} <span className="sr-only">{user.name}</span>
                          </Button>}</td>
                  </tr>)}</tbody>
                </ResponsiveTable>
              </>}

      {users.data && users.data.totalPages > 1 && page < users.data.totalPages && (
        <Pagination page={page} totalPages={users.data.totalPages} hasNext={page + 1 < users.data.totalPages} disabled={users.isPlaceholderData || users.isFetching || pending} onPageChange={changePage} />
      )}

      <ConfirmModal
        open={target !== null}
        title={target?.active ? 'Desativar usuário?' : 'Ativar usuário?'}
        description={target?.active
          ? `Confirme a desativação de ${target.name}. A desativação invalida os tokens anteriores e impede novos acessos.`
          : `Confirme a ativação de ${target?.name ?? 'este usuário'}.`}
        confirmLabel={target?.active ? 'Confirmar desativação' : 'Confirmar ativação'}
        variant={target?.active ? 'destructive' : 'primary'}
        pending={pending}
        onCancel={() => setTarget(null)}
        onConfirm={() => void confirmAction()}
      />
    </div>
  )
}
