import { PIECES, ROUTES, SHOW_3D_ART, SHOW_LAB, VIEWPORTS, type ViewportName } from '../../src/config/site';
import { projects } from '../../src/content/site';

export const NOT_FOUND = '/this-page-is-not-here/';

export const ROUTE_LIST: string[] = [
  ROUTES.home,
  ROUTES.work,
  ...projects.map((p) => ROUTES.project(p.slug)),
  ROUTES.clients,
  ROUTES.games,
  ROUTES.photography,
  ...(SHOW_3D_ART ? [ROUTES.art3d] : []),
  ROUTES.skills,
  ROUTES.about,
  ROUTES.resume,
  ...(SHOW_LAB ? [ROUTES.labMetal, ROUTES.labWater, ...PIECES.map((p) => ROUTES.labPiece(p))] : []),
  NOT_FOUND,
];

export const VIEWPORT_LIST = Object.entries(VIEWPORTS) as [ViewportName, (typeof VIEWPORTS)[ViewportName]][];

export function contextFor(name: ViewportName) {
  const v = VIEWPORTS[name];
  return { viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.scale, hasTouch: v.touch, isMobile: false };
}

export const base = () => {
  const b = process.env.SITE_BASE;
  if (!b) throw new Error('SITE_BASE is not set; the global setup did not run');
  return b;
};
