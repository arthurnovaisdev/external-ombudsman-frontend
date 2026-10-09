import { expect, test } from '@playwright/test'

test('prévia mobile não cria rolagem horizontal na página e mantém tabela acessível', async ({ page }) => {
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 })
    await page.goto('/design-system')
    await expect(page.getByRole('heading', { name: 'Ouvidoria MBFREIRE' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Tabela: Exemplo visual de tabela' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('cores principais mantêm contraste AA para texto normal', async ({ page }) => {
  await page.goto('/design-system')
  const ratios = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement)
    function luminance(hex: string) {
      const values = hex.match(/[a-f\d]{2}/gi)!.map((part) => parseInt(part, 16) / 255)
      const [r, g, b] = values.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    function contrast(foreground: string, background: string) {
      const a = luminance(css.getPropertyValue(foreground).trim())
      const b = luminance(css.getPropertyValue(background).trim())
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }
    return {
      text: contrast('--color-text', '--color-surface'),
      muted: contrast('--color-text-muted', '--color-surface'),
      primary: contrast('--color-accent-text', '--color-accent'),
      closed: contrast('--color-success', '--color-success-surface'),
      danger: contrast('--color-danger', '--color-danger-surface'),
    }
  })
  Object.values(ratios).forEach((ratio) => expect(ratio).toBeGreaterThanOrEqual(4.5))
})

test('prévia desktop mantém ações por teclado e foco no modal', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/design-system')
  const trigger = page.getByRole('button', { name: 'Abrir confirmação' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Confirmar ação?' })
  await expect(dialog).toBeVisible()
  const cancel = dialog.getByRole('button', { name: 'Cancelar' })
  await expect(cancel).toBeFocused()
  expect(await cancel.evaluate((element) => getComputedStyle(element).outlineWidth)).toBe('3px')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})
