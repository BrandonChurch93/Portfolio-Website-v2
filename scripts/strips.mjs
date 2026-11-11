// Filmstrips: motion shown as frames side by side, with the time under each frame.
//
//   node scripts/strips.mjs <name or prefix> [...more]
//     Takes every strip in scripts/shot-list.mjs whose name starts with a word. With no word it takes every strip.
//
// A strip is a shot with strip: { times: [...], frame: [[hook, ...args]], cols }.
// The page opens like a still (route, viewport, steps), then for each time the frame steps run with "$t" replaced
// by that time (default [['freeze', '$t']]), the harness waits for settle(), and takes a frame.
// Frames are tiled left to right, top to bottom, and the strip is saved as shots/<name>.jpg through the same
// "same image" check and manifest as a still, so it goes through the verdict ledger and the gate.
import fs from 'node:fs';
import process from 'node:process';
import { buildIfStale, grab, hook, keep, openBrowser, openSite, parseArgs, startPreview, substitute } from './shots.mjs';
import { buildId, fileOf, readManifest, writeManifest } from './shot-rules.mjs';
import { SHOTS } from './shot-list.mjs';

async function tile(browser, frames, times, cols, tileWidth) {
  const cells = frames.map((buf, i) => `<figure><img src="data:image/jpeg;base64,${buf.toString('base64')}"><figcaption>${times[i].toFixed(2)} s</figcaption></figure>`).join('');
  const html = `<!doctype html><html><head><style>
    html, body { margin: 0; background: #141110; color: #d8cfc4; font: 500 15px ui-monospace, Menlo, monospace; }
    main { display: grid; grid-template-columns: repeat(${cols}, ${tileWidth}px); gap: 8px; padding: 8px; width: max-content; }
    figure { margin: 0; } img { display: block; width: ${tileWidth}px; height: auto; }
    figcaption { padding: 5px 2px 2px; text-align: center; }
  </style></head><body><main>${cells}</main></body></html>`;
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  try {
    await page.setContent(html, { waitUntil: 'load' });
    const main = await page.$('main');
    return await main.screenshot({ type: 'jpeg', quality: 90 });
  } finally {
    await page.close();
  }
}

async function main() {
  const { flags, names } = parseArgs(process.argv.slice(2));
  const wanted = Object.keys(SHOTS).filter((n) => SHOTS[n].strip && (names.length === 0 || names.some((q) => n.startsWith(q))));
  if (wanted.length === 0) { console.error('no strips match. Add them to scripts/shot-list.mjs with a strip field.'); process.exit(1); }
  buildIfStale();
  const build = buildId();
  const manifest = readManifest();
  const { browser } = await openBrowser(flags);
  const preview = await startPreview();
  const errors = [];
  try {
    for (const name of wanted) {
      const shot = SHOTS[name];
      const { times, frame = [['freeze', '$t']], cols = Math.min(4, times.length), tileWidth } = shot.strip;
      const page = await openSite(browser, preview, shot, errors, `${name}: `);
      const frames = [];
      for (const t of times) {
        for (const [method, ...args] of frame) await hook(page, method, substitute(args, t));
        await page.evaluate(() => window.__site.settle());
        frames.push(await grab(page, shot));
      }
      const vpWidth = (shot.clip && shot.clip.width) || page.viewportSize()?.width || 1440;
      await page.close();
      const width = tileWidth || Math.min(640, vpWidth);
      const strip = await tile(browser, frames, times, cols, width);
      const sha = await keep(browser, strip, fileOf(name, SHOTS), flags.force);
      manifest[name] = { sha, build };
      writeManifest(manifest);
    }
  } finally {
    await preview.stop();
    await browser.close();
  }
  if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
  if (!fs.existsSync('shots')) process.exit(1);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
