import type { Tier } from '../config/site';

// The contract every 3D piece keeps (kit/04-PIECES.md). Pages talk to a piece only through this.
export interface PieceOptions {
  tier: Tier;
  // Whether the piece plays its entrance, or starts at rest.
  entrance: boolean;
  // Called once the first frame is drawn.
  onReady?: () => void;
  // Where the piece sits at rest in its host: shift pushes it down by that fraction of the host's height, scale
  // moves the camera back (more than 1) or in. The entrance still uses the whole host.
  frame?: { shift?: number; scale?: number };
  // Start the entrance this many seconds in (the first paint already showed its beginning as a still).
  entranceFrom?: number;
}

export interface Piece {
  mount(host: HTMLElement, opts: PieceOptions): Promise<void>;
  setLamp(x: number, y: number): void;
  setProgress(p: number): void;
  setWaterLight(k: number): void;
  setMaking(on: boolean): void;
  setTier(tier: Tier): void;
  freeze(t: number | null): void;
  view(az: number, el: number, dist: number): void;
  dispose(): void;
}

export type PieceFactory = () => Piece;
