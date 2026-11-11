import { PIECE_MOUNT } from '../config/site';

// At most PIECE_MOUNT.max pieces hold a WebGL context at once (kit 06: two pieces, with the doors' small views counting
// as one). A piece claims a place before it makes its context. When a claim would go over, the holder farthest from
// the screen gives its place up; between holders equally near, the one that keeps a still (the doors, whose canvases
// hold their last frame) gives way first, so a piece is never left as an empty box.
export interface Holder {
  // How far the holder is from the screen, in pixels; 0 while any of it is in view.
  distance: () => number;
  keepsStill: boolean;
  release: () => void;
}

const holders = new Map<string, Holder>();
const waiting = new Set<() => void>();

export const budget = {
  // Takes a place, or returns false when the claimant itself is the one that should wait.
  claim(id: string, h: Holder): boolean {
    holders.set(id, h);
    while (holders.size > PIECE_MOUNT.max) {
      let out: string | null = null;
      let worst = -1;
      for (const [k, v] of holders) {
        const d = v.distance() + (v.keepsStill ? 0.5 : 0);
        if (d > worst) { worst = d; out = k; }
      }
      if (out === null) break;
      const v = holders.get(out)!;
      holders.delete(out);
      if (out === id) return false;
      v.release();
    }
    return true;
  },
  drop(id: string): void {
    if (!holders.delete(id)) return;
    for (const fn of [...waiting]) fn();
  },
  held(): number {
    return holders.size;
  },
  // Called when a place comes free, so a holder that gave way can come back.
  onFree(fn: () => void): () => void {
    waiting.add(fn);
    return () => waiting.delete(fn);
  },
};

// How far an element is from the screen, in pixels.
export function distanceOf(el: HTMLElement): number {
  const r = el.getBoundingClientRect(), vh = innerHeight;
  return r.bottom < 0 ? -r.bottom : r.top > vh ? r.top - vh : 0;
}
