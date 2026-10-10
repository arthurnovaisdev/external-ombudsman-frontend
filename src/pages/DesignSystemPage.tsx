import { useState } from 'react'
import {
  Alert, BrandLogo, Button, Card, ConfirmModal, DateField, EmptyState, ErrorState,
  Pagination, PasswordField, Protocol, ResponsiveTable, SelectField,
  Skeleton, StatusBadge, TextAreaField, TextField, useToast,
} from '../shared/components'
import styles from './DesignSystemPage.module.css'

// Página de inspeção visual, disponível somente em desenvolvimento.
export function DesignSystemPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const { notify } = useToast()

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}><BrandLogo className={styles.mark} /><span>MB.FREIRE</span></div>
        <span className={styles.eyebrow}>Prévia visual · ambiente de desenvolvimento</span>
        <h1>Ouvidoria MBFREIRE</h1>
        <p>Componentes compartilhados. Os exemplos abaixo não representam dados nem operações reais.</p>
      </header>

      <div className={styles.grid}>
        <Card className={styles.panel}>
          <h2>Formulários e ações</h2>
          <div className={styles.fields}>
            <TextField id="demo-username" label="Username" placeholder="seu.username" required />
            <PasswordField id="demo-password" label="Senha" placeholder="Digite sua senha" required />
            <DateField id="demo-date" label="Data do ocorrido" />
            <SelectField id="demo-category" label="Categoria" defaultValue="" placeholder="Selecione" options={[{ value: 'sample', label: 'Exemplo visual' }]} />
            <TextAreaField id="demo-description" label="Descrição" placeholder="Descreva o ocorrido" />
            <TextField id="demo-invalid" label="Campo com erro" error="Informe um valor válido." />
          </div>
          <div className={styles.actions}>
            <Button>Primário</Button>
            <Button variant="secondary" onClick={() => setModalOpen(true)}>Abrir confirmação</Button>
            <Button variant="destructive" onClick={() => setModalOpen(true)}>Destrutivo</Button>
          </div>
        </Card>

        <Card className={styles.panel}>
          <h2>Situação e feedback</h2>
          <div className={styles.badges}>
            <StatusBadge closedAt={null} />
            <StatusBadge closedAt="2026-10-09T10:00:00Z" />
          </div>
          <Protocol value="DEN-2026-ABCDEFGH" />
          <Alert tone="warning" title="Aviso">Um atendimento encerrado não recebe novas mensagens.</Alert>
          <Alert tone="success" title="Sucesso">Este é um exemplo visual de confirmação.</Alert>
          <Button variant="secondary" onClick={() => notify('Esta é uma notificação de demonstração.', 'info')}>Mostrar toast</Button>
          <Skeleton width="70%" height="1.25rem" />
        </Card>

        <Card className={[styles.panel, styles.wide].join(' ')}>
          <h2>Tabela e paginação</h2>
          <ResponsiveTable caption="Exemplo visual de tabela">
            <thead><tr><th scope="col">Protocolo</th><th scope="col">Categoria</th><th scope="col">Situação</th></tr></thead>
            <tbody><tr><td>DEN-2026-ABCDEFGH</td><td>Exemplo</td><td><StatusBadge closedAt={null} /></td></tr></tbody>
          </ResponsiveTable>
          <Pagination page={0} hasNext={false} onPageChange={() => {}} />
        </Card>

        <div className={styles.states}>
          <EmptyState title="Nada por aqui" description="Exemplo de estado vazio, sem dados reais." />
          <ErrorState description="Exemplo de falha de carregamento." onRetry={() => notify('Ação de demonstração.', 'info')} />
        </div>
      </div>

      <ConfirmModal
        open={modalOpen}
        title="Confirmar ação?"
        description="Esta é apenas uma prévia visual. Nenhum dado será alterado."
        confirmLabel="Confirmar"
        onCancel={() => setModalOpen(false)}
        onConfirm={() => { setModalOpen(false); notify('Prévia confirmada.', 'success') }}
      />
    </main>
  )
}
