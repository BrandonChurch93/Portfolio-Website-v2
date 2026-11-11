// Records a short video of this site with Playwright, for photo windows that need moving pictures when no project
// video exists (kit/05-CONTENT.md, Pictures and video).
//
//   node scripts/record-site.mjs
//
// Films the lamp sweeping across a plate on /lab/metal for six seconds, then converts the recording with ffmpeg to
// public/media/site-recording.mp4 (H.264, no audio, fast start). Writes nothing else under public/.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { buildIfStale, openBrowser, startPreview } from './shots.mjs';

const OUT = 'public/media/site-recording.mp4';
const TMP = 'shots/record';
// Sized so the plate nearly fills the frame: in a photo window the recording should be mostly metal, not page.
const SIZE = { width: 760, height: 470 };

if (spawnSync('which', ['ffmpeg']).status !== 0) { console.error('record-site: ffmpeg is not installed'); process.exit(1); }
buildIfStale();
fs.rmSync(TMP, { recursive: true, force: true });
const { browser } = await openBrowser({});
const preview = await startPreview();
let raw = '';
try {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, recordVideo: { dir: TMP, size: SIZE } });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${preview.port}/lab/metal/?hook=1`, { waitUntil: 'load' });
  await page.waitForFunction('window.__site && typeof window.__site.settle === "function"');
  // Only the plate and the lamp: the nav would show cut off inside a photo window.
  await page.addStyleTag({ content: 'header { display: none !important; }' });
  await page.evaluate(async () => { await window.__site.scrollTo('aged'); window.__site.lamp(0.15, 0.3); await window.__site.settle(); });
  const start = Date.now();
  while (Date.now() - start < 6500) {
    const k = (Date.now() - start) / 6500;
    const x = 0.15 + 0.7 * (0.5 - 0.5 * Math.cos(k * Math.PI));
    const y = 0.3 + 0.25 * Math.sin(k * Math.PI);
    await page.evaluate(([a, b]) => window.__site.lamp(a, b), [x, y]);
    await page.waitForTimeout(16);
  }
  raw = await page.video().path();
  await context.close();
} finally {
  await preview.stop();
  await browser.close();
}
const run = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.4', '-i', raw, '-t', '6', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
if (run.status !== 0) { console.error('record-site: ffmpeg failed'); process.exit(1); }
console.log(`record-site: ${OUT} · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB from ${path.basename(raw)}`);
