import { signedDistance } from './edt';

// Turns two coverage channels into one interleaved RG signed distance field, clamped to a range half floats hold well.
interface Job { id: number; w: number; h: number; a: Uint8ClampedArray; b: Uint8ClampedArray; clamp: number }

self.onmessage = (e: MessageEvent<Job>) => {
  const { id, w, h, a, b, clamp } = e.data;
  const out = interleave(signedDistance(a, w, h, 255), signedDistance(b, w, h, 255), clamp);
  (self as unknown as Worker).postMessage({ id, rg: out }, [out.buffer]);
};

export function interleave(r: Float32Array, g: Float32Array, clamp: number): Float32Array {
  const out = new Float32Array(r.length * 2);
  for (let i = 0; i < r.length; i++) {
    out[i * 2] = Math.max(-clamp, Math.min(clamp, r[i]));
    out[i * 2 + 1] = Math.max(-clamp, Math.min(clamp, g[i]));
  }
  return out;
}
