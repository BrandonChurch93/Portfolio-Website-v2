import type { PieceFactory } from '../world/piece';

// Each piece is its own chunk, loaded only when a page shows it.
export const pieceLoaders: Record<string, () => Promise<PieceFactory>> = {
  city: () => import('./city/index').then((m) => m.createCity),
  workbench: () => import('./workbench/index').then((m) => m.createWorkbench),
  handheld: () => import('./handheld/index').then((m) => m.createHandheld),
  camera: () => import('./camera/index').then((m) => m.createCamera),
};
