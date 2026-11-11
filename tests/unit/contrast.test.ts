import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

// Every text colour the site uses on its page background reads at 4.5 to 1 or better (kit 06), measured from the
// tokens themselves so a change to a token cannot slip under it.
const css = fs.readFileSync('src/styles/tokens.css', 'utf8');
const token = (name: string) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`no token --${name}`);
  return m[1];
};
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

describe('text contrast on the page', () => {
  const bg = token('bg');
  for (const name of ['text', 'text-2', 'text-3', 'accent', 'amber']) {
    it(`--${name} on --bg reads at 4.5 to 1 or better`, () => {
      expect(ratio(token(name), bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
