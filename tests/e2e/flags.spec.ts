import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { contextFor } from './routes';

// Needs a flags build first: node scripts/build-flags.mjs SHOW_3D_ART=false (or SHOW_LAB=false, or both).
// It checks the page after it has loaded and hydrated in a browser, not only the HTML file. The build notes its
// switches in out-flags/flags.json, so each test runs only against the build it is about.
const flagsBase = () => {
  const b = process.env.SITE_FLAGS_BASE;
  if (!b) throw new Error('out-flags/ is missing. Run node scripts/build-flags.mjs SHOW_3D_ART=false first.');
  return b;
};
const flags = (): Record<string, boolean> => (fs.existsSync('out-flags/flags.json') ? JSON.parse(fs.readFileSync('out-flags/flags.json', 'utf8')) : {});

test.use(contextFor('desktop'));

test('the switches in the source file still say true', () => {
  const src = fs.readFileSync('src/config/site.ts', 'utf8');
  expect(src).toMatch(/export const SHOW_3D_ART = \(process\.env\.SITE_SHOW_3D_ART \?\? 'true'\)/);
  expect(src).toMatch(/export const SHOW_LAB = \(process\.env\.SITE_SHOW_LAB \?\? 'true'\)/);
});

test('with SHOW_3D_ART false there is no 3D art page, nav link or door, after hydration', async ({ page }) => {
  test.skip(flags().SHOW_3D_ART !== false, 'the flags build keeps 3D art');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
  expect(fs.readFileSync('out-flags/sitemap.xml', 'utf8')).not.toMatch(/3d-art/);
  const res = await page.goto(`${flagsBase()}/3d-art/`, { waitUntil: 'load' });
  expect(res?.status()).toBe(404);
  expect(errors).toEqual([]);
});

test('with SHOW_LAB false the build has no lab routes', async ({ page }) => {
  test.skip(flags().SHOW_LAB !== false, 'the flags build keeps the lab');
  expect(fs.existsSync('out-flags/lab')).toBe(false);
  for (const r of ['/lab/metal/', '/lab/water/', '/lab/piece/city/']) {
    const res = await page.goto(`${flagsBase()}${r}`, { waitUntil: 'load' });
    expect(res?.status(), r).toBe(404);
  }
  const res = await page.goto(`${flagsBase()}/`, { waitUntil: 'load' });
  expect(res?.status()).toBe(200);
});

test('the normal build still has the 3D art page, nav link and door, and the lab', async ({ page }) => {
  const b = process.env.SITE_BASE!;
  await page.goto(`${b}/?hook=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__site?.settle === 'function');
  await page.evaluate(() => window.__site!.settle());
  expect(await page.locator('nav a[href="/3d-art/"]').count()).toBe(1);
  expect(await page.locator('[data-door="art3d"]').count()).toBe(1);
  expect((await page.goto(`${b}/3d-art/`, { waitUntil: 'load' }))?.status()).toBe(200);
  expect((await page.goto(`${b}/lab/metal/`, { waitUntil: 'load' }))?.status()).toBe(200);
});
