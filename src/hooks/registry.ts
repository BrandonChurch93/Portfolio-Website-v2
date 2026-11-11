// Where pieces, the water, plates and the opening make themselves reachable to the test hooks.
// Registering costs nothing; the hooks themselves exist only with ?hook=1.

export interface PieceHandle {
  setProgress(p: number): void;
  setMaking(on: boolean): void;
  freeze(t: number | null): void;
  view(az: number, el: number, dist: number): void;
}

export interface WaterHandle {
  head(v: number | string): void;
  move(name: string, t: number): void;
}

const pieces = new Map<string, PieceHandle>();
let water: WaterHandle | null = null;
let opening: ((t: number) => void) | null = null;
const pending = new Set<Promise<unknown>>();
const freezers = new Set<(t: number | null) => Promise<void> | void>();

// Numbers the site measures about itself (milliseconds), read by tests and by scripts/measure.mjs.
export const stats: Record<string, number> = {};

export const registry = {
  piece(name: string, handle: PieceHandle | null): void {
    if (handle) pieces.set(name, handle);
    else pieces.delete(name);
  },
  getPiece(name: string): PieceHandle | undefined {
    return pieces.get(name);
  },
  water(handle: WaterHandle | null): void {
    water = handle;
  },
  getWater(): WaterHandle | null {
    return water;
  },
  opening(fn: ((t: number) => void) | null): void {
    opening = fn;
  },
  getOpening(): ((t: number) => void) | null {
    return opening;
  },
  // Things with a clock of their own (video) follow freeze(t) through these.
  onFreeze(fn: (t: number | null) => Promise<void> | void): () => void {
    freezers.add(fn);
    return () => freezers.delete(fn);
  },
  freezeAll(t: number | null): void {
    for (const fn of freezers) {
      const r = fn(t);
      if (r) registry.track(r);
    }
  },
  // Anything still loading (a picture, a piece, a shader) is tracked here, and settle() waits for all of it.
  track<T>(p: Promise<T>): Promise<T> {
    pending.add(p);
    const done = () => pending.delete(p);
    p.then(done, done);
    return p;
  },
  async idle(): Promise<void> {
    while (pending.size) await Promise.allSettled([...pending]);
  },
};
