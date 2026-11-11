import { expect, test } from '@playwright/test';
import { site } from '../../src/content/site';
import { base, contextFor } from './routes';

test.use(contextFor('desktop'));

test('every plate keeps its words in the DOM, and the plates are lit', async ({ page }) => {
  await page.goto(`${base()}/lab/metal/?hook=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__site?.settle === 'function');
  await page.evaluate(async () => { await window.__site!.scrollTo('aged'); await window.__site!.settle(); });

  const texts = await page.locator('[data-plate-text]').allInnerTexts();
  const all = (await page.locator('[data-plate-text]').allTextContents()).join(' | ');
  expect(texts.length).toBeGreaterThanOrEqual(20);
  const s = site.lab.sample;
  expect(all).toContain(s.label);
  expect(all).toContain(s.big);
  expect(all).toContain(s.facts);
  expect(all).toContain(s.bar);
  expect(all).toContain(site.clients.items[0].what);
  expect(all).toContain(site.work.link);

  // The words are reachable by assistive technology: not display none, not aria-hidden.
  const hidden = await page.locator('[data-plate-text]').first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"]') !== null;
  });
  expect(hidden).toBe(false);

  // The plate on screen has drawn: its canvas is ready and not blank.
  const plate = page.locator('#aged [data-finish]');
  await expect(plate).toHaveAttribute('data-state', 'ready');
  const lit = await plate.locator('canvas').evaluate((c: HTMLCanvasElement) => {
    const g = c.getContext('2d')!;
    const d = g.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 8, 8).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    return sum / (d.length / 4) / 3;
  });
  expect(lit).toBeGreaterThan(30);
});
