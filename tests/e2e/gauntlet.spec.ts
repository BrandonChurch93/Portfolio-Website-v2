import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import { NOT_FOUND, ROUTE_LIST, VIEWPORT_LIST, base, contextFor } from './routes';

// Checks from kit/09-QA-GAUNTLET.md that need a real page: A5, A6, D5, E2, E9, F2.
const PAGES = ROUTE_LIST.filter((r) => !r.startsWith('/lab/'));

async function hooked(page: Page) {
  await page.waitForFunction(() => !!window.__site);
  await page.evaluate(() => window.__site!.settle());
}

async function toFoot(page: Page) {
  await page.evaluate(async () => {
    const step = innerHeight * 0.8;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 400));
  });
}

test.describe('A5 · no request leaves the site', () => {
  test.use(contextFor('desktop'));
  for (const route of ROUTE_LIST) {
    test(`${route}: every request stays on the site's own origin`, async ({ page }) => {
      const origin = new URL(base()).origin;
      const away: string[] = [];
      page.on('request', (r) => {
        const u = r.url();
        if (u.startsWith('data:') || u.startsWith('blob:')) return;
        if (new URL(u).origin !== origin) away.push(u);
      });
      await page.goto(`${base()}${route}`, { waitUntil: 'load' });
      await toFoot(page);
      expect(away).toEqual([]);
    });
  }
});

for (const [vp] of VIEWPORT_LIST) {
  test.describe(`A6 · no console error or warning · ${vp}`, () => {
    test.use(contextFor(vp));
    for (const route of ROUTE_LIST) {
      test(`${route} at ${vp}, top to foot`, async ({ page }) => {
        const said: string[] = [];
        page.on('pageerror', (e) => said.push(`page error: ${e.message}`));
        page.on('console', (m: ConsoleMessage) => {
          if (m.type() !== 'error' && m.type() !== 'warning') return;
          if (route === NOT_FOUND && /status of 404/.test(m.text())) return;
          said.push(`${m.type()}: ${m.text()}`);
        });
        await page.goto(`${base()}${route}`, { waitUntil: 'load' });
        await toFoot(page);
        expect(said).toEqual([]);
      });
    }
  });
}

// The water's route, as the page built it, against every line of visible text on the page.
for (const [vp] of VIEWPORT_LIST) {
  test.describe(`D5 · the water crosses no text · ${vp}`, () => {
    test.use(contextFor(vp));
    for (const route of PAGES) {
      test(`${route} at ${vp}`, async ({ page }) => {
        await page.goto(`${base()}${route}?hook=1`, { waitUntil: 'load' });
        await hooked(page);
        await page.evaluate(() => window.__site!.scrollFrac(1));
        const r = await page.evaluate(() => {
          const path = window.__site!.water.path();
          const boxes: { left: number; top: number; right: number; bottom: number; text: string }[] = [];
          const hidden = (el: Element) => {
            for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
              const cs = getComputedStyle(e);
              if (e.classList.contains('visually-hidden') || cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || e.getAttribute('aria-hidden') === 'true') return true;
              if (e.tagName === 'A' && (e as HTMLAnchorElement).getAttribute('href') === '#main') return true;
            }
            return false;
          };
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const words = n.textContent?.trim();
            const el = n.parentElement;
            if (!words || !el || el.closest('script, style') || hidden(el)) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const b of range.getClientRects()) {
              if (b.width < 3 || b.height < 5) continue;
              boxes.push({ left: b.left + scrollX, top: b.top + scrollY, right: b.right + scrollX, bottom: b.bottom + scrollY, text: words.slice(0, 40) });
            }
          }
          const hits: string[] = [];
          for (const branch of path) for (const p of branch) for (const b of boxes) {
            if (p.x + p.hw > b.left && p.x - p.hw < b.right && p.y > b.top && p.y < b.bottom) hits.push(`${Math.round(p.x)},${Math.round(p.y)} over "${b.text}"`);
          }
          return { samples: path.reduce((n, b) => n + b.length, 0), boxes: boxes.length, hits: [...new Set(hits)].slice(0, 12) };
        });
        expect(r.samples).toBeGreaterThan(20);
        expect(r.boxes).toBeGreaterThan(3);
        expect(r.hits).toEqual([]);
      });
    }
  });
}

test.describe('E2 · a stub piece in place of a real one', () => {
  test.use(contextFor('desktop'));
  test('/games/ works with the handheld swapped for the contract stub', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base()}/games/?hook=1&stub=handheld`, { waitUntil: 'load' });
    await hooked(page);
    await expect(page.locator('[data-piece="handheld"] canvas[data-stub="1"]')).toHaveCount(1);
    await page.locator('[data-piece="handheld"] button').click();
    await expect(page.locator('[data-piece="handheld"] button')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => { window.__site!.lamp(0.3, 0.4); window.__site!.piece('handheld').setProgress(0.5); });
    await toFoot(page);
    const facts = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent ?? '', water: window.__site!.water.path().length }));
    expect(facts.h1.length).toBeGreaterThan(1);
    expect(facts.water).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});

test.describe('E9 · at most two pieces hold a WebGL context, the doors counting as one', () => {
  for (const vp of ['desktop', 'phone'] as const) {
    test(`scrolling the home page down and back up at ${vp}`, async ({ browser }) => {
      const ctx = await browser.newContext(contextFor(vp));
      const p = await ctx.newPage();
      await p.goto(`${base()}/`, { waitUntil: 'load' });
      const counts = await p.evaluate(async () => {
        const seen: number[] = [];
        let doors = 0;
        // A piece with its canvas, and the doors' shared renderer while it is live: kit 06 counts it as one piece.
        const count = () => [...document.querySelectorAll('[data-piece]')].filter((h) => h.querySelector('canvas')).length + document.querySelectorAll('[data-doors][data-live="1"]').length;
        const max = document.documentElement.scrollHeight - innerHeight;
        const ys = [...Array(41).keys()].map((i) => (max * i) / 40);
        for (const y of [...ys, ...ys.reverse()]) {
          scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 250));
          seen.push(count());
          doors = Math.max(doors, document.querySelectorAll('[data-doors][data-live="1"]').length);
        }
        return { seen, doors };
      });
      await ctx.close();
      expect(Math.max(...counts.seen)).toBeLessThanOrEqual(2);
      expect(Math.max(...counts.seen)).toBeGreaterThanOrEqual(1);
      expect(counts.doors).toBe(1);
    });
  }
});

test.describe('F2 · no sideways scroll from 320 to 3840 wide', () => {
  const widths = [320, 360, 390, 430, 600, 768, 834, 1024, 1280, 1440, 1680, 1920, 2560, 3200, 3840];
  for (const route of PAGES) {
    test(`${route} at ${widths.length} widths`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.goto(`${base()}${route}`, { waitUntil: 'load' });
      const wide: string[] = [];
      for (const w of widths) {
        await page.setViewportSize({ width: w, height: Math.round(Math.max(640, w * 0.6)) });
        await page.waitForTimeout(150);
        const s = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth }));
        if (s.s > s.i) wide.push(`${w}: ${s.s}`);
      }
      await ctx.close();
      expect(wide).toEqual([]);
    });
  }
});
