import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { loadContent } from '../../src/lib/content.ts';

test.use({ colorScheme: 'dark' });
const data = loadContent();
const routes = ['/', '/resume/', ...data.work.filter((work) => work.visible && work.slug).map((work) => `/${work.slug}/`), '/404.html'];

test('dark mode follows the system and keeps all routes accessible', async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    await expect(page.getByRole('switch', { name: 'Dark mode' })).toBeChecked();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(32, 32, 30)');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations, route).toEqual([]);
  }
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/');
    const skill = page.locator('.skill-trigger').first();
    if (await skill.count()) await skill.click();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); });
    await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))));
    await page.screenshot({ path: `work/screenshots/home-dark-${width}.png`, fullPage: true });
  }
});

test('the toggle follows system changes until a manual choice, with keyboard and persistence support', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('switch', { name: 'Dark mode' });
  await expect(toggle).toBeChecked();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(toggle).not.toBeChecked();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto('/resume/');
  await expect(toggle).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('portfolio-theme'))).toBe('light');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(243, 242, 236)');
  await toggle.focus();
  await toggle.press('Space');
  await expect(toggle).toBeChecked();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(toggle).toBeChecked();
  await toggle.press('Enter');
  await expect(toggle).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('portfolio-theme'))).toBe('light');
});

test('dark preference works without JavaScript and printing remains white', async ({ browser, page }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark' });
  const fallback = await context.newPage();
  await fallback.goto('http://127.0.0.1:4322/');
  expect(await fallback.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(32, 32, 30)');
  await expect(fallback.getByRole('switch', { name: 'Dark mode' })).toHaveCount(0);
  await context.close();
  await page.goto('/resume/');
  expect(await page.locator('.resume-document').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 255, 255)');
  await page.emulateMedia({ media: 'print' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
  expect(await page.locator('.resume-document').evaluate((element) => getComputedStyle(element).color)).toBe('rgb(17, 17, 17)');
});

test('theme selection still works when browser storage is unavailable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    Storage.prototype.removeItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  });
  await page.goto('/');
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(32, 32, 30)');
  expect(errors).toEqual([]);
});
