import { describe, expect, it } from 'vitest';
import { TIER_PROBE } from '../../src/config/site';
import { chooseTier, pixelRatioFor, type TierInputs } from '../../src/world/tier-choice';

const desk: TierInputs = { reducedMotion: false, webgl: true, probeMs: 2, memoryGb: 16, width: 1440, height: 900, dpr: 2 };

describe('chooseTier', () => {
  it('is static when reduced motion is asked for, whatever the GPU', () => {
    expect(chooseTier({ ...desk, reducedMotion: true })).toBe('static');
  });

  it('is static with no WebGL', () => {
    expect(chooseTier({ ...desk, webgl: false, probeMs: null })).toBe('static');
  });

  it('follows the GPU timing test', () => {
    expect(chooseTier({ ...desk, probeMs: TIER_PROBE.highMs })).toBe('high');
    expect(chooseTier({ ...desk, probeMs: TIER_PROBE.highMs + 0.01 })).toBe('mid');
    expect(chooseTier({ ...desk, probeMs: TIER_PROBE.midMs })).toBe('mid');
    expect(chooseTier({ ...desk, probeMs: TIER_PROBE.midMs + 0.01 })).toBe('low');
  });

  it('takes mid when the timing test could not run', () => {
    expect(chooseTier({ ...desk, probeMs: null })).toBe('mid');
  });

  it('drops one tier on low memory', () => {
    expect(chooseTier({ ...desk, memoryGb: 2 })).toBe('mid');
    expect(chooseTier({ ...desk, probeMs: 9, memoryGb: 2 })).toBe('low');
    expect(chooseTier({ ...desk, probeMs: 30, memoryGb: 2 })).toBe('low');
  });

  it('keeps a phone off high', () => {
    expect(chooseTier({ ...desk, width: 390, height: 844, dpr: 3 })).toBe('mid');
  });

  it('drops a big 4K fill unless the GPU is very fast', () => {
    const k4 = { ...desk, width: 3840, height: 2160, dpr: 1 };
    expect(chooseTier({ ...k4, probeMs: 1 })).toBe('high');
    expect(chooseTier({ ...k4, probeMs: 4 })).toBe('mid');
  });
});

describe('pixelRatioFor', () => {
  it('caps the device ratio per tier: high 2, mid 1.5, low 1', () => {
    expect(pixelRatioFor('high', 3)).toBe(2);
    expect(pixelRatioFor('mid', 3)).toBe(1.5);
    expect(pixelRatioFor('low', 3)).toBe(1);
    expect(pixelRatioFor('high', 1)).toBe(1);
  });
  it('lets a small canvas reach the device ratio within the same pixel count', () => {
    expect(pixelRatioFor('high', 2, 1440 * 900)).toBe(2);
    expect(pixelRatioFor('high', 3, 390 * 844)).toBe(3);
    expect(pixelRatioFor('mid', 3, 390 * 844)).toBeCloseTo(1.5 * Math.sqrt((1440 * 900) / (390 * 844)), 5);
    expect(pixelRatioFor('high', 1, 3840 * 2160)).toBe(1);
    expect(pixelRatioFor('low', 3, 1920 * 1080)).toBe(1);
  });
});
