import { expect, test } from '@playwright/test'

test('abre a fundação da aplicação', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ouvidoria MBFREIRE' })).toBeVisible()
})
