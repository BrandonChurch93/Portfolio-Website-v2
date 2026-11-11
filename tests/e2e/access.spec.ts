import { expect, test } from '@playwright/test';
import { NOT_FOUND, ROUTE_LIST, base, contextFor } from './routes';

// Access (kit 06): a skip link, every link and switch reachable by keyboard with a visible amber focus ring, headings
// in order, alt text on every picture, touch targets of at least 44 px, reduced motion honoured, no sideways scroll
// down to 320 px wide.
const PAGES = ROUTE_LIST.filter((r) => !r.startsWith('/lab/'));

test.describe('access · keyboard', () => {
  test.use(contextFor('desktop'));

  test('the first Tab reaches a skip link that moves focus to the content', async ({ page }) => {
    await page.goto(`${base()}/`, { waitUntil: 'load' });
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => { const a = document.activeElement as HTMLAnchorElement; return { tag: a.tagName, href: a.getAttribute('href'), text: a.textContent }; });
    expect(first.tag).toBe('A');
    expect(first.href).toBe('#main');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('every focus stop on the home page shows an amber ring and nothing is skipped', async ({ page }) => {
    await page.goto(`${base()}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const focusable = await page.evaluate(() => [...document.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])')].filter((e) => (e as HTMLElement).offsetParent !== null || getComputedStyle(e).position === 'fixed').length);
    const seen = new Set<string>();
    for (let i = 0; i < focusable + 5; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement | null;
        if (!e || e === document.body) return null;
        const cs = getComputedStyle(e);
        return { key: `${e.tagName}:${e.getAttribute('href') ?? ''}:${e.textContent?.trim().slice(0, 30)}`, outline: cs.outlineStyle, color: cs.outlineColor, width: parseFloat(cs.outlineWidth) };
      });
      if (!f) continue;
      seen.add(f.key);
      expect(f.outline, `focus ring on ${f.key}`).not.toBe('none');
      expect(f.width, `focus ring width on ${f.key}`).toBeGreaterThanOrEqual(2);
      expect(f.color, `focus ring colour on ${f.key}`).toBe('rgb(255, 157, 60)');
    }
    expect(seen.size).toBeGreaterThanOrEqual(Math.min(focusable, 20));
  });
});

test.describe('access · structure', () => {
  test.use(contextFor('desktop'));
  for (const route of PAGES) {
    test(`${route}: one h1, headings in order, every picture has alt text`, async ({ page }) => {
      await page.goto(`${base()}${route}`, { waitUntil: 'load' });
      const r = await page.evaluate(() => {
        const hs = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter((h) => !(h as HTMLElement).closest('[aria-hidden="true"]'));
        const levels = hs.map((h) => Number(h.tagName[1]));
        const jumps = levels.map((l, i) => (i && l > levels[i - 1] + 1 ? `${levels[i - 1]} to ${l}: ${hs[i].textContent?.trim()}` : null)).filter(Boolean);
        const imgs = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).map((i) => i.src);
        return { h1: levels.filter((l) => l === 1).length, first: levels[0], jumps, imgs };
      });
      expect(r.h1).toBe(1);
      expect(r.first).toBe(1);
      expect(r.jumps).toEqual([]);
      expect(r.imgs).toEqual([]);
    });
  }
});

test.describe('access · touch targets on a phone', () => {
  test.use(contextFor('phone'));
  for (const route of PAGES) {
    test(`${route}: links and buttons are at least 44 px`, async ({ page }) => {
      await page.goto(`${base()}${route}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const small = await page.evaluate(() => [...document.querySelectorAll('a[href], button')]
        .filter((e) => (e as HTMLElement).offsetParent !== null && !e.closest('p, li p'))
        .map((e) => { const b = e.getBoundingClientRect(); return { what: `${e.tagName} ${e.textContent?.trim().slice(0, 30)}`, w: Math.round(b.width), h: Math.round(b.height) }; })
        .filter((b) => b.w > 0 && (b.w < 44 || b.h < 44)));
      expect(small).toEqual([]);
    });
  }
});

test.describe('access · reduced motion', () => {
  test.use({ ...contextFor('desktop'), reducedMotion: 'reduce' });
  test('the opening is skipped, the headline shows at once and the site takes the static tier', async ({ page }) => {
    await page.goto(`${base()}/`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => ({ opening: document.documentElement.dataset.opening ?? '', tier: document.documentElement.dataset.tier ?? '', words: getComputedStyle(document.querySelector('#hero-title')!.parentElement!).opacity }));
    expect(r.opening).not.toBe('play');
    expect(r.tier).toBe('static');
    expect(Number(r.words)).toBeGreaterThan(0.99);
  });
});

test.describe('access · 320 px wide', () => {
  test.use({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, hasTouch: true });
  for (const route of [...PAGES.filter((r) => r !== NOT_FOUND), NOT_FOUND]) {
    test(`${route}: nothing scrolls sideways`, async ({ page }) => {
      await page.goto(`${base()}${route}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const w = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, i: window.innerWidth }));
      expect(w.s).toBeLessThanOrEqual(w.i);
    });
  }
});

test.describe('access · no layout shift', () => {
  test.use(contextFor('desktop'));
  for (const route of ['/', '/work/', '/about/', '/resume/', '/games/']) {
    test(`${route}: the layout does not move after first paint`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'layout shift entries are a Chromium API');
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => { for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(`${base()}${route}`, { waitUntil: 'load' });
      await page.waitForTimeout(2500);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      expect(cls).toBeLessThan(0.02);
    });
  }
});
