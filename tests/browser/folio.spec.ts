import { test, expect } from '@playwright/test';
import { sitePath } from '../../src/lib/urls.ts';

async function openSections(page: import('@playwright/test').Page) {
  if (!await page.locator('.header-nav').isVisible()) await page.locator('.page-menu > summary').click();
}

test('one header contains identity and current-page navigation', async ({ page }) => {
  await page.goto(sitePath());
  await expect(page.locator('.site-home')).toHaveText('John Alwin Pamintuan');
  await expect(page.locator('.site-home')).toHaveAttribute('href', 'https://alwinpamintuan.github.io/');
  await expect(page.locator('.hero')).not.toContainText('John Alwin Pamintuan');
  await expect(page.locator('#intro-title')).toHaveText('Engineering dependable data.');
  await expect(page.locator('.section-nav, .social-links, .contact-end')).toHaveCount(0);
  const headings = await page.locator('.portfolio-section h2').allTextContents();
  expect(await page.locator('.header-nav a').allTextContents()).toEqual(headings.map((heading) => heading === 'Technical Skills' ? 'Skills' : heading));
  for (const link of await page.locator('.header-nav a').all()) {
    await openSections(page);
    const href = await link.getAttribute('href');
    await link.click();
    await expect(page.locator(href!)).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Explore projects' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download résumé' })).toBeVisible();
});

test('one-row header and reading content fit a 200 percent desktop layout viewport', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 450 });
  await page.goto(sitePath());
  await page.locator('.hero h1 span').evaluate((element) => { element.textContent = 'AnExtremelyLongUnbrokenProfessionalHeadlineThatMustWrap'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect((await page.locator('.site-header').boundingBox())!.height).toBeLessThan(100);
  await expect(page.locator('.site-home')).toBeVisible();
});

test('single sticky header tracks sections and offers an accessible compact menu', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(sitePath());
    const header = page.locator('.site-header');
    const navigation = page.locator('.header-nav');
    const menu = page.locator('.page-menu');
    await openSections(page);
    await navigation.getByRole('link', { name: 'Skills', exact: true }).click();
    await expect(navigation.locator('[aria-current="location"]')).toHaveAttribute('href', '#expertise');
    const primary = await header.boundingBox();
    expect(Math.abs(primary!.y)).toBeLessThan(1);
    expect(primary!.height).toBeLessThan(100);
    expect((await page.locator('#expertise').boundingBox())!.y).toBeGreaterThanOrEqual(primary!.height);
    if (width < 1001) await expect(menu).not.toHaveAttribute('open');
    await openSections(page);
    await navigation.getByRole('link', { name: 'Certifications', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(navigation.locator('[aria-current="location"]')).toHaveAttribute('href', '#certifications');
    await page.screenshot({ path: 'work/screenshots/navigation-' + width + '.png' });
    await page.locator('#experience').evaluate((element) => element.scrollIntoView());
    await expect(navigation.locator('[aria-current="location"]')).toHaveAttribute('href', '#experience');
    if (width < 1001) {
      await openSections(page);
      await page.keyboard.press('Escape');
      await expect(menu).not.toHaveAttribute('open');
      await expect(menu.locator('summary')).toBeFocused();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});

test('native page menu and section links work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 960 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322' + sitePath());
  await page.locator('.page-menu > summary').click();
  await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Skills', exact: true }).click();
  await page.locator('.page-menu > summary').click();
  const header = await page.locator('.site-header').boundingBox();
  expect(Math.abs(header!.y)).toBeLessThan(1);
  expect((await page.locator('#expertise').boundingBox())!.y).toBeGreaterThanOrEqual(header!.height);
  await context.close();
});


test('pointer menu motion reverses and reduced motion settles immediately', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 960 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(sitePath());
  const menu = page.locator('.page-menu');
  const summary = menu.locator('summary');
  await summary.dispatchEvent('click', { detail: 1 });
  await summary.dispatchEvent('click', { detail: 1 });
  await summary.dispatchEvent('click', { detail: 1 });
  await expect(menu).toHaveAttribute('open', '');
  await expect(menu).not.toHaveAttribute('data-motion-state');
  await expect(page.getByRole('navigation', { name: 'On this page' })).toBeVisible();
  await summary.dispatchEvent('click', { detail: 1 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(menu).not.toHaveAttribute('open');
  await expect(menu).not.toHaveAttribute('data-motion-state');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('open', '');
  await expect(menu).not.toHaveAttribute('data-motion-state');
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open');
});


test('clamped section jumps keep the requested header item selected', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(sitePath());
  const navigation = page.locator('.header-nav');
  await navigation.getByRole('link', { name: 'Certifications', exact: true }).click();
  await expect(navigation.locator('[aria-current="location"]')).toHaveAttribute('href', '#certifications');
  await navigation.getByRole('link', { name: 'Education', exact: true }).click();
  await expect(navigation.locator('[aria-current="location"]')).toHaveAttribute('href', '#education');
  await page.mouse.wheel(0, -1400);
  await expect(navigation.locator('[aria-current="location"][href="#education"]')).toHaveCount(0);
});


test('natural scrolling selects Certifications across viewport heights', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const height of [960, 1400]) {
    await page.setViewportSize({ width: 1440, height });
    await page.goto(sitePath());
    await page.locator('#certifications').evaluate((element) => element.scrollIntoView());
    await expect(page.locator('.header-nav [aria-current="location"]')).toHaveAttribute('href', '#certifications');
  }
});


test('credential actions align within each desktop and tablet row', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(sitePath());
    await page.locator('.certification h3').first().evaluate((element) => { element.textContent = 'A deliberately much longer certification title that wraps across several lines'; });
    const links = page.locator('.certification .text-link');
    for (let index = 0; index + 1 < await links.count(); index += 2) {
      const first = (await links.nth(index).boundingBox())!;
      const second = (await links.nth(index + 1).boundingBox())!;
      expect(Math.abs(first.y - second.y)).toBeLessThan(1);
    }
  }
  const bridge = page.getByRole('link', { name: 'Explore projects', exact: true });
  await expect(bridge).toContainText('Data is my day job.');
  expect((await bridge.boundingBox())!.width).toBeGreaterThan(900);
  expect((await bridge.locator('.bridge-action').boundingBox())!.height).toBeGreaterThanOrEqual(48);
});
