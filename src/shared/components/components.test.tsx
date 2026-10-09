import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import {
  Alert, Button, ConfirmModal, DateField, EmptyState, ErrorBoundary, ErrorState,
  Pagination, PasswordField, ResponsiveTable, SelectField, StatusBadge,
  TextAreaField, TextField, ToastProvider, useToast,
} from './index'

describe('design system acessível', () => {
  it('associa labels, dicas e mensagens de erro aos campos', async () => {
    const user = userEvent.setup()
    render(<div>
      <TextField id="username" label="Username" hint="Use o username cadastrado" error="Username obrigatório" required />
      <PasswordField id="password" label="Senha" />
      <DateField id="incident-date" label="Data do ocorrido" />
      <TextAreaField id="description" label="Descrição" />
      <SelectField id="category" label="Categoria" options={[{ value: 'a', label: 'Atendimento' }]} />
    </div>)

    const username = screen.getByRole('textbox', { name: 'Username' })
    expect(username).toHaveAttribute('aria-invalid', 'true')
    expect(username).toHaveAttribute('aria-describedby', 'username-hint username-error')
    expect(username).toHaveAttribute('required')
    expect(screen.getByRole('alert')).toHaveTextContent('Username obrigatório')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Data do ocorrido')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Descrição').tagName).toBe('TEXTAREA')
    expect(screen.getByRole('combobox', { name: 'Categoria' })).toBeInTheDocument()
    await user.tab()
    expect(username).toHaveFocus()
  })

  it('permite acionar botões e paginação pelo teclado', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    const onAction = vi.fn()
    render(<div>
      <Button onClick={onAction}>Continuar</Button>
      <Button variant="secondary" disabled>Indisponível</Button>
      <Button variant="destructive">Remover</Button>
      <Pagination page={0} hasNext onPageChange={onNext} />
    </div>)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Continuar' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onAction).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(onNext).toHaveBeenCalledWith(1)
  })

  it('mantém o foco dentro do modal, fecha com Escape e devolve foco ao acionador', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return <>
        <Button onClick={() => setOpen(true)}>Abrir diálogo</Button>
        <ConfirmModal open={open} title="Encerrar manifestação?" description="Confirme a ação." confirmLabel="Encerrar" onCancel={() => setOpen(false)} onConfirm={() => setOpen(false)} />
      </>
    }
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Abrir diálogo' })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Encerrar manifestação?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(within(dialog).getByRole('button', { name: 'Encerrar' })).toHaveFocus()
    await user.tab()
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('deriva a situação apenas de closedAt e mantém tabela rolável semanticamente', () => {
    render(<div>
      <StatusBadge closedAt={null} />
      <StatusBadge closedAt="2026-10-09T10:00:00Z" />
      <ResponsiveTable caption="Manifestações">
        <thead><tr><th scope="col">Protocolo</th></tr></thead>
        <tbody><tr><td>DEN-2026-ABCDEFGH</td></tr></tbody>
      </ResponsiveTable>
    </div>)
    expect(screen.getByText('Em andamento')).toBeInTheDocument()
    expect(screen.getByText('Encerrada')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Tabela: Manifestações' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('table', { name: 'Manifestações' })).toBeInTheDocument()
  })

  it('anuncia alertas, toast e erro com retry', async () => {
    const user = userEvent.setup()
    const retry = vi.fn()
    function ToastTrigger() {
      const { notify } = useToast()
      return <Button onClick={() => notify('Operação concluída', 'success')}>Notificar</Button>
    }
    render(<ToastProvider>
      <Alert tone="error">Não foi possível salvar.</Alert>
      <EmptyState title="Sem registros" description="Nenhum item disponível." />
      <ErrorState description="Falha ao carregar." onRetry={retry} />
      <ToastTrigger />
    </ToastProvider>)
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(retry).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Notificar' }))
    expect(screen.getByRole('status')).toHaveTextContent('Operação concluída')
    await user.click(screen.getByRole('button', { name: /Dispensar notificação/ }))
    expect(screen.queryByText('Operação concluída')).not.toBeInTheDocument()
  })

  it('isola erro de renderização e oferece retry', () => {
    const onError = vi.fn()
    function Broken({ fail }: { fail: boolean }) { if (fail) throw new Error('Falha interna'); return <p>Conteúdo recuperado</p> }
    function Harness() {
      const [fail, setFail] = useState(true)
      return <><button onClick={() => setFail(false)}>Reparar</button><ErrorBoundary onError={onError}><Broken fail={fail} /></ErrorBoundary></>
    }
    render(<Harness />)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível mostrar esta página')
    expect(onError).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Reparar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(screen.getByText('Conteúdo recuperado')).toBeInTheDocument()
  })
})
