import { TIER_PIXEL_RATIO, TIER_PROBE, type Tier } from '../config/site';

export interface TierInputs {
  reducedMotion: boolean;
  webgl: boolean;
  // Milliseconds per frame of the GPU timing test, or null when it could not run.
  probeMs: number | null;
  // navigator.deviceMemory in GB, or null when the browser does not say.
  memoryGb: number | null;
  width: number;
  height: number;
  dpr: number;
}

const ORDER: Exclude<Tier, 'static'>[] = ['high', 'mid', 'low'];
const lower = (t: Exclude<Tier, 'static'>) => ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(t) + 1)];

// Pure: no DOM, no WebGL. The page measures the inputs and this decides.
export function chooseTier(i: TierInputs): Tier {
  if (i.reducedMotion || !i.webgl) return 'static';
  let tier: Exclude<Tier, 'static'>;
  if (i.probeMs === null) tier = 'mid';
  else if (i.probeMs <= TIER_PROBE.highMs) tier = 'high';
  else if (i.probeMs <= TIER_PROBE.midMs) tier = 'mid';
  else tier = 'low';
  if (i.memoryGb !== null && i.memoryGb < TIER_PROBE.lowMemoryGb) tier = lower(tier);
  if (i.width < TIER_PROBE.phoneWidth && tier === 'high') tier = 'mid';
  const fill = i.width * i.height * Math.min(i.dpr, TIER_PIXEL_RATIO[tier]) ** 2;
  if (fill >= TIER_PROBE.bigPixels && i.probeMs !== null && i.probeMs > TIER_PROBE.highMs * 0.5) tier = lower(tier);
  return tier;
}

// The pixel ratio a renderer uses at a tier: the device's, capped.
export function pixelRatioFor(tier: Tier, dpr: number): number {
  if (tier === 'static') return Math.min(dpr, TIER_PIXEL_RATIO.mid);
  return Math.max(1, Math.min(dpr, TIER_PIXEL_RATIO[tier]));
}
