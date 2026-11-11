import { expect, test, type ConsoleMessage } from '@playwright/test';
import { NOT_FOUND, ROUTE_LIST, VIEWPORT_LIST, base, contextFor } from './routes';

// Every route at every viewport: it loads, its words are readable, nothing logs an error, nothing scrolls sideways.
for (const [vp] of VIEWPORT_LIST) {
  test.describe(`smoke @smoke ${vp}`, () => {
    test.use(contextFor(vp));
    for (const route of ROUTE_LIST) {
      test(`${route} at ${vp}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
        page.on('console', (m: ConsoleMessage) => {
          if (m.type() !== 'error') return;
          if (route === NOT_FOUND && /status of 404/.test(m.text())) return;
          errors.push(`console error: ${m.text()}`);
        });
        const res = await page.goto(`${base()}${route}`, { waitUntil: 'load' });
        expect(res?.status()).toBe(route === NOT_FOUND ? 404 : 200);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(150);

        const h1 = page.locator('h1').first();
        await expect(h1).toBeVisible();
        const facts = await page.evaluate(() => {
          const h = document.querySelector('h1')!.getBoundingClientRect();
          const main = document.querySelector('main');
          const body = getComputedStyle(document.body);
          return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            h1Left: h.left,
            h1Right: h.right,
            mainText: (main?.innerText ?? '').trim().length,
            bodyFont: parseFloat(body.fontSize),
            fontsLoaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
          };
        });
        expect(facts.scrollWidth, 'horizontal scroll').toBeLessThanOrEqual(facts.innerWidth);
        expect(facts.h1Left).toBeGreaterThanOrEqual(0);
        expect(facts.h1Right).toBeLessThanOrEqual(facts.innerWidth);
        // Lab pages are bare test benches with a one word title; content pages must carry real words.
        expect(facts.mainText).toBeGreaterThan(route.startsWith('/lab/') ? 3 : 20);
        expect(facts.bodyFont).toBeGreaterThanOrEqual(16);
        expect(facts.fontsLoaded.some((f) => /Sora/.test(f))).toBe(true);
        expect(errors).toEqual([]);
      });
    }
  });
}
