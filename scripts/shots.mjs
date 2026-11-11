// Screenshot harness.
//
//   node scripts/shots.mjs <name or prefix> [...more]
//     Named shots from scripts/shot-list.mjs. A word selects every shot whose name starts with it:
//     "metal" is the whole group, "metal/aged" is three shots. With no word it takes every still.
//     Strips are skipped here and taken by scripts/strips.mjs. Never use * in a name. The shell would expand it.
//     Builds first when out/ was not built from the sources on disk now, so a shot never shows an old build.
//     Site shots open the page with ?hook=1, run their steps through window.__site, wait for settle() and capture.
//     ref shots serve kit/reference/ and wait for window.__ready.
//
//   node scripts/shots.mjs --url <url> --out <file> [--vp desktop]
//     One shot of any page that sets window.__ready = true. Not recorded in the manifest.
//
//   Options: --headed forces a visible window. --force writes every image even when it matches the one on disk.
//
// Each shot prints its path and the first 12 characters of its sha1. scripts/verdict.mjs records verdicts against it.
// A retake that matches the image on disk prints "same" and leaves the file alone, so its verdicts keep counting.
// Every named shot is noted in shots/manifest.json with the source id of the build it came from.
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { NO_BUILD_GROUPS, VIEWPORTS, buildId, distIsStale, fileOf, groupOf, readManifest, sha12, writeManifest } from './shot-rules.mjs';
import { SHOTS } from './shot-list.mjs';
import { startServer } from './serve.mjs';

const SOFTWARE = /swiftshader|llvmpipe|software/i;

function buildIfStale() {
  if (!distIsStale()) return;
  console.log('build: out/ is missing or was built from other sources, building');
  const run = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
  if (run.status !== 0) throw new Error('build failed');
}

function parseArgs(argv) {
  const flags = {}; const names = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--headed') flags.headed = true;
    else if (a === '--force') flags.force = true;
    else if (a.startsWith('--')) { flags[a.slice(2)] = argv[i + 1]; i++; }
    else names.push(a);
  }
  return { flags, names };
}

function launchOptions({ headed }) {
  const args = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--autoplay-policy=no-user-gesture-required'];
  if (process.platform === 'darwin') args.push('--enable-gpu', '--use-angle=metal');
  return { channel: 'chromium', headless: !headed, args };
}

async function rendererOf(page) {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  });
}

async function openBrowser(flags = {}) {
  let headed = Boolean(flags.headed);
  let browser = await chromium.launch(launchOptions({ headed }));
  let probe = await browser.newPage();
  await probe.goto('about:blank');
  let renderer = await rendererOf(probe);
  await probe.close();
  if (!headed && (renderer === 'none' || SOFTWARE.test(renderer))) {
    const headless = renderer;
    await browser.close();
    try {
      headed = true;
      browser = await chromium.launch(launchOptions({ headed }));
      probe = await browser.newPage();
      await probe.goto('about:blank');
      renderer = await rendererOf(probe);
      await probe.close();
    } catch {
      headed = false;
      browser = await chromium.launch(launchOptions({ headed }));
      renderer = headless;
    }
  }
  const hardware = renderer !== 'none' && !SOFTWARE.test(renderer);
  console.log(`renderer: ${renderer} · ${hardware ? 'hardware' : 'software'} · ${headed ? 'headed' : 'headless'}`);
  return { browser, renderer, hardware };
}

async function startPreview() {
  return startServer('out');
}

// Two captures count as the same image when no channel of any pixel differs by more than 16 levels
// and at most one sample in a thousand differs by more than 6. That absorbs encoder and driver noise only.
function sameImage(page, a, b) {
  return page.evaluate(async ([x, y]) => {
    const pixels = async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const g = canvas.getContext('2d');
      g.drawImage(bitmap, 0, 0);
      return g.getImageData(0, 0, bitmap.width, bitmap.height);
    };
    const [p, q] = [await pixels(x), await pixels(y)];
    if (p.width !== q.width || p.height !== q.height) return false;
    let soft = 0;
    for (let i = 0; i < p.data.length; i++) {
      const d = Math.abs(p.data[i] - q.data[i]);
      if (d > 16) return false;
      if (d > 6) soft++;
    }
    return soft <= p.data.length * 0.001;
  }, [a.toString('base64'), b.toString('base64')]);
}

// Writes the image unless it matches the one on disk. Returns the hash of the image on disk after.
async function keep(browser, fresh, out, force) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (!force && fs.existsSync(out)) {
    const old = fs.readFileSync(out);
    let same = old.equals(fresh);
    if (!same) {
      const bench = await browser.newPage();
      try { same = await sameImage(bench, old, fresh); } catch { same = false; }
      await bench.close();
    }
    if (same) { console.log(`same: ${out} · ${sha12(old)}`); return sha12(old); }
  }
  fs.writeFileSync(out, fresh);
  console.log(`shot: ${out} · ${sha12(fresh)}`);
  return sha12(fresh);
}

async function grab(page, shot) {
  const opts = { type: 'jpeg', quality: 90, timeout: 180000, animations: 'allow', caret: 'hide' };
  if (shot.clip) opts.clip = shot.clip;
  if (shot.fullPage) opts.fullPage = true;
  return page.screenshot(opts);
}

async function capture(browser, page, out, force, shot = {}) {
  return keep(browser, await grab(page, shot), out, force);
}

function watch(page, errors, label = '') {
  page.on('pageerror', (e) => errors.push(`${label}page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label}console error: ${m.text()}`); });
}

function viewportOf(shot) {
  const vp = VIEWPORTS[shot.vp || 'desktop'];
  if (!vp) throw new Error(`unknown viewport ${shot.vp}`);
  return {
    viewport: { width: shot.width || vp.width, height: shot.height || vp.height },
    deviceScaleFactor: shot.scale || vp.scale,
    hasTouch: shot.touch ?? vp.touch,
    isMobile: Boolean(shot.touch ?? vp.touch) && (shot.vp === 'phone' || shot.vp === 'tablet'),
  };
}

const substitute = (args, t) => args.map((a) => (a === '$t' ? t : a));

async function hook(page, method, args) {
  return page.evaluate(async ([m, a]) => {
    const parts = m.split('.');
    let owner = window.__site;
    for (let i = 0; i < parts.length - 1; i++) owner = owner[parts[i]];
    const fn = owner[parts[parts.length - 1]];
    if (typeof fn !== 'function') throw new Error(`window.__site.${m} is not a hook`);
    return await fn.apply(owner, a);
  }, [method, args]);
}

async function openSite(browser, preview, shot, errors, label) {
  const page = await browser.newPage(viewportOf(shot));
  watch(page, errors, label);
  const route = shot.route || '/';
  const sep = route.includes('?') ? '&' : '?';
  await page.goto(`http://127.0.0.1:${preview.port}${route}${sep}hook=1${shot.query ? `&${shot.query}` : ''}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__site && typeof window.__site.settle === "function"', null, { timeout: 300000 });
  for (const [method, ...args] of shot.steps || []) await hook(page, method, args);
  await page.evaluate(() => window.__site.settle());
  return page;
}

async function openRef(browser, refServer, shot, errors, label) {
  const page = await browser.newPage(viewportOf(shot));
  watch(page, errors, label);
  await page.goto(`http://127.0.0.1:${refServer.port}/${shot.ref}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 300000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(shot.wait ?? 1500);
  return page;
}

async function main() {
  const { flags, names } = parseArgs(process.argv.slice(2));
  const { browser } = await openBrowser(flags);
  const errors = [];
  let preview = null; let refServer = null;
  try {
    if (flags.url) {
      const page = await browser.newPage(viewportOf({ vp: flags.vp || 'desktop' }));
      watch(page, errors);
      await page.goto(flags.url, { waitUntil: 'load' });
      await page.waitForFunction('window.__ready === true', null, { timeout: 300000 });
      await capture(browser, page, flags.out || 'shots/setup/url.jpg', flags.force);
      await page.close();
    } else {
      const wanted = Object.keys(SHOTS).filter((n) => !SHOTS[n].strip && (names.length === 0 || names.some((q) => n.startsWith(q))));
      if (wanted.length === 0) throw new Error('no stills match. Strips are taken with npm run strips. Add stills to scripts/shot-list.mjs.');
      const needSite = wanted.some((n) => !SHOTS[n].ref);
      if (needSite) buildIfStale();
      const build = buildId();
      const manifest = readManifest();
      if (needSite) preview = await startPreview();
      if (wanted.some((n) => SHOTS[n].ref)) refServer = await startServer('kit/reference');
      for (const name of wanted) {
        const shot = SHOTS[name];
        const page = shot.ref ? await openRef(browser, refServer, shot, errors, `${name}: `) : await openSite(browser, preview, shot, errors, `${name}: `);
        const sha = await capture(browser, page, fileOf(name, SHOTS), flags.force, shot);
        manifest[name] = { sha, build: NO_BUILD_GROUPS.includes(groupOf(name)) ? 'reference' : build };
        writeManifest(manifest);
        await page.close();
      }
    }
  } finally {
    if (preview) await preview.stop();
    if (refServer) await refServer.stop();
    await browser.close();
  }
  if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
}

// Other scripts import these and reuse the same browser, server and capture logic.
export { buildIfStale, capture, grab, hook, keep, openBrowser, openSite, parseArgs, startPreview, substitute, viewportOf, watch };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
