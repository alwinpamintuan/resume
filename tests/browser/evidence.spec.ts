import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { serveDist } from '../../scripts/server.ts';

let server: Awaited<ReturnType<typeof serveDist>>;
test.beforeAll(async () => { server = await serveDist(0, 'work/fixture-site'); });
test.afterAll(async () => { await server.close(); });

test('certifications follow skills and render credentials across desktop, mobile, and print', async ({ page }) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(server.url);
    const section = page.locator('#certifications');
    await section.scrollIntoViewIfNeeded();
    await expect(section).toContainText('Example Data Engineering Certification');
    await expect(section).toContainText('Issued Jun 2026 · Expires Jun 2028');
    await expect(section.getByRole('link', { name: 'View credential for Example Data Engineering Certification' })).toHaveAttribute('href', 'https://example.com/credentials/data-engineering');
    expect(await page.locator('#expertise + #certifications').count()).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({ path: `work/screenshots/certifications-${width}.png`, fullPage: true });
  }
  await page.goto(`${server.url}/resume/`);
  const headings = await page.locator('.document-section h2').allTextContents();
  expect(headings[headings.indexOf('Technical Skills') + 1]).toBe('Certifications');
  await expect(page.locator('.resume-document').getByRole('link', { name: 'Example Data Engineering Certification' })).toHaveAttribute('href', 'https://example.com/credentials/data-engineering');
  await expect(page.locator('.resume-document')).not.toContainText('https://example.com/credentials/data-engineering');
});

test('skills reveal evidence, switch previews, and restore keyboard focus', async ({ page }) => {
  await page.goto(server.url);
  const airflow = page.getByRole('button', { name: 'Airflow', exact: true });
  const visiblePanel = page.locator('.skill-evidence:not([hidden])');
  await expect(visiblePanel).toHaveCount(0);
  await airflow.click();
  await expect(airflow).toHaveAttribute('aria-expanded', 'true');
  await expect(visiblePanel).toHaveCount(1);
  await expect(visiblePanel).toContainText('Northstar Analytics');
  await expect(visiblePanel).toContainText('Reliable by design');
  await expect(visiblePanel.locator('li')).toHaveCount(2);
  await expect(visiblePanel.locator('a').first()).toHaveAttribute('href', '/#ingestion-recovery');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  await visiblePanel.locator('a').first().focus();
  await page.keyboard.press('Escape');
  await expect(airflow).toBeFocused();
  await expect(visiblePanel).toHaveCount(0);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'SQL', exact: true }).click();
  await expect(airflow).toHaveAttribute('aria-expanded', 'false');
  await expect(visiblePanel).toHaveCount(1);
  await expect(visiblePanel).toContainText('Less compute. Same answers.');
  await page.getByRole('button', { name: 'Close', exact: false }).click();
  await expect(page.getByRole('button', { name: 'SQL', exact: true })).toBeFocused();
  await expect(visiblePanel).toHaveCount(0);
});

test('evidence works on mobile and resolves achievement and project destinations', async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto(server.url);
  await page.getByRole('button', { name: 'Airflow', exact: true }).click();
  const panel = page.locator('.skill-evidence:not([hidden])');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  for (const href of await panel.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')!))) {
    expect((await request.get(new URL(href, server.url).href)).ok()).toBeTruthy();
  }
  await panel.locator('a').first().click();
  await expect(page.locator('#ingestion-recovery')).toBeInViewport();
  await expect(page.locator('#ingestion-recovery')).toBeFocused();
  await expect(panel).toHaveCount(0);
  await page.getByRole('button', { name: 'Airflow', exact: true }).click();
  await page.locator('.skill-evidence:not([hidden]) a').last().click();
  await expect(page.locator('h1')).toHaveText('Reliable by design');
});

test('evidence has a usable fallback without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(server.url);
  await expect(page.getByRole('button', { name: 'Airflow', exact: true })).toHaveCount(0);
  const details = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Used in: Airflow' }) });
  await details.locator('summary').click();
  await expect(details.getByText('Reliable by design', { exact: false })).toBeVisible();
  await context.close();
});
