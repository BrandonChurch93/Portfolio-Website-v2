import type { Finish } from '../content/site';

const lin = (hex: number): [number, number, number] => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => Math.pow(v / 255, 2.2)) as [number, number, number];

export const BRASS = lin(0xe6b866);
export const BRONZE = lin(0x5e4630);
export const DEEP_BRONZE = lin(0x4a2f1b);
export const AGED_BRASS = lin(0xc9994e);

export interface FinishParams {
  a: [number, number, number]; // the plate's metal, linear F0
  b: [number, number, number]; // the second metal (inlay or panel)
  ra: number; // roughness of a
  rb: number; // roughness of b
  aniso: number; // how brushed: 0 polished round highlight, 1 long streak
  grain: number; // normal perturbation of the brushing
  patina: number; // 0 clean, 1 aged
  scratch: number; // fine scratches
  id: number; // shader finish id
}

// Brass and bronze only, four finishes (kit/02-DESIGN.md, Metal).
export const FINISHES: Record<Finish, FinishParams> = {
  aged: { a: AGED_BRASS, b: BRASS, ra: 0.34, rb: 0.3, aniso: 0.45, grain: 0.075, patina: 1, scratch: 1, id: 0 },
  polished: { a: BRASS, b: BRASS, ra: 0.1, rb: 0.1, aniso: 0.08, grain: 0.008, patina: 0.06, scratch: 0.25, id: 1 },
  bronze: { a: BRONZE, b: BRASS, ra: 0.32, rb: 0.38, aniso: 0.5, grain: 0.04, patina: 0.3, scratch: 0.35, id: 2 },
  panel: { a: BRASS, b: DEEP_BRONZE, ra: 0.26, rb: 0.38, aniso: 0.9, grain: 0.14, patina: 0.12, scratch: 0.3, id: 3 },
};

export const INK: [number, number, number] = [0.006, 0.005, 0.004];
