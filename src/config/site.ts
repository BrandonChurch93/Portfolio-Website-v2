// Every constant that is not copy, once. Scripts import this file too (Node strips the types), so it has no imports
// and uses only erasable TypeScript.

export const SITE_NAME = 'Brandon Church';
export const SITE_URL = 'https://brandonchurchportfolio.com';

export const SHOW_3D_ART = (process.env.SITE_SHOW_3D_ART ?? 'true') !== 'false';
export const SHOW_LAB = (process.env.SITE_SHOW_LAB ?? 'true') !== 'false';

export const PORTS = { dev: 5320, staticFirst: 5321, staticLast: 5329 } as const;

export type ViewportName = 'phone' | 'tablet' | 'desktop' | 'wide' | '4k';
export const VIEWPORTS: Record<ViewportName, { width: number; height: number; scale: number; touch: boolean }> = {
  phone: { width: 390, height: 844, scale: 3, touch: true },
  tablet: { width: 834, height: 1194, scale: 2, touch: true },
  desktop: { width: 1440, height: 900, scale: 2, touch: false },
  wide: { width: 1920, height: 1080, scale: 1, touch: false },
  '4k': { width: 3840, height: 2160, scale: 1, touch: false },
};

export const ROUTES = {
  home: '/',
  work: '/work/',
  project: (slug: string) => `/work/${slug}/`,
  clients: '/clients/',
  games: '/games/',
  photography: '/photography/',
  art3d: '/3d-art/',
  skills: '/skills/',
  about: '/about/',
  resume: '/resume/',
  labMetal: '/lab/metal/',
  labWater: '/lab/water/',
  labPiece: (name: string) => `/lab/piece/${name}/`,
} as const;

// Colors that code needs as numbers (metadata, WebGL clears, shaders). The interface reads src/styles/tokens.css;
// tests/unit/config.test.ts checks the two agree. Water amber in 3D is given as sRGB hex (kit/02-DESIGN.md).
export const COLORS = { bg: '#0c0a09', amber: '#ff9d3c', accent: '#d4a574', text: '#f5f2ee', waterAmber3d: 0xff9a38 } as const;

export const PIECES = ['city', 'workbench', 'handheld', 'camera', 'rocket', 'sculpture'] as const;
export type PieceName = (typeof PIECES)[number];

// Layout: below this width the page is one column.
export const BREAKPOINT_ONE_COLUMN = 820;
// The page's reading line, as a fraction of the viewport height: the water's head sits here as the page scrolls.
export const READING_LINE = 0.66;
// A piece mounts within this many viewport heights of the screen and disposes beyond the second number.
export const PIECE_MOUNT = { near: 1, far: 2.5 } as const;
// At and above this width the featured work steps down in two columns (src/app/home.module.css matches it).
export const BREAKPOINT_WORK_COLUMNS = 1100;

// ---- tiers --------------------------------------------------------------------------------------

export type Tier = 'high' | 'mid' | 'low' | 'static';
export const TIERS: readonly Tier[] = ['high', 'mid', 'low', 'static'];
export const TIER_PIXEL_RATIO: Record<Exclude<Tier, 'static'>, number> = { high: 2, mid: 1.5, low: 1 };
// The GPU timing test draws a fixed load and measures milliseconds per frame. These are the limits per tier.
export const TIER_PROBE = {
  frames: 24,
  highMs: 6,
  midMs: 12,
  // A screen this many CSS pixels wide or wider at this pixel ratio costs more to fill; one tier lower unless the GPU is fast.
  bigPixels: 3840 * 2160,
  lowMemoryGb: 4,
  phoneWidth: 600,
} as const;

// ---- the one clock and the lamp ----------------------------------------------------------------

export const CLOCK = { maxStep: 1 / 20 } as const;

export const LAMP = {
  // Easing toward the cursor, per second. Higher follows faster.
  follow: 9,
  // With no cursor for this long, the lamp drifts on its own.
  idleAfter: 6,
  // The drift: a slow Lissajous over the viewport, leaning toward the last touch.
  drift: { cx: 0.5, cy: 0.38, ax: 0.32, ay: 0.16, fx: 0.11, fy: 0.083, touchLean: 0.45, touchHold: 4 },
  // Depth of the lamp in front of the page, as a fraction of the viewport width.
  depth: 0.42,
} as const;

// ---- the hero ---------------------------------------------------------------------------------------

// Where the city rests in the hero (see PieceOptions.frame), the stills shown at first paint, written by
// scripts/stills.mjs, and how far into the opening the first-visit still is (the opening continues from there).
export const HERO = {
  // Tall screens (phone, tablet upright) stack the words over the city; wide ones set them either side of the spire.
  frame: { tall: { shift: 0.15, scale: 1.12 }, upright: { shift: 0.165, scale: 1.12 }, wide: { shift: 0.12, scale: 1.0 } },
  once: 'city-opening',
  planStillAt: 1.0,
  stills: {
    city: { wide: '/generated/city-rest-wide.webp', tall: '/generated/city-rest-tall.webp' },
    plan: { wide: '/generated/city-plan-wide.webp', tall: '/generated/city-plan-tall.webp' },
  },
  // The headline arrives over the opening's last moments, in seconds before its end.
  wordsIn: [1.3, 0.2],
} as const;

// ---- test hooks ---------------------------------------------------------------------------------

export const HOOK_PARAM = 'hook';
export const SETTLE = { frames: 3, timeoutMs: 60000, pictureMs: 15000 } as const;

// ---- media --------------------------------------------------------------------------------------

export const MEDIA_WIDTHS = [480, 960, 1600, 2400] as const;

// Photo windows have designed shapes. Pictures are cropped to fill them; the shape never bends to a picture.
// Brandon exports new project pictures at these ratios (see the Handoff in kit/PROGRESS.md).
export const WINDOW_ASPECT = { plate: 16 / 10, project: 16 / 9, portrait: 4 / 5 } as const;
