import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['node_modules', 'kit', 'old-site', 'incoming', 'out', 'out-flags', 'shots'],
    environment: 'node',
  },
});
