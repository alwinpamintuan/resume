import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { serveDist } from '../../scripts/server.ts';

let server: Awaited<ReturnType<typeof serveDist>>;
test.beforeAll(async () => { server = await serveDist(0, 'work/fixture-site'); });
test.afterAll(async () => { await server.close(); });

// Prevent credentials losing their readable information or native verification links.
test('fixture credentials remain readable and linked on screen and in the document', async ({ page }) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(server.url + '/');
    const section = page.locator('#certifications');
    await expect(section).toContainText('Example Data Engineering Certification');
    await expect(section).toContainText('Example Certification Board');
    await expect(section).toContainText('Issued Jun 2026 · Expires Jun 2028');
    await expect(section.getByRole('link')).toHaveAttribute('href', 'https://example.com/credentials/data-engineering');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(audit.violations).toEqual([]);
  }
  await page.goto(server.url + '/resume/');
  await expect(page.getByRole('article').getByRole('link', { name: 'Example Data Engineering Certification' })).toHaveAttribute('href', 'https://example.com/credentials/data-engineering');
});

// Prevent evidence controls showing the wrong examples, duplicate entries, or losing focus.
test('skills show relevant evidence, switch panels, and restore keyboard focus', async ({ page }) => {
  await page.goto(server.url + '/');
  const airflow = page.getByRole('button', { name: 'Airflow', exact: true });
  const panel = page.getByLabel('Evidence for Airflow', { exact: true });
  await expect(panel).toBeHidden();
  await airflow.click();
  await expect(airflow).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('link')).toHaveText(['Northstar Analytics ↗', 'Reliable by design ↗']);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  await panel.getByRole('link').first().focus();
  await page.keyboard.press('Escape');
  await expect(airflow).toBeFocused();
  await expect(panel).toBeHidden();
  await airflow.press('Enter');
  const sql = page.getByRole('button', { name: 'SQL', exact: true });
  await sql.click();
  await expect(panel).toBeHidden();
  const sqlPanel = page.getByLabel('Evidence for SQL', { exact: true });
  await expect(sqlPanel).toContainText('Less compute. Same answers.');
  await sqlPanel.getByRole('button', { name: 'Close' }).click();
  await expect(sql).toBeFocused();
  await expect(sqlPanel).toBeHidden();
  // Mixed-case/repeated tags in the real fixture must not duplicate achievement evidence.
  await page.getByRole('button', { name: 'Python', exact: true }).click();
  await expect(page.getByLabel('Evidence for Python', { exact: true }).getByRole('link', { name: 'Northstar Analytics', exact: false })).toHaveCount(1);
});

// Prevent evidence links landing on missing content or behind a sticky header.
test('mobile evidence reaches achievements and real showcase pages', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(server.url + '/');
  await page.getByRole('button', { name: 'Airflow', exact: true }).click();
  const panel = page.getByLabel('Evidence for Airflow', { exact: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await panel.getByRole('link').first().click();
  await expect(page.locator('#ingestion-recovery')).toBeInViewport();
  await expect(page.locator('#ingestion-recovery')).toBeFocused();
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Airflow', exact: true }).click();
  await panel.getByRole('link').last().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reliable by design');
  await page.getByLabel('Page sections', { exact: true }).click();
  await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Problem', exact: true }).click();
  await expect(page).toHaveURL(/#problem$/);
  const header = (await page.getByRole('banner').boundingBox())!;
  expect((await page.locator('#problem').boundingBox())!.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  await page.getByRole('link', { name: 'Back to top', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('contentinfo')).toBeHidden();
});

// Prevent optional showcase/evidence content requiring a JavaScript runtime.
test('native evidence disclosure and showcase links work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(server.url + '/');
    await expect(page.getByRole('button', { name: 'Airflow', exact: true })).toHaveCount(0);
    const details = page.getByLabel('Evidence for Airflow', { exact: true });
    await details.locator('summary').click();
    await details.getByRole('link', { name: 'Reliable by design', exact: false }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reliable by design');
  } finally { await context.close(); }
});
