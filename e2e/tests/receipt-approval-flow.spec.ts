import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page, loginId: string) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByLabel('아이디').fill(loginId);
  await page.getByLabel('비밀번호').fill('password');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByText('로그인 사용자')).toBeVisible();
}

test('영수증 신청부터 최종 승인 알림까지 처리한다', async ({ page }) => {
  const uniqueVendor = `문구점 E2E ${Date.now()}`;

  await login(page, 'employee01');
  await page.getByRole('link', { name: '새 신청' }).click();
  await page.getByLabel('신청일자').fill('2026-06-03');
  await page.getByLabel('영수증 일자').fill('2026-06-03');
  await page.getByLabel('사용처').fill(uniqueVendor);
  await page.getByLabel('금액').fill('12000');
  await page.getByLabel('신청 내용').fill('프로젝트 회의 준비물 구매');
  await page.getByLabel('영수증 이미지 첨부').setInputFiles('fixtures/receipt.png');
  await page.getByRole('button', { name: '제출' }).click();

  await expect(page.getByRole('heading', { name: '신청서 상세' })).toBeVisible();
  await expect(page.getByText(uniqueVendor)).toBeVisible();
  await expect(page.getByText('결재중')).toBeVisible();
  await expect(page.getByAltText('receipt.png 미리보기')).toBeVisible();
  await expect(page.getByLabel('결재 진행 상태').getByText('개발팀장')).toBeVisible();
  const applicationPath = new URL(page.url()).pathname;

  await login(page, 'lead-dev');
  await page.getByRole('link', { name: '결재함' }).click();
  const approvalRow = page.getByRole('row').filter({ hasText: uniqueVendor });
  await expect(approvalRow).toBeVisible();
  await approvalRow.getByLabel('결재 의견').fill('E2E 승인');
  await approvalRow.getByRole('button', { name: '승인' }).click();
  await expect(approvalRow).toBeHidden();

  await login(page, 'employee01');
  await page.goto(applicationPath);
  await expect(page.getByRole('heading', { name: '신청서 상세' })).toBeVisible();
  await expect(page.getByText(uniqueVendor)).toBeVisible();
  await expect(page.getByText('승인완료')).toBeVisible();
  const historyPanel = page.locator('section[aria-labelledby="approval-history-title"]');
  const approvalHistoryRow = historyPanel.getByRole('row').filter({ hasText: 'E2E 승인' });
  await expect(approvalHistoryRow).toBeVisible();
  await expect(approvalHistoryRow).toContainText('개발팀장');
  await expect(approvalHistoryRow).toContainText('승인');

  await page.getByLabel('알림함').click();
  await expect(page.getByText('최종 결재 완료').first()).toBeVisible();
  await expect(page.getByText(uniqueVendor).first()).toBeVisible();
});
