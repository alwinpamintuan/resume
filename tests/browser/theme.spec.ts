import { test, expect } from '@playwright/test';

// Prevent a system theme being ignored or an explicit choice being lost/overridden.
test('system changes apply until a keyboard choice persists across routes and reload', async ({ page }) => {
  const background = () => page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/resume/');
  const toggle = page.getByRole('switch', { name: 'Dark mode' });
  await expect(toggle).not.toBeChecked();
  const light = await background();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(toggle).toBeChecked();
  await expect.poll(background).not.toBe(light);
  await toggle.press('Space');
  await expect(toggle).not.toBeChecked();
  await expect.poll(background).toBe(light);
  await toggle.press('Enter');
  await expect(toggle).toBeChecked();
  await toggle.press('Space');
  await expect(toggle).not.toBeChecked();
  await page.getByRole('link', { name: 'View résumé', exact: true }).click();
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await expect(toggle).not.toBeChecked();
  await expect.poll(background).toBe(light);
});

// Prevent returning visitors losing a preference stored before the shared theme key.
test('legacy preference migrates and remains after the legacy key is removed', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/resume/');
  await page.evaluate(() => localStorage.setItem('project-index:theme', 'light'));
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Dark mode' })).not.toBeChecked();
  await page.evaluate(() => localStorage.removeItem('project-index:theme'));
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Dark mode' })).not.toBeChecked();
});

// Prevent a script failure leaving the static résumé stuck in the wrong system theme.
test('system appearance still changes without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'light' });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4322/resume/');
    await expect(page.getByRole('switch')).toBeHidden();
    const light = await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(light);
  } finally { await context.close(); }
});
