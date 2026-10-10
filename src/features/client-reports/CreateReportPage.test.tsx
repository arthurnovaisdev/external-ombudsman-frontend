import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { AppRoutes } from '../../app/router/AppRoutes'
import { AuthProvider } from '../auth/AuthProvider'
import { memoryToken } from '../../shared/auth/memoryToken'
import type { CategoryResponseDTO } from '../../shared/api/contracts'
import { fixtures } from '../../test/handlers'
import { server } from '../../test/server'

const categoriesUrl = 'http://localhost:8080/api/categories'
const reportsUrl = 'http://localhost:8080/api/reports'
const timestamp = '2026-10-09T10:00:00'

function renderFlow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

async function openForm() {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: 'Username' }), 'cliente')
  await user.type(screen.getByLabelText(/^Senha/), 'senha-correta')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  await user.click(await screen.findByRole('link', { name: 'Nova manifestação' }))
  await screen.findByRole('combobox', { name: 'Categoria' })
  return user
}

afterEach(() => memoryToken.clear())

it('envia somente os quatro campos do DTO como JSON, mostra protocolo e invalida lista/dashboard', async () => {
  const calls: { contentType: string | null; body: unknown }[] = []
  server.use(http.post(reportsUrl, async ({ request }) => {
    calls.push({ contentType: request.headers.get('Content-Type'), body: await request.json() })
    return HttpResponse.json({ protocol: fixtures.protocol }, { status: 201 })
  }))
  const client = renderFlow()
  const user = await openForm()
  expect(screen.getByText('O envio de anexos está temporariamente indisponível.')).toBeInTheDocument()
  expect(screen.queryByLabelText(/arquivo|anexo/i, { selector: 'input' })).not.toBeInTheDocument()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Categoria' }), fixtures.category.id)
  await user.type(screen.getByRole('textbox', { name: 'Descrição' }), '  Relato do atendimento  ')
  await user.type(screen.getByRole('textbox', { name: 'Local do ocorrido' }), '  Escritório  ')
  await user.click(screen.getByRole('button', { name: 'Registrar manifestação' }))
  expect(await screen.findByRole('heading', { name: 'Manifestação registrada' })).toBeInTheDocument()
  expect(screen.getByText(fixtures.protocol)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Visualizar manifestação' })).toHaveAttribute('href', `/client/manifestacoes/${fixtures.protocol}`)
  expect(screen.getByRole('link', { name: 'Voltar para Minhas manifestações' })).toHaveAttribute('href', '/client/manifestacoes')
  expect(calls).toEqual([{ contentType: 'application/json', body: {
    categoryId: fixtures.category.id, description: 'Relato do atendimento', incidentDate: null, incidentLocation: 'Escritório',
  } }])
  expect(client.getQueryState(['client-reports', 0, 5])?.isInvalidated).toBe(true)
})

it('carrega mais de 50 categorias e oferece somente as ativas', async () => {
  const firstPage: CategoryResponseDTO[] = Array.from({ length: 50 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: `Categoria ${index}`,
    active: index !== 0,
  }))
  const pages: number[] = []
  server.use(http.get(categoriesUrl, ({ request }) => {
    const url = new URL(request.url)
    pages.push(Number(url.searchParams.get('page')))
    expect(url.searchParams.get('size')).toBe('50')
    return HttpResponse.json({ content: pages.at(-1) === 0 ? firstPage : [fixtures.category], number: pages.at(-1), size: 50, totalElements: 51, totalPages: 2 })
  }))
  renderFlow()
  const user = await openForm()
  const category = screen.getByRole('combobox', { name: 'Categoria' })
  expect(screen.queryByRole('option', { name: 'Categoria 0' })).not.toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Categoria 49' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Carregar mais categorias' }))
  expect(await screen.findByRole('option', { name: 'Atendimento' })).toBeInTheDocument()
  expect(category).toBeInTheDocument()
  expect(pages).toEqual([0, 1])
})

it('valida campos obrigatórios, data futura e tamanhos antes do envio', async () => {
  let posts = 0
  server.use(http.post(reportsUrl, () => { posts += 1; return HttpResponse.json({ protocol: fixtures.protocol }, { status: 201 }) }))
  renderFlow()
  const user = await openForm()
  await user.click(screen.getByRole('button', { name: 'Registrar manifestação' }))
  expect(await screen.findByText('Selecione uma categoria.')).toBeInTheDocument()
  expect(screen.getByText('Descreva a manifestação.')).toBeInTheDocument()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Categoria' }), fixtures.category.id)
  fireEvent.change(screen.getByRole('textbox', { name: 'Descrição' }), { target: { value: 'a'.repeat(5001) } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Local do ocorrido' }), { target: { value: 'b'.repeat(256) } })
  fireEvent.change(screen.getByLabelText('Data do ocorrido'), { target: { value: '2999-01-01' } })
  await user.click(screen.getByRole('button', { name: 'Registrar manifestação' }))
  expect(await screen.findByText('Use no máximo 5.000 caracteres.')).toBeInTheDocument()
  expect(screen.getByText('Use no máximo 255 caracteres.')).toBeInTheDocument()
  expect(screen.getByText('A data do ocorrido não pode estar no futuro.')).toBeInTheDocument()
  expect(posts).toBe(0)
})

it('impede envio duplo enquanto aguarda a resposta', async () => {
  let posts = 0
  let release: (() => void) | undefined
  server.use(http.post(reportsUrl, async () => {
    posts += 1
    await new Promise<void>((resolve) => { release = resolve })
    return HttpResponse.json({ protocol: fixtures.protocol }, { status: 201 })
  }))
  renderFlow()
  const user = await openForm()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Categoria' }), fixtures.category.id)
  await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Relato')
  const button = screen.getByRole('button', { name: 'Registrar manifestação' })
  fireEvent.submit(button.closest('form')!)
  fireEvent.submit(button.closest('form')!)
  await waitFor(() => expect(posts).toBe(1))
  expect(button).toBeDisabled()
  release?.()
  expect(await screen.findByRole('heading', { name: 'Manifestação registrada' })).toBeInTheDocument()
})

it('trata categoria removida, erro de validação e limite de tentativas', async () => {
  let attempts = 0
  server.use(http.post(reportsUrl, () => {
    attempts += 1
    if (attempts === 1) return HttpResponse.json({ status: 404, erro: 'Categoria não encontrada.', timestamp }, { status: 404 })
    if (attempts === 2) return HttpResponse.json({ status: 400, erro: 'A categoria selecionada não está disponível.', timestamp }, { status: 400 })
    if (attempts === 3) return HttpResponse.json({ status: 400, detalhes: { description: 'Descrição inválida.' }, timestamp }, { status: 400 })
    return HttpResponse.json({ status: 429, erro: 'Muitas tentativas.', timestamp }, { status: 429, headers: { 'Retry-After': '30' } })
  }))
  renderFlow()
  const user = await openForm()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Categoria' }), fixtures.category.id)
  await user.type(screen.getByRole('textbox', { name: 'Descrição' }), 'Relato')
  const submit = screen.getByRole('button', { name: 'Registrar manifestação' })
  await user.click(submit)
  expect(await screen.findByText('A categoria selecionada foi removida ou está inativa. Escolha outra categoria.')).toBeInTheDocument()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Categoria' }), fixtures.category.id)
  await user.click(submit)
  expect(await screen.findByText('A categoria selecionada foi removida ou está inativa. Escolha outra categoria.')).toBeInTheDocument()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Categoria' }), fixtures.category.id)
  await user.click(submit)
  expect(await screen.findByText('Descrição inválida.')).toBeInTheDocument()
  await user.click(submit)
  expect(await screen.findByText('Muitas tentativas. Aguarde 30 segundos antes de tentar novamente.')).toBeInTheDocument()
  expect(attempts).toBe(4)
})
