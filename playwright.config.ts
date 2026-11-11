import { defineConfig } from '@playwright/test';

// Pages are tested from the static export in out/, served by scripts/serve.mjs on a free port from 5321 to 5329
// (tests/e2e/global-setup.ts). Run npm run build first; the setup refuses a stale out/.
export default defineConfig({
  testDir: 'tests/e2e',
  testIgnore: ['**/kit/**', '**/old-site/**', '**/out/**', '**/shots/**'],
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  workers: 4,
  timeout: 120000,
  reporter: [['list']],
  use: {
    launchOptions: { args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal'] },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' }, grep: /@smoke/ },
    { name: 'firefox', use: { browserName: 'firefox' }, grep: /@smoke/ },
  ],
});
