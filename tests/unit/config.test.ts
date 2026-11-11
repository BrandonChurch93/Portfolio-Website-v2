import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLORS, PORTS, VIEWPORTS, WINDOW_ASPECT } from '../../src/config/site';
import { approach, driftAt } from '../../src/lamp/drift';

const tokens = fs.readFileSync('src/styles/tokens.css', 'utf8');
const token = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(tokens)?.[1].trim();

describe('one value, one place', () => {
  it('keeps the JS colors equal to the CSS tokens', () => {
    expect(token('bg')).toBe(COLORS.bg);
    expect(token('amber')).toBe(COLORS.amber);
    expect(token('accent')).toBe(COLORS.accent);
    expect(token('text')).toBe(COLORS.text);
  });

  it('keeps the window shapes equal to the CSS tokens', () => {
    const ratio = (s: string | undefined) => { const [a, b] = (s ?? '').split('/').map(Number); return a / b; };
    expect(ratio(token('window-plate'))).toBeCloseTo(WINDOW_ASPECT.plate, 6);
    expect(ratio(token('window-project'))).toBeCloseTo(WINDOW_ASPECT.project, 6);
    expect(ratio(token('window-portrait'))).toBeCloseTo(WINDOW_ASPECT.portrait, 6);
  });

  it('keeps the shot viewports in the gate equal to the site config', async () => {
    // @ts-expect-error: a plain .mjs module with no types
    const rules = await import('../../scripts/shot-rules.mjs');
    expect(rules.VIEWPORTS).toEqual(VIEWPORTS);
  });

  it('uses the kit ports', () => {
    expect(PORTS).toEqual({ dev: 5320, staticFirst: 5321, staticLast: 5329 });
  });

  it('uses no pure black or white token', () => {
    expect(/#(000000|ffffff|000|fff)\b/i.test(tokens)).toBe(false);
  });
});

describe('the lamp drift', () => {
  it('is the same at the same time', () => {
    expect(driftAt(3.2, null, 0)).toEqual(driftAt(3.2, null, 0));
  });

  it('stays inside the viewport', () => {
    for (let t = 0; t < 200; t += 0.37) {
      const p = driftAt(t, null, 0);
      expect(p.x).toBeGreaterThan(0.05);
      expect(p.x).toBeLessThan(0.95);
      expect(p.y).toBeGreaterThan(0.05);
      expect(p.y).toBeLessThan(0.95);
    }
  });

  it('leans toward a fresh touch and lets go of an old one', () => {
    const free = driftAt(5, null, 0);
    const fresh = driftAt(5, { x: 0.9, y: 0.9 }, 0);
    const old = driftAt(5, { x: 0.9, y: 0.9 }, 100);
    expect(fresh.x).toBeGreaterThan(free.x);
    expect(old).toEqual(free);
  });

  it('eases the same amount whatever the frame rate', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = approach(a, 1, 9, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = approach(b, 1, 9, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
  });
});
