import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { ROUTE_LIST, base, contextFor } from './routes';

// Gauntlet G3: text reads at 4.5 to 1 against what is really behind it, including the water's glow and any 3D piece.
// With the water fully wet and the clock frozen, each screen of the page is shot twice in effect: the text boxes are
// measured, the text is made transparent, and the pixels behind every line are read. The background is the 98th
// percentile of luminance inside the line's box, so one stray spark does not decide it but any real glow does.
const PAGES = ROUTE_LIST.filter((r) => !r.startsWith('/lab/'));
const lum = (r: number, g: number, b: number) => {
  const f = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function screens(page: Page, scale: number) {
  const out: { text: string; ratio: number; y: number }[] = [];
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = await page.evaluate(() => innerHeight);
  for (let y = 0; y < height; y += Math.round(vh * 0.9)) {
    await page.evaluate((top) => window.__site!.scrollTo(top), y);
    await page.evaluate(() => { window.__site!.water.head(1); return window.__site!.settle(); });
    const boxes = await page.evaluate(() => {
      const list: { x: number; y: number; w: number; h: number; rgb: number[]; text: string }[] = [];
      const skip = (el: Element) => {
        for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (e.classList.contains('visually-hidden') || cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.5) return true;
          if (e.tagName === 'A' && e.getAttribute('href') === '#main') return true;
        }
        return false;
      };
      const fixedIn = (el: Element) => { for (let e: Element | null = el; e; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; };
      // Lines under the fixed nav are hidden by it, not read through it.
      const navBottom = Math.max(0, ...[...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().top <= 0 && e.getBoundingClientRect().height < innerHeight / 3).map((e) => e.getBoundingClientRect().bottom));
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const words = n.textContent?.trim();
        const el = n.parentElement;
        if (!words || !el || el.closest('script, style') || skip(el) || fixedIn(el)) continue;
        const c = getComputedStyle(el).color.match(/[\d.]+/g)!.map(Number);
        if ((c[3] ?? 1) < 0.5) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const b of range.getClientRects()) {
          if (b.width < 3 || b.height < 5 || b.top < navBottom || b.top > innerHeight || b.right < 0 || b.left > innerWidth) continue;
          list.push({ x: Math.max(0, b.left), y: Math.max(0, b.top), w: Math.min(innerWidth, b.right) - Math.max(0, b.left), h: Math.min(innerHeight, b.bottom) - Math.max(0, b.top), rgb: c.slice(0, 3), text: words.slice(0, 40) });
        }
      }
      const style = document.createElement('style');
      style.id = 'g3-hide';
      style.textContent = '* { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; }';
      document.head.append(style);
      return list;
    });
    const shot = await page.screenshot({ type: 'png' });
    await page.evaluate(() => document.getElementById('g3-hide')?.remove());
    const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    for (const b of boxes) {
      const ls: number[] = [];
      const x0 = Math.floor(b.x * scale), y0 = Math.floor(b.y * scale), x1 = Math.min(info.width, Math.ceil((b.x + b.w) * scale)), y1 = Math.min(info.height, Math.ceil((b.y + b.h) * scale));
      for (let py = y0; py < y1; py += 1) for (let px = x0; px < x1; px += 2) {
        const i = (py * info.width + px) * info.channels;
        ls.push(lum(data[i], data[i + 1], data[i + 2]));
      }
      if (!ls.length) continue;
      ls.sort((p, q) => p - q);
      const bg = ls[Math.floor(ls.length * 0.98)];
      out.push({ text: b.text, ratio: ratio(lum(b.rgb[0], b.rgb[1], b.rgb[2]), bg), y });
    }
  }
  return out;
}

for (const vp of ['desktop', 'phone'] as const) {
  test.describe(`G3 · contrast against what is behind the text · ${vp}`, () => {
    test.use(contextFor(vp));
    for (const route of PAGES) {
      test(`${route} at ${vp}`, async ({ page }) => {
        await page.goto(`${base()}${route}?hook=1`, { waitUntil: 'load' });
        await page.waitForFunction(() => !!window.__site);
        await page.evaluate(() => { window.__site!.freeze(4); window.__site!.lamp(0.5, 0.45); return window.__site!.settle(); });
        const res = await screens(page, contextFor(vp).deviceScaleFactor);
        const low = res.filter((r) => r.ratio < 4.5).map((r) => `${r.ratio.toFixed(2)} "${r.text}" (screen at ${r.y})`);
        expect(res.length).toBeGreaterThan(3);
        expect([...new Set(low)]).toEqual([]);
        test.info().annotations.push({ type: 'lowest', description: Math.min(...res.map((r) => r.ratio)).toFixed(2) });
      });
    }
  });
}
