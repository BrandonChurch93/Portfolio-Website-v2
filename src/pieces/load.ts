import { HOOK_PARAM, STUB_PARAM } from '../config/site';
import type { PieceFactory } from '../world/piece';
import type { SmallFactory } from '../world/small';

// Each piece is its own chunk, loaded only when a page shows it.
export const pieceLoaders: Record<string, () => Promise<PieceFactory>> = {
  city: () => import('./city/index').then((m) => m.createCity),
  workbench: () => import('./workbench/index').then((m) => m.createWorkbench),
  handheld: () => import('./handheld/index').then((m) => m.createHandheld),
  camera: () => import('./camera/index').then((m) => m.createCamera),
  sculpture: () => import('./sculpture/index').then((m) => m.createSculpture),
  rocket: () => import('./rocket/index').then((m) => m.createRocket),
};

export function loaderFor(name: string): (() => Promise<PieceFactory>) | undefined {
  const q = new URLSearchParams(location.search);
  if (q.get(HOOK_PARAM) === '1' && q.get(STUB_PARAM) === name) return () => import('../world/stub').then((m) => m.createStub);
  return pieceLoaders[name];
}

// The small views for the doors on the home page, each from its own piece.
export const smallLoaders: Record<string, () => Promise<SmallFactory>> = {
  handheld: () => import('./handheld/small').then((m) => m.createSmall),
  camera: () => import('./camera/small').then((m) => m.createSmall),
  sculpture: () => import('./sculpture/small').then((m) => m.createSmall),
};
