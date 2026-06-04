import { expect, test } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});

test('mobile shell exposes pwa manifest and bottom navigation', async ({ page }) => {
  await page.goto('/login');

  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');

  await page.getByLabel('아이디').fill('employee01');
  await page.getByLabel('비밀번호').fill('password');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '모바일 주요 메뉴' })).toBeVisible();
  await page.getByRole('link', { name: /새 신청/ }).click();
  await expect(page.getByRole('heading', { name: '신청서 작성' })).toBeVisible();
});
