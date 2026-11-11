import type { Tier } from '../config/site';

// The contract every 3D piece keeps (kit/04-PIECES.md). Pages talk to a piece only through this.
export interface PieceOptions {
  tier: Tier;
  // Whether the piece plays its entrance, or starts at rest.
  entrance: boolean;
  // Called once the first frame is drawn.
  onReady?: () => void;
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
