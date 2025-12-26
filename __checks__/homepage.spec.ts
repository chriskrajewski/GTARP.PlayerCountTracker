import { test, expect, Page } from '@playwright/test'

const BASE_URL =
  process.env.PLAYER_TRACKER_BASE_URL?.replace(/\/$/, '') ??
  'https://rpstats.com'

test.describe('Homepage experience', () => {
  test('renders dashboard navigation and hero', async ({ page }: { page: Page }) => {
    const response = await page.goto(`${BASE_URL}/`, {
      waitUntil: 'networkidle',
    })
    expect(response?.status()).toBeLessThan(400)

    await expect(
      page.getByRole('heading', {
        name: /Discover, Track, and Watch GTA Roleplay/i,
      }),
    ).toBeVisible()

    await expect(page.getByRole('button', { name: /Feedback/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Changelog/i })).toBeVisible()
    await expect(page.getByText(/Player Count Over Time/i)).toBeVisible()
  })

  test('navigates to changelog section', async ({ page }: { page: Page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })

    await page.getByRole('link', { name: /Changelog/i }).click()
    await expect(page).toHaveURL(/\/changelog/)
    await expect(
      page.getByText(/latest improvements and updates/i),
    ).toBeVisible()
  })
})
