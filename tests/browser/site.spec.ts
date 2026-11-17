import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { content, routes } from '../support/content.ts';

// Prevent broken deployed routes, assets, anchors, and local downloads.
test('published pages and their local destinations resolve without script errors', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const route of routes) {
    expect((await page.goto(route))?.ok(), route).toBeTruthy();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const destinations = await page.locator('a[href],img[src],link[rel="stylesheet"],script[src]').evaluateAll((elements) => elements.map((element) => element.getAttribute('src') ?? element.getAttribute('href')!));
    for (const destination of new Set(destinations)) {
      const url = new URL(destination, page.url());
      if (url.origin !== new URL(page.url()).origin) continue;
      if (url.pathname !== route || !url.hash) expect((await request.get(url.pathname)).ok(), destination).toBeTruthy();
      if (url.hash) {
        await page.goto(url.pathname + url.hash);
        await expect(page.locator(`[id="${decodeURIComponent(url.hash.slice(1))}"]`), destination).toHaveCount(1);
        await page.goto(route);
      }
    }
  }
  await page.goto('/resume/');
  await expect(page.getByRole('link', { name: 'Explore projects', exact: true })).toHaveAttribute('href', 'https://alwinpamintuan.github.io/');
  await expect(page.getByRole('link', { name: content.profile.name, exact: true })).toHaveAttribute('href', 'https://alwinpamintuan.github.io/');
  for (const link of content.profile.links) await expect(page.getByRole('link', { name: link.label, exact: true })).toHaveAttribute('href', link.url);
  for (const credential of content.certifications) if (credential.credentialUrl) {
    await expect(page.getByRole('link', { name: `View credential for ${credential.name}` })).toHaveAttribute('href', credential.credentialUrl);
  }
  expect(errors).toEqual([]);
});

// Prevent inaccessible or horizontally clipped real content on supported pages.
for (const colorScheme of ['light', 'dark'] as const) test(`published pages remain accessible and reflow in ${colorScheme} mode`, async ({ page }) => {
  await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
  for (const route of routes) {
    for (const [width, height] of [[375, 960], [768, 960], [1440, 960], [640, 450]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}px`).toBeTruthy();
      // Audit both mobile and desktop markup; intermediate widths still check reflow.
      if (width === 375 || width === 1440) {
        const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(audit.violations, route).toEqual([]);
      }
    }
  }
});

// Prevent résumé content/downloads disappearing when JavaScript cannot run.
test('career details and downloads remain available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4322/resume/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(content.profile.summary);
    for (const job of content.experience) await expect(page.getByRole('main')).toContainText(job.company);
    await expect(page.getByRole('link', { name: 'Download résumé' })).toBeVisible();
    await page.getByRole('link', { name: 'View résumé', exact: true }).click();
    await expect(page.getByRole('article')).toContainText(content.profile.name);
  } finally { await context.close(); }
});

// Prevent keyboard visitors being trapped in the header and printouts losing career content.
test('skip link enters the content and printing exposes a conventional résumé', async ({ page }) => {
  await page.goto('/resume/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Download résumé' })).toBeFocused();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.hero')).toBeHidden();
  await expect(page.getByRole('contentinfo')).toBeHidden();
  const document = page.getByRole('article');
  await expect(document).toBeVisible();
  await expect(document).toContainText(content.profile.name);
  for (const job of content.experience) await expect(document).toContainText(job.company);
});
