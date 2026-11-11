import type { Finish } from '../content/site';

export type PlateKind = 'plate' | 'bar' | 'placard' | 'control' | 'frame';

export interface PlateSpec {
  finish: Finish;
  kind: PlateKind;
  label?: string;
  big?: string;
  facts?: string;
  window?: boolean;
}

export interface Mask {
  w: number;
  h: number;
  S: number; // device px per design unit
  glyphs: Uint8ClampedArray; // coverage 0 to 255: words and lines
  panel: Uint8ClampedArray; // coverage 0 to 255: the sunk panel
  win: [number, number, number, number] | null; // center x, y, half w, half h in device px
  winR: number;
  screws: [number, number, number, number][];
  radius: number;
}

export const MASK_FONTS = ['500 32px "Sora Variable"', '600 32px "Sora Variable"', '700 14px "JetBrains Mono Variable"'];
const SORA = '"Sora Variable", Sora, sans-serif';
const MONO = '"JetBrains Mono Variable", "JetBrains Mono", monospace';

// Design sizes, in design units. A plate's design unit is its CSS width over the design width.
const DESIGN = {
  plate: { width: 640, pad: 40, label: 12.5, big: 34, bigWin: 30, facts: 11.5, radius: 16, maxLines: 4 },
  placard: { width: 320, pad: 24, label: 12, big: 17, facts: 11.5, radius: 12, maxLines: 6 },
  bar: { height: 56, label: 15, radius: 10 },
  control: { height: 48, label: 14, radius: 10 },
} as const;

function spaced(c: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: 'left' | 'center' = 'left'): void {
  if (!spacing) { c.textAlign = align; c.fillText(text, x, y); c.textAlign = 'left'; return; }
  const chars = [...text];
  const widths = chars.map((ch) => c.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : x;
  c.textAlign = 'left';
  chars.forEach((ch, i) => { c.fillText(ch, cx, y); cx += widths[i] + spacing; });
}

function wrap(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (c.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

// The narrowest width that keeps the same number of lines: lines come out even, and no line is a lone word.
function balanced(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const n = wrap(c, text, maxW).length;
  if (n < 2) return wrap(c, text, maxW);
  let lo = maxW * 0.4;
  let hi = maxW;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (wrap(c, text, mid).length <= n) hi = mid; else lo = mid; }
  return wrap(c, text, hi);
}

// Largest size from the design size down at which the text fits the box in at most maxLines lines.
function fit(c: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number, maxH: number, maxLines: number, lead: number) {
  for (let s = size; s > size * 0.55; s *= 0.95) {
    c.font = `${weight} ${s}px ${SORA}`;
    const lines = balanced(c, text, maxW);
    if (lines.length <= maxLines && lines.length * s * lead <= maxH && lines.every((l) => c.measureText(l).width <= maxW)) return { size: s, lines };
  }
  const s = size * 0.55;
  c.font = `${weight} ${s}px ${SORA}`;
  return { size: s, lines: wrap(c, text, maxW) };
}

const WINDOW_DESIGN_WIDTH = 960;

// A mono line with letter spacing that always fits its column: the spacing gives way first, then the size.
function monoLine(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, maxW: number, track: number): void {
  let s = size;
  let sp = track * s;
  const width = () => { c.font = `700 ${s}px ${MONO}`; return c.measureText(text).width + sp * Math.max(0, [...text].length - 1); };
  while (width() > maxW && sp > track * s * 0.35) sp *= 0.9;
  while (width() > maxW && s > size * 0.6) { s *= 0.95; sp = track * 0.35 * s; }
  c.font = `700 ${s}px ${MONO}`;
  spaced(c, text, x, y, sp);
}

function canvas(w: number, h: number): CanvasRenderingContext2D {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true });
  if (!c) throw new Error('mask: no 2D canvas');
  return c;
}

const alpha = (c: CanvasRenderingContext2D, w: number, h: number) => {
  const data = c.getImageData(0, 0, w, h).data;
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) out[i] = data[i * 4 + 3];
  return out;
};

export function paintMask(spec: PlateSpec, cssW: number, cssH: number, dpr: number): Mask {
  const w = Math.max(2, Math.round(cssW * dpr));
  const h = Math.max(2, Math.round(cssH * dpr));
  const g = canvas(w, h);
  const pn = canvas(w, h);
  g.fillStyle = 'rgb(255, 255, 255)';
  g.strokeStyle = 'rgb(255, 255, 255)';
  g.textBaseline = 'alphabetic';
  pn.fillStyle = 'rgb(255, 255, 255)';
  const f = spec.finish;
  let S: number;
  let radius: number;
  let win: Mask['win'] = null;
  let screws: Mask['screws'] = [];
  const winR = 0;

  const border = (inset: number, rad: number, lw: number) => {
    g.lineWidth = lw * S;
    g.beginPath();
    g.roundRect(inset * S, inset * S, w - inset * 2 * S, h - inset * 2 * S, rad * S);
    g.stroke();
  };

  if (spec.kind === 'bar' || spec.kind === 'control') {
    const D = DESIGN[spec.kind];
    S = (cssH / D.height) * dpr;
    radius = D.radius * S;
    g.font = `600 ${D.label * S}px ${SORA}`;
    spaced(g, spec.label ?? '', w / 2, h / 2 + D.label * S * 0.36, (spec.kind === 'bar' ? 0.34 : 0.08) * D.label * S, 'center');
    if (spec.kind === 'bar') {
      screws = [[22 * S, h / 2, 6 * S, 0.6], [w - 22 * S, h / 2, 6 * S, 2.2]];
      if (f === 'aged') { border(7, 6, 1.2); }
    } else {
      border(5, 7, 1);
    }
  } else if (spec.kind === 'frame') {
    // A picture frame: the window fills the plate, with an engraved nameplate band below it.
    const D = DESIGN.plate;
    S = (cssW / D.width) * dpr;
    radius = D.radius * S;
    const m = 46 * S, band = 84 * S;
    win = [w / 2, (m + h - band) / 2, w / 2 - m, (h - band - m) / 2];
    border(15, 9, 3); border(21, 5, 1);
    const lab = 15 * S;
    g.font = `500 ${lab}px ${SORA}`;
    spaced(g, spec.label ?? '', w / 2, h - band / 2 + lab * 0.36, 0.3 * lab, 'center');
    const r = 24 * S, rr = 5.2 * S;
    screws = [[r, r, rr, -9], [w - r, r, rr, -9], [r, h - r, rr, -9], [w - r, h - r, rr, -9]];
  } else {
    const D = DESIGN[spec.kind];
    const small = spec.kind === 'placard';
    const stacked = !!spec.window && cssH > cssW * 0.9;
    // A plate with a window beside its words is designed 960 wide; its words keep the size they have on a 640 plate.
    S = (cssW / (spec.window && !stacked && !small ? WINDOW_DESIGN_WIDTH : D.width)) * dpr;
    radius = D.radius * S;
    const pad = D.pad * S;
    let tx0 = pad;
    let tx1 = w - pad;
    let ty0 = pad;
    const ty1 = h - pad;
    if (spec.window) {
      const m = (small ? 20 : 50) * S;
      const [x0, y0, x1, y1] = stacked ? [m, m, w - m, h * 0.52] : [w * 0.47, m, w - m, h - m];
      win = [(x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2];
      if (stacked) ty0 = y1 + 40 * S;
      else tx1 = x0 - 30 * S;
    }
    // The panel finish sinks a bronze panel inside a brushed brass frame.
    if (f === 'panel') {
      const inset = (small ? 12 : 18) * S;
      pn.beginPath();
      pn.roundRect(inset, inset, (win ? tx1 + 14 * S : w - inset) - inset, h - inset * 2, (small ? 7 : 10) * S);
      pn.fill();
    }
    if (f === 'aged') { if (small) border(7, 6, 1.8); else { border(15, 9, 3); border(21, 5, 1); } }
    if (f === 'polished') border(small ? 7 : 30, small ? 6 : 7, small ? 1.1 : 1.4);
    if (f === 'bronze') border(small ? 9 : 16, small ? 6 : 9, small ? 1.2 : 1.6);

    const lab = D.label * S;
    const colW = tx1 - tx0;
    if (spec.label) monoLine(g, spec.label, tx0, ty0 + lab, lab, colW, 0.13);
    if (spec.facts) monoLine(g, spec.facts, tx0, ty1, D.facts * S, colW, 0.12);
    if (spec.big) {
      const weight = f === 'panel' || f === 'bronze' ? 600 : 500;
      const size = (spec.kind === 'plate' && spec.window ? DESIGN.plate.bigWin : D.big) * S;
      const top = ty0 + lab * (small ? 2.9 : 2.4);
      const bottom = ty1 - (spec.facts ? D.facts * S * 2.6 : 0);
      const lead = 1.14;
      const { size: fs, lines } = fit(g, spec.big, weight, size, tx1 - tx0 - (small ? 0 : 12 * S), bottom - top, D.maxLines, lead);
      g.font = `${weight} ${fs}px ${SORA}`;
      const block = lines.length * fs * lead;
      const y0 = small ? top + fs * 0.95 : top + (bottom - top - block) / 2 + fs * 0.92;
      lines.forEach((ln, i) => spaced(g, ln, tx0, y0 + i * fs * lead, -0.012 * fs));
    }
    const o = (small ? 16 : 24) * S;
    if (f === 'polished') screws = small ? [[14 * S, 14 * S, 4.2 * S, 0.9], [w - 14 * S, 14 * S, 4.2 * S, 0.5], [14 * S, h - 14 * S, 4.2 * S, 1.6], [w - 14 * S, h - 14 * S, 4.2 * S, 2.2]] : [[16 * S, 16 * S, 7 * S, 0.6], [w - 16 * S, 16 * S, 7 * S, 2.1], [16 * S, h - 16 * S, 7 * S, 1.3], [w - 16 * S, h - 16 * S, 7 * S, 2.8]];
    if (f === 'aged') { const r = small ? 14 * S : o * 1.2; const rr = (small ? 3.6 : 5.2) * S; screws = [[r, r, rr, -9], [w - r, r, rr, -9], [r, h - r, rr, -9], [w - r, h - r, rr, -9]]; }
  }
  return { w, h, S, glyphs: alpha(g, w, h), panel: alpha(pn, w, h), win, winR: winR || 10 * S, screws, radius };
}
