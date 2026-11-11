import { signedDistance } from './edt';

// Runs the distance transform in a worker when one can start, on the main thread otherwise.
// A job sent to a worker that then fails is finished on the main thread, so no plate waits forever.
const CLAMP = 24;
let worker: Worker | null = null;
let failed = false;
let next = 1;

interface Job { a: Uint8ClampedArray; b: Uint8ClampedArray; w: number; h: number; resolve: (rg: Float32Array) => void }
const waiting = new Map<number, Job>();

function local(a: Uint8ClampedArray, b: Uint8ClampedArray, w: number, h: number): Float32Array {
  const r = signedDistance(a, w, h, 255);
  const g = signedDistance(b, w, h, 255);
  const out = new Float32Array(w * h * 2);
  for (let i = 0; i < w * h; i++) {
    out[i * 2] = Math.max(-CLAMP, Math.min(CLAMP, r[i]));
    out[i * 2 + 1] = Math.max(-CLAMP, Math.min(CLAMP, g[i]));
  }
  return out;
}

function fail(): void {
  failed = true;
  worker?.terminate();
  worker = null;
  for (const [id, job] of waiting) {
    waiting.delete(id);
    job.resolve(local(job.a, job.b, job.w, job.h));
  }
}

function getWorker(): Worker | null {
  if (worker || failed || typeof Worker === 'undefined') return worker;
  try {
    worker = new Worker(new URL('./sdf.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; rg: Float32Array }>) => {
      const job = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      job?.resolve(e.data.rg);
    };
    worker.onerror = fail;
    worker.onmessageerror = fail;
  } catch {
    failed = true;
  }
  return worker;
}

export function distanceField(a: Uint8ClampedArray, b: Uint8ClampedArray, w: number, h: number): Promise<Float32Array> {
  const wk = getWorker();
  if (!wk) return Promise.resolve(local(a, b, w, h));
  const id = next++;
  return new Promise((resolve) => {
    waiting.set(id, { a, b, w, h, resolve });
    wk.postMessage({ id, w, h, a, b, clamp: CLAMP });
  });
}
