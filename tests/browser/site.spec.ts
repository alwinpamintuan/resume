import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import JSZip from 'jszip';
import { loadContent } from '../../src/lib/content.ts';

const content = loadContent();
const routes = ['/', '/resume/', ...content.work.filter((w) => w.visible && w.slug).map((w) => `/${w.slug}/`), '/404.html'];

for (const route of routes) test(`route and accessibility: ${route}`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(route);
  await expect(page.locator('h1').first()).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]); expect(errors).toEqual([]);
});

test('local links, anchors, and assets resolve', async ({ page, request }) => {
  for (const route of routes) {
    await page.goto(route);
    const links = await page.locator('a[href]').evaluateAll((elements) => elements.map((element) => element.getAttribute('href')!));
    for (const link of links) {
      if (link.startsWith('#')) { expect(await page.locator(`[id="${link.slice(1)}"]`).count(), link).toBeGreaterThan(0); }
      else if (link.startsWith('/')) {
        const url = new URL(link, 'http://127.0.0.1:4322');
        expect((await request.get(url.pathname)).ok(), link).toBeTruthy();
        if (url.hash) { await page.goto(link); expect(await page.locator(`[id="${url.hash.slice(1)}"]`).count(), link).toBeGreaterThan(0); await page.goto(route); }
      }
    }
    const assets = await page.locator('img[src],link[rel="stylesheet"],script[src]').evaluateAll((elements) => elements.map((el) => el.getAttribute('src') ?? el.getAttribute('href')!));
    for (const asset of assets) expect((await request.get(asset)).ok(), asset).toBeTruthy();
  }
});

test('responsive layouts and screenshots', async ({ page }) => {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of routes.filter((route) => route !== '/404.html')) {
      await page.goto(route); await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}px`).toBeTruthy();
      await page.screenshot({ path: `work/screenshots/${route === '/' ? 'home' : route.replaceAll('/', '')}-${width}.png`, fullPage: true });
    }
  }
});

test('content remains visible without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage(); await page.goto('http://127.0.0.1:4322/');
  await expect(page.locator('#intro-title')).toHaveText(content.profile.name);
  await expect(page.getByRole('link', { name: 'Download résumé' })).toBeVisible();
  const showcase = content.work.find((work) => work.visible && work.slug);
  if (showcase) { await page.goto(`http://127.0.0.1:4322/${showcase.slug}/`); await expect(page.locator('h1')).toHaveText(showcase.title); }
  await context.close();
});

test('keyboard skip link and reduced motion', async ({ page }) => {
  await page.goto('/'); await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  expect(await page.locator('#intro-title').evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
});

test('long names and titles stay within narrow layouts', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto('/');
  await page.locator('.hero h1 span').last().evaluate((element) => { element.textContent = 'Averylongprofessionalsurnamethatmustwrap'; });
  await page.locator('.role-heading h4').first().evaluate((element) => { element.textContent = 'Senior Data Platform and Infrastructure Engineering Specialist'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const showcase = content.work.find((work) => work.visible && work.slug);
  if (showcase) {
    await page.goto(`/${showcase.slug}/`);
    await page.locator('h1').evaluate((element) => { element.textContent = 'A comprehensive schema inspection and comparison utility'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});

test('home printing uses conventional résumé', async ({ page }) => {
  await page.goto('/'); await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.hero')).toBeHidden();
  await expect(page.locator('.print-only .resume-document')).toBeVisible();
});

test('exports contain readable résumé text in order', async () => {
  for (const profile of content.exports.profiles) {
    const name = `${content.profile.documentName}${profile.id === content.exports.default ? '' : `-${profile.id}`}`;
    const loadingTask = getDocument({ data: new Uint8Array(readFileSync(`dist/downloads/${name}.pdf`)), useSystemFonts: true });
    const pdf = await loadingTask.promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) text += (await (await pdf.getPage(i)).getTextContent()).items.map((item) => 'str' in item ? item.str : '').join(' ');
    expect(text.includes('SAMPLE RESUME')).toBe(content.sample); expect(text).toContain(content.profile.name);
    expect(text.indexOf('Professional Experience')).toBeLessThan(text.indexOf('Technical Skills'));
    for (const work of content.work.filter((work) => work.placement === 'other')) expect(text).not.toContain(work.title);
    expect(pdf.numPages).toBeLessThanOrEqual(2);
    await loadingTask.destroy();
    const zip = await JSZip.loadAsync(readFileSync(`dist/downloads/${name}.docx`));
    const xml = await zip.file('word/document.xml')!.async('text');
    expect(xml.includes('SAMPLE RESUME')).toBe(content.sample); expect(xml).toContain('Professional Experience'); expect(xml).not.toContain('<w:tbl>');
  }
});
