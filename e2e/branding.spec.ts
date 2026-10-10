import { expect, test } from '@playwright/test'

for (const width of [375, 1280]) {
  test(`logo nas telas públicas e favicon em ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 800 })

    for (const path of ['/', '/login', '/esqueci-senha', '/reset-password']) {
      await page.goto(path)
      const logo = page.locator('main img[alt=""][aria-hidden="true"]')
      await expect(logo).toBeVisible()
      const image = await logo.evaluate((element: HTMLImageElement) => ({
        width: element.naturalWidth,
        height: element.naturalHeight,
        renderedWidth: element.getBoundingClientRect().width,
        renderedHeight: element.getBoundingClientRect().height,
      }))
      expect(image.width).toBe(1254)
      expect(image.height).toBe(1254)
      expect(image.renderedWidth).toBeGreaterThanOrEqual(40)
      expect(image.renderedWidth).toBe(image.renderedHeight)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }

    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/logo.ico')
    const favicon = await request.get('/logo.ico')
    expect(favicon.status()).toBe(200)
    expect(favicon.headers()['content-type']).toContain('image/x-icon')
    expect((await favicon.body()).length).toBeGreaterThan(0)
  })
}
