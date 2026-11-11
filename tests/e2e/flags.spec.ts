import { expect, test } from '@playwright/test';
import { contextFor } from './routes';

// Needs a flags build first: node scripts/build-flags.mjs SHOW_3D_ART=false
// It checks the page after it has loaded and hydrated in a browser, not only the HTML file.
const flagsBase = () => {
  const b = process.env.SITE_FLAGS_BASE;
  if (!b) throw new Error('out-flags/ is missing. Run node scripts/build-flags.mjs SHOW_3D_ART=false first.');
  return b;
};

test.use(contextFor('desktop'));

test('with SHOW_3D_ART false there is no 3D art page, nav link or door, after hydration', async ({ page }) => {
  await page.goto(`${flagsBase()}/?hook=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__site?.settle === 'function');
  await page.evaluate(() => window.__site!.settle());
  await page.waitForTimeout(500);
  expect(await page.locator('a[href="/3d-art/"]').count()).toBe(0);
  expect(await page.locator('[data-door="art3d"]').count()).toBe(0);
  expect(await page.locator('[data-door="games"]').count()).toBe(1);
  expect(await page.locator('[data-door="photography"]').count()).toBe(1);
  const nav = await page.locator('nav').first().innerText();
  expect(nav).not.toMatch(/3D art/);
  const res = await page.goto(`${flagsBase()}/3d-art/`, { waitUntil: 'load' });
  expect(res?.status()).toBe(404);
});

test('the normal build still has the 3D art page, nav link and door', async ({ page }) => {
  const b = process.env.SITE_BASE!;
  await page.goto(`${b}/?hook=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__site?.settle === 'function');
  await page.evaluate(() => window.__site!.settle());
  expect(await page.locator('nav a[href="/3d-art/"]').count()).toBe(1);
  expect(await page.locator('[data-door="art3d"]').count()).toBe(1);
  const res = await page.goto(`${b}/3d-art/`, { waitUntil: 'load' });
  expect(res?.status()).toBe(200);
});
