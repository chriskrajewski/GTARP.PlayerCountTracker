import { test, expect } from '@playwright/test'

const BASE_URL =
  process.env.PLAYER_TRACKER_BASE_URL?.replace(/\/$/, '') ??
  'https://rpstats.com'

test('Multi-stream viewer loads manual entry form', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/multi-stream`, {
    waitUntil: 'domcontentloaded',
  })
  expect(response?.status()).toBeLessThan(400)

  await expect(page.getByText(/No streams selected/i)).toBeVisible()
  await expect(page.getByText(/Enter Stream Names Manually/i)).toBeVisible()
})
