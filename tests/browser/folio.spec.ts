import { test, expect, type Page } from '@playwright/test';

async function openSections(page: Page) {
  if (!await page.getByRole('navigation', { name: 'On this page' }).isVisible()) await page.getByLabel('Page sections', { exact: true }).click();
}

// Prevent navigation hiding its target behind the header or leaving keyboard focus trapped.
for (const width of [375, 1440]) test(`section navigation reaches readable targets at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 960 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/resume/');
  const navigation = page.getByRole('navigation', { name: 'On this page', includeHidden: true });
  for (const name of ['Skills', 'Certifications', 'Education']) {
    await openSections(page);
    const link = navigation.getByRole('link', { name, exact: true });
    const href = await link.getAttribute('href');
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(navigation.locator('[aria-current="location"]')).toHaveAttribute('href', href!);
    const header = (await page.getByRole('banner').boundingBox())!;
    await expect.poll(async () => (await page.locator(href!).boundingBox())!.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    if (width === 375) await expect(navigation).toBeHidden();
  }
  if (width === 375) {
    await openSections(page);
    await page.keyboard.press('Escape');
    await expect(navigation).toBeHidden();
    await expect(page.getByLabel('Page sections', { exact: true })).toBeFocused();
  }
});

// Prevent short sections near the page end being assigned to the wrong navigation item.
for (const height of [960, 1400]) test(`active section follows scrolling and clamped jumps at ${height}px height`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/resume/');
  const navigation = page.getByRole('navigation', { name: 'On this page' });
  await navigation.getByRole('link', { name: 'Certifications', exact: true }).click();
  await expect(navigation.locator('[aria-current="location"]')).toHaveAttribute('href', '#certifications');
  await navigation.getByRole('link', { name: 'Education', exact: true }).click();
  await expect(navigation.locator('[aria-current="location"]')).toHaveAttribute('href', '#education');
  await page.mouse.wheel(0, -2000);
  await expect(navigation.locator('[aria-current="location"][href="#education"]')).toHaveCount(0);
  // Reach Certifications through real scrolling rather than changing page DOM/state.
  await page.goto('/resume/');
  const target = (await page.locator('#certifications').boundingBox())!;
  const header = (await page.getByRole('banner').boundingBox())!;
  await page.mouse.wheel(0, target.y - header.y - header.height - 24);
  await expect(navigation.locator('[aria-current="location"]')).toHaveAttribute('href', '#certifications');
});

// Prevent rapid pointer input or a reduced-motion change leaving the menu unusable.
test('compact menu remains operable after rapid toggles and a motion preference change', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 960 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/resume/');
  const summary = page.getByLabel('Page sections', { exact: true });
  const box = (await summary.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount: 3, delay: 30 });
  const navigation = page.getByRole('navigation', { name: 'On this page' });
  await expect(navigation).toBeVisible();
  await summary.click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(navigation).toBeHidden();
  await summary.press('Enter');
  await navigation.getByRole('link', { name: 'Skills', exact: true }).click();
  await expect(page).toHaveURL(/#expertise$/);
  await expect(navigation).toBeHidden();
});

// Prevent native mobile section navigation depending on JavaScript.
test('compact section menu works without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 960 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4322/resume/');
    await page.getByLabel('Page sections', { exact: true }).click();
    await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Skills', exact: true }).click();
    await page.getByLabel('Page sections', { exact: true }).click();
    await expect(page).toHaveURL(/#expertise$/);
    const header = (await page.getByRole('banner').boundingBox())!;
    expect((await page.locator('#expertise').boundingBox())!.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  } finally { await context.close(); }
});
