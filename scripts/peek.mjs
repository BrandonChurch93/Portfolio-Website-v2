// A look at any page while working on it. Not a named shot and not in the ledger.
//
//   node scripts/peek.mjs <route> <viewport> <out.jpg> [--full] [--steps <file.json>] [--eval <file.js>]
//
// Builds first when out/ is stale, opens the page with ?hook=1, runs optional hook steps from a JSON file
// ([["freeze", 2], ["lamp", 0.5, 0.4]]), waits for settle() and captures. --full captures the whole page.
// Console errors are printed. --eval prints the JSON result of evaluating the file's contents in the page.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { buildIfStale, grab, openBrowser, openSite, startPreview } from './shots.mjs';

const args = process.argv.slice(2);
const flag = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : null);
const [route, vp, out] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--steps', '--eval'].includes(args[i - 1])));
if (!route || !vp || !out) { console.error('usage: node scripts/peek.mjs <route> <viewport> <out.jpg> [--full] [--steps file.json] [--eval file.js]'); process.exit(1); }
const steps = flag('--steps') ? JSON.parse(fs.readFileSync(flag('--steps'), 'utf8')) : [];
buildIfStale();
const { browser } = await openBrowser({});
const preview = await startPreview();
const errors = [];
try {
  const page = await openSite(browser, preview, { route, vp, steps }, errors, '');
  if (flag('--eval')) console.log(JSON.stringify(await page.evaluate(fs.readFileSync(flag('--eval'), 'utf8')), null, 1));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, await grab(page, { fullPage: args.includes('--full') }));
  console.log(`peek: ${out}`);
  await page.close();
} finally {
  await preview.stop();
  await browser.close();
}
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
