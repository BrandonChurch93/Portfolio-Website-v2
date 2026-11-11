// The build: hashes the sources, runs next build, and writes out/.source-id with that hash.
// npm run build runs this. The harness and the gate compare the stamp with the sources on disk.
// The hash is taken before the build, so a source edited during the build leaves out/ stale, never wrongly fresh.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { OUT, STAMP, sourceId } from './shot-rules.mjs';

const id = sourceId();
if (fs.existsSync(STAMP)) fs.rmSync(STAMP);
const run = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { stdio: 'inherit' });
if (run.status !== 0) process.exit(run.status ?? 1);
if (!fs.existsSync(`${OUT}/index.html`)) { console.error('build: out/index.html is missing, the build did not write out/'); process.exit(1); }
fs.writeFileSync(STAMP, `${id}\n`);
console.log(`build: out/ is from sources ${id}`);
