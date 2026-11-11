import { expect, test } from '@playwright/test';
import { base, contextFor } from './routes';

test.use(contextFor('desktop'));

test('without ?hook=1 nothing is exposed', async ({ page }) => {
  await page.goto(`${base()}/`, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => typeof window.__site)).toBe('undefined');
});

test('the hooks freeze the clock, set the lamp and scroll to a section', async ({ page }) => {
  await page.goto(`${base()}/?hook=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__site?.settle === 'function');
  await page.evaluate(() => window.__site!.settle());

  // The clock runs, then holds at exactly the frozen time, then runs again from there.
  const t0 = await page.evaluate(() => window.__site!.info().time);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__site!.info().time)).toBeGreaterThan(t0);
  await page.evaluate(() => window.__site!.freeze(2.5));
  await page.waitForTimeout(400);
  let info = await page.evaluate(() => window.__site!.info());
  expect(info.frozen).toBe(true);
  expect(info.time).toBe(2.5);
  await page.evaluate(() => window.__site!.freeze(null));
  await page.waitForTimeout(250);
  info = await page.evaluate(() => window.__site!.info());
  expect(info.frozen).toBe(false);
  expect(info.time).toBeGreaterThan(2.5);

  // The lamp goes exactly where it is put.
  await page.evaluate(() => window.__site!.lamp(0.2, 0.75));
  await page.waitForTimeout(200);
  info = await page.evaluate(() => window.__site!.info());
  expect(info.lamp.x).toBeCloseTo(0.2, 6);
  expect(info.lamp.y).toBeCloseTo(0.75, 6);

  // A section jump lands with the section at the top, without smooth scrolling.
  await page.evaluate(() => window.__site!.scrollTo('clients'));
  const top = await page.evaluate(() => Math.round(document.getElementById('clients')!.getBoundingClientRect().top));
  expect(Math.abs(top)).toBeLessThanOrEqual(1);
  const y = await page.evaluate(() => window.__site!.info().scrollY);
  expect(y).toBeGreaterThan(500);

  // A forced tier is reported and marked on the page.
  await page.evaluate(() => window.__site!.tier('low'));
  expect(await page.evaluate(() => [window.__site!.info().tier, document.documentElement.dataset.tier])).toEqual(['low', 'low']);
});

test('a frozen page gives the same picture twice', async ({ page }) => {
  await page.goto(`${base()}/?hook=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__site?.settle === 'function');
  await page.evaluate(async () => { window.__site!.freeze(1); window.__site!.lamp(0.5, 0.4); await window.__site!.settle(); });
  const a = await page.screenshot();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__site!.settle());
  const b = await page.screenshot();
  expect(a.equals(b)).toBe(true);
});
