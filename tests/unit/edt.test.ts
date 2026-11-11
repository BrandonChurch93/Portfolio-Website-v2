import { describe, expect, it } from 'vitest';
import { signedDistance } from '../../src/metal/edt';

describe('signedDistance', () => {
  it('gives the exact distance outside and inside a filled square', () => {
    const w = 40;
    const h = 40;
    const cov = new Float32Array(w * h);
    for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) cov[y * w + x] = 1;
    const d = signedDistance(cov, w, h);
    // A pixel five columns left of the square's edge, on a row in the middle.
    expect(d[20 * w + 4]).toBeGreaterThan(5);
    expect(d[20 * w + 4]).toBeLessThan(6.6);
    // The center of the square is about ten pixels inside.
    expect(d[20 * w + 20]).toBeLessThan(-9);
    // Across the edge the sign flips.
    expect(Math.sign(d[20 * w + 9])).toBe(1);
    expect(Math.sign(d[20 * w + 10])).toBe(-1);
  });

  it('measures diagonal distance by Euclid, not by steps', () => {
    const w = 30;
    const h = 30;
    const cov = new Float32Array(w * h);
    cov[15 * w + 15] = 1;
    const d = signedDistance(cov, w, h);
    expect(d[18 * w + 19]).toBeCloseTo(Math.hypot(3, 4), 6);
  });

  it('puts a half covered edge pixel right on the edge', () => {
    const w = 20;
    const h = 5;
    const cov = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < 10; x++) cov[y * w + x] = 1;
      cov[y * w + 10] = 0.5;
    }
    const d = signedDistance(cov, w, h);
    expect(Math.abs(d[2 * w + 10])).toBeLessThan(0.05);
  });

  it('reads 0 to 255 coverage', () => {
    const cov = new Uint8ClampedArray(9);
    cov[4] = 255;
    const d = signedDistance(cov, 3, 3, 255);
    expect(d[4]).toBeLessThan(0);
    expect(d[0]).toBeGreaterThan(0);
  });
});
