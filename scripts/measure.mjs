// Measures frame time on a page while the lamp moves every frame, so everything lit must redraw.
//
//   node scripts/measure.mjs <route> <viewport> [--steps file.json] [--seconds 4] [--tier high] [--headed]
//
// Prints the renderer string, the frame interval (median, 95th percentile, worst) from requestAnimationFrame,
// and the site's own per frame stats from window.__site.info().stats (for example metalMs, the plate renderer's
// CPU time a frame). Frame time is only meaningful on a hardware renderer; the line says which it was.
import fs from 'node:fs';
import process from 'node:process';
import { buildIfStale, openBrowser, openSite, startPreview } from './shots.mjs';

const args = process.argv.slice(2);
const flag = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const [route, vp] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--headed'));
if (!route || !vp) { console.error('usage: node scripts/measure.mjs <route> <viewport> [--steps file.json] [--seconds 4] [--tier high]'); process.exit(1); }
const steps = flag('--steps') ? JSON.parse(fs.readFileSync(flag('--steps'), 'utf8')) : [];
if (flag('--tier')) steps.push(['tier', flag('--tier')]);
const seconds = Number(flag('--seconds', 4));
buildIfStale();
const { browser, renderer, hardware } = await openBrowser({ headed: args.includes('--headed') });
const preview = await startPreview();
const errors = [];
try {
  const page = await openSite(browser, preview, { route, vp, steps }, errors, '');
  const result = await page.evaluate(async (secs) => {
    const intervals = [];
    const metal = [];
    let last = performance.now();
    const end = last + secs * 1000;
    await new Promise((resolve) => {
      const tick = (now) => {
        intervals.push(now - last);
        last = now;
        const k = (now % 4000) / 4000;
        window.__site.lamp(0.15 + 0.7 * k, 0.3 + 0.3 * Math.sin(k * Math.PI * 2));
        const s = window.__site.info().stats;
        if (typeof s.metalMs === 'number') metal.push(s.metalMs);
        if (now < end) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))] ?? 0; };
    return {
      frames: intervals.length,
      median: q(intervals.slice(5), 0.5), p95: q(intervals.slice(5), 0.95), worst: Math.max(...intervals.slice(5)),
      metalMedian: q(metal, 0.5), metalP95: q(metal, 0.95),
      info: window.__site.info(),
    };
  }, seconds);
  const r = (n) => n.toFixed(2);
  console.log(`measure: ${route} at ${vp} · renderer ${renderer} (${hardware ? 'hardware' : 'software'}) · tier ${result.info.tier} · plates ${result.info.stats.plates ?? 0}`);
  console.log(`measure: frames ${result.frames} · frame interval median ${r(result.median)} ms · p95 ${r(result.p95)} ms · worst ${r(result.worst)} ms`);
  console.log(`measure: plate renderer CPU a frame median ${r(result.metalMedian)} ms · p95 ${r(result.metalP95)} ms`);
  await page.close();
} finally {
  await preview.stop();
  await browser.close();
}
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
