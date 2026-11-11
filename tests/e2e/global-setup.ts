import fs from 'node:fs';
// @ts-expect-error: a plain .mjs module with no types
import { startServer } from '../../scripts/serve.mjs';
// @ts-expect-error: a plain .mjs module with no types
import { distIsStale } from '../../scripts/shot-rules.mjs';

// Serves out/ (and out-flags/ when it exists) for the tests. Workers inherit the addresses through the environment.
export default async function globalSetup() {
  if (distIsStale()) throw new Error('out/ was not built from the sources on disk now. Run npm run build first.');
  const site = await startServer('out');
  process.env.SITE_BASE = `http://127.0.0.1:${site.port}`;
  let flags: { stop: () => Promise<void> } | null = null;
  if (fs.existsSync('out-flags/index.html')) {
    flags = await startServer('out-flags');
    process.env.SITE_FLAGS_BASE = `http://127.0.0.1:${(flags as unknown as { port: number }).port}`;
  }
  return async () => {
    await site.stop();
    if (flags) await flags.stop();
  };
}
