// A test build with switches overridden, without editing src/config/site.ts.
//
//   node scripts/build-flags.mjs SHOW_3D_ART=false [SHOW_LAB=false]
//
// It copies the environment, sets SITE_FLAGS_BUILD=1 and SITE_<SWITCH> for each argument, and runs next build as a
// child process. The Next.js config sends that build to out-flags/, so out/ is left alone. Run one build at a time.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

const SWITCHES = ['SHOW_3D_ART', 'SHOW_LAB'];
const env = { ...process.env, SITE_FLAGS_BUILD: '1' };
const args = process.argv.slice(2);
if (args.length === 0) { console.error('usage: node scripts/build-flags.mjs SHOW_3D_ART=false [SHOW_LAB=false]'); process.exit(1); }
for (const a of args) {
  const m = /^([A-Z0-9_]+)=(true|false)$/.exec(a);
  if (!m || !SWITCHES.includes(m[1])) { console.error(`build-flags: ${a} is not one of ${SWITCHES.map((s) => `${s}=true|false`).join(', ')}`); process.exit(1); }
  env[`SITE_${m[1]}`] = m[2];
}
fs.rmSync('out-flags', { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
const run = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { stdio: 'inherit', env });
if (run.status !== 0) process.exit(run.status ?? 1);
if (!fs.existsSync('out-flags/index.html')) { console.error('build-flags: out-flags/index.html is missing'); process.exit(1); }
fs.writeFileSync('out-flags/flags.json', JSON.stringify(Object.fromEntries(args.map((x) => x.split('=')).map(([k, v]) => [k, v === 'true']))));
console.log(`build-flags: out-flags/ built with ${args.join(' ')}`);
