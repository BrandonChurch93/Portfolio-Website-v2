import * as THREE from 'three';

// What the screens on the desk show, drawn from the clock so a frozen frame is always the same picture.
// The words are code and tool names that read as real work; they are not visitor copy.

const MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Menlo, monospace';
const SANS = '"Inter Variable", "Inter", system-ui, sans-serif';

const CODE = [
  '// the hero: a city that builds itself',
  "import { Stage } from '../world/stage';",
  '',
  'export function buildCity(stage: Stage) {',
  '  const disc = terraces({ radius: 456, levels: 4 });',
  '  const spire = tower({ height: 520, fins: 5 });',
  '  const water = lightWater(CANALS, { speed: 50 });',
  '',
  '  for (const lot of disc.lots) {',
  '    lot.raise(facade(lot, { rooms: true }));',
  '  }',
  '',
  '  stage.clock.onFrame((t) => {',
  '    water.flow(t);',
  '    spire.beacon(t);',
  '  });',
  '',
  '  return { disc, spire, water };',
  '}',
];
const WRITTEN = 11;
const TOTAL = CODE.slice(WRITTEN).reduce((n, l) => n + l.length + 1, 0);
const CHARS_PER_S = 22;
const HOLD = 3;

function codeLine(c: CanvasRenderingContext2D, s: string, x: number, y: number): number {
  const re = /(\/\/.*$|'[^']*'|\b(?:const|export|function|return|for|of|import|from)\b|\b\d+(?:\.\d+)?\b)/g;
  let last = 0, m: RegExpExecArray | null;
  const out = (t: string, col: string) => { c.fillStyle = col; c.fillText(t, x, y); x += c.measureText(t).width; };
  while ((m = re.exec(s))) {
    out(s.slice(last, m.index), '#e9e2d6');
    const t = m[0];
    out(t, t.startsWith('//') ? '#7d7469' : /^\d/.test(t) ? '#ffc98f' : t.startsWith("'") ? '#f1d9b0' : '#ff9a38');
    last = m.index + t.length;
  }
  out(s.slice(last), '#e9e2d6');
  return x;
}

// A small wire model of the city, turning, drawn in a viewport beside the code.
function wireCity(c: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, t: number): void {
  const a = t * 0.35, el = 0.42;
  const cx = x0 + w / 2, cy = y0 + h * 0.62, sc = Math.min(w, h) * 0.0009;
  const proj = (x: number, y: number, z: number): [number, number] => {
    const xr = x * Math.cos(a) - z * Math.sin(a), zr = x * Math.sin(a) + z * Math.cos(a);
    return [cx + xr * sc, cy - (y * Math.cos(el) - zr * Math.sin(el)) * sc];
  };
  const ring = (r: number, y: number) => { c.beginPath(); for (let i = 0; i <= 64; i++) { const q = (i / 64) * Math.PI * 2; const [px, py] = proj(Math.sin(q) * r, y, Math.cos(q) * r); if (i) c.lineTo(px, py); else c.moveTo(px, py); } c.stroke(); };
  c.strokeStyle = 'rgba(255,154,56,0.18)'; c.lineWidth = 1.2;
  for (let i = -6; i <= 6; i++) { c.beginPath(); let [px, py] = proj(i * 90, -200, -560); c.moveTo(px, py); [px, py] = proj(i * 90, -200, 560); c.lineTo(px, py); c.stroke(); c.beginPath(); [px, py] = proj(-560, -200, i * 90); c.moveTo(px, py); [px, py] = proj(560, -200, i * 90); c.lineTo(px, py); c.stroke(); }
  c.strokeStyle = '#ff9a38'; c.lineWidth = 2;
  for (const [r, y] of [[456, 0], [292, 9], [232, 19], [102, 31]]) ring(r, y);
  c.globalAlpha = 0.75;
  for (const [deg, rr, hh] of [[40, 204, 360], [-40, 200, 330], [112, 196, 290], [-112, 198, 285], [180, 204, 320]]) {
    const q = (deg * Math.PI) / 180, bx = Math.sin(q) * rr, bz = Math.cos(q) * rr;
    for (const [dx, dz] of [[-14, -14], [14, -14], [14, 14], [-14, 14]]) { c.beginPath(); let [px, py] = proj(bx + dx, 19, bz + dz); c.moveTo(px, py); [px, py] = proj(bx + dx * 0.8, 19 + hh, bz + dz * 0.8); c.lineTo(px, py); c.stroke(); }
  }
  c.globalAlpha = 1; c.lineWidth = 2.6;
  c.beginPath(); let [px, py] = proj(-24, 31, 0); c.moveTo(px, py); [px, py] = proj(0, 700, 0); c.lineTo(px, py); [px, py] = proj(24, 31, 0); c.lineTo(px, py); c.stroke();
  ring(62, 501);
  c.fillStyle = '#fff0d8'; [px, py] = proj(0, 705, 0); c.beginPath(); c.arc(px, py, 4, 0, 7); c.fill();
}

export class MonitorScreen {
  canvas = document.createElement('canvas');
  texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private last = -1;

  constructor(w = 2048, h = 1152) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  draw(t: number): void {
    const q = Math.floor(t * 30) / 30;
    if (q === this.last) return;
    this.last = q;
    const c = this.ctx, w = this.canvas.width, h = this.canvas.height, k = w / 2048;
    c.save();
    c.scale(k, k);
    const W = 2048, H = h / k;
    c.fillStyle = '#0c0b0a'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#161412'; c.fillRect(0, 0, W, 60);
    ['#ff9a38', '#6b6259', '#6b6259'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(40 + i * 34, 30, 9, 0, 7); c.fill(); });
    c.font = `500 24px ${MONO}`; c.fillStyle = '#d6cdc2'; c.fillText('city.ts', 190, 39); c.fillStyle = '#6b6259'; c.fillText('water.ts    stage.ts', 330, 39);
    c.fillStyle = '#ff9a38'; c.fillRect(176, 56, 112, 4);
    // Typing: characters appear at a steady pace, the file holds a moment when done, then starts again.
    const cycle = TOTAL / CHARS_PER_S + HOLD;
    let n = Math.floor(((q % cycle) * CHARS_PER_S)) + CODE.slice(0, WRITTEN).reduce((k, l) => k + l.length + 1, 0);
    c.font = `500 31px ${MONO}`;
    let cursor: [number, number] = [130, 120];
    CODE.forEach((s, i) => {
      const y = 120 + i * 47;
      c.fillStyle = '#4d463f'; c.fillText(String(i + 1).padStart(2, ' '), 46, y);
      if (n <= 0) return;
      const shown = s.slice(0, Math.min(s.length, n));
      const x = codeLine(c, shown, 130, y);
      if (n <= s.length) cursor = [x, y];
      else cursor = [130, y + 47];
      n -= s.length + 1;
    });
    if (Math.floor(q * 2) % 2 === 0) { c.fillStyle = '#ff9a38'; c.fillRect(cursor[0] + 2, cursor[1] - 26, 3, 32); }
    // The viewport: the wire city turning.
    const px = 1230, py = 96, pw = W - px - 36, ph = H - py - 150;
    c.fillStyle = '#100e0d'; c.strokeStyle = '#2b2622'; c.lineWidth = 2; c.beginPath(); c.roundRect(px, py, pw, ph, 18); c.fill(); c.stroke();
    c.save(); c.beginPath(); c.roundRect(px, py, pw, ph, 18); c.clip();
    wireCity(c, px, py, pw, ph, q);
    c.restore();
    c.font = `500 20px ${MONO}`; c.fillStyle = '#7d7469'; c.fillText(`${(16.7 - 6.4 * (0.5 + 0.5 * Math.sin(q * 0.8))).toFixed(1)} ms`, px + 24, py + 40);
    // A timeline under it with a playhead moving.
    c.fillStyle = '#161412'; c.beginPath(); c.roundRect(px, H - 132, pw, 96, 14); c.fill();
    c.strokeStyle = '#3a342e'; c.lineWidth = 2; [0, 1, 2].forEach((i) => { c.beginPath(); c.moveTo(px + 24, H - 108 + i * 24); c.lineTo(px + pw - 24, H - 108 + i * 24); c.stroke(); });
    c.fillStyle = '#ff9a38'; [[60, 0], [210, 0], [330, 1], [470, 1], [560, 2], [690, 0], [150, 2]].forEach(([x, r]) => { c.save(); c.translate(px + x, H - 108 + r * 24); c.rotate(Math.PI / 4); c.fillRect(-7, -7, 14, 14); c.restore(); });
    c.fillStyle = '#fff0d8'; c.fillRect(px + 24 + ((q * 60) % (pw - 48)), H - 126, 3, 84);
    c.restore();
    this.texture.needsUpdate = true;
  }
}

// The tablet: a brass plate being designed, its outline stroked in, then the shine drawn along it.
export class TabletScreen {
  canvas = document.createElement('canvas');
  texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private last = -1;

  constructor(w = 1000, h = 750) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  draw(t: number): void {
    const q = Math.floor(t * 30) / 30;
    if (q === this.last) return;
    this.last = q;
    const c = this.ctx, k = this.canvas.width / 1600;
    c.save();
    c.scale(k, k);
    const w = 1600, h = 1200;
    c.fillStyle = '#171513'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#211e1b'; c.fillRect(0, 0, 96, h); c.fillRect(w - 300, 0, 300, h);
    for (let i = 0; i < 7; i++) { c.fillStyle = i === 2 ? '#ff9a38' : '#5d554d'; c.beginPath(); c.roundRect(28, 60 + i * 84, 40, 40, 10); c.fill(); }
    c.font = `600 26px ${SANS}`; c.fillStyle = '#b8afa4'; c.fillText('Layers', w - 268, 70);
    ['Plate', 'Engraving', 'Screws', 'Light', 'Shadow'].forEach((s, i) => { c.fillStyle = i === 0 ? '#2e2924' : '#211e1b'; c.fillRect(w - 284, 96 + i * 62, 268, 52); c.fillStyle = i === 0 ? '#f3ede3' : '#8e857a'; c.fillText(s, w - 232, 131 + i * 62); c.fillStyle = '#ff9a38'; c.fillRect(w - 268, 114 + i * 62, 16, 16); });
    ['#ff9a38', '#d0a35c', '#f3ede3', '#8a5a34', '#2b2927'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(w - 250 + i * 52, 520, 20, 0, 7); c.fill(); });
    // The artboard.
    const ax = 190, ay = 150, aw = 1010, ah = 620;
    const g = c.createLinearGradient(ax, ay, ax + aw, ay + ah);
    const sh = 0.5 + 0.5 * Math.sin(q * 0.6);
    g.addColorStop(0, '#f1cf8c'); g.addColorStop(Math.max(0.05, 0.2 + sh * 0.3), '#c79a52'); g.addColorStop(Math.min(0.95, 0.45 + sh * 0.3), '#e8c27c'); g.addColorStop(1, '#8f6a34');
    c.fillStyle = g; c.beginPath(); c.roundRect(ax, ay, aw, ah, 34); c.fill();
    c.strokeStyle = 'rgba(60,38,12,0.55)'; c.lineWidth = 4; c.beginPath(); c.roundRect(ax + 26, ay + 26, aw - 52, ah - 52, 18); c.stroke();
    c.fillStyle = 'rgba(40,24,6,0.85)'; c.fillRect(ax + 80, ay + 110, 180, 20); c.fillRect(ax + 80, ay + 200, 700, 54); c.fillRect(ax + 80, ay + 280, 520, 54); c.fillRect(ax + 80, ah + ay - 110, 380, 18);
    [[ax + 52, ay + 52], [ax + aw - 52, ay + 52], [ax + 52, ay + ah - 52], [ax + aw - 52, ay + ah - 52]].forEach(([x, y]) => { c.fillStyle = '#7b5a2a'; c.beginPath(); c.arc(x, y, 13, 0, 7); c.fill(); });
    // A pen stroke drawing itself along the bottom, then starting again.
    const cycle = 6, p = (q % cycle) / (cycle - 1.2);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 80; i++) { const s = i / 80; pts.push([220 + s * 960, 930 + Math.sin(s * 9.4) * 46 * (1 - s * 0.4) + Math.sin(s * 3.1) * 30]); }
    const upto = Math.max(1, Math.min(pts.length, Math.floor(p * pts.length)));
    c.strokeStyle = '#ff9a38'; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); pts.slice(0, upto).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    const [hx, hy] = pts[upto - 1];
    c.fillStyle = '#fff0d8'; c.beginPath(); c.arc(hx, hy, 9, 0, 7); c.fill();
    c.setLineDash([10, 14]); c.lineWidth = 4; c.beginPath(); c.ellipse(1000, 420, 150, 96, 0, 0, 7); c.stroke(); c.setLineDash([]);
    c.font = `500 30px ${SANS}`; c.fillStyle = '#ff9a38'; c.fillText('shine follows the light', 866, 560);
    c.restore();
    this.texture.needsUpdate = true;
  }
}

// Keycap legends: one atlas, a cell per key, white glyphs on clear so a material can tint them.
export function legendAtlas(labels: string[]): { texture: THREE.CanvasTexture; cell: (i: number) => [number, number, number, number] } {
  const cols = 12, rows = Math.ceil(labels.length / cols), size = 96;
  const cv = document.createElement('canvas');
  cv.width = cols * size;
  cv.height = rows * size;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#ffffff';
  c.textAlign = 'left';
  c.textBaseline = 'top';
  labels.forEach((s, i) => {
    const x = (i % cols) * size, y = Math.floor(i / cols) * size;
    const fs = s.length > 2 ? 17 : s.length === 2 ? 22 : 30;
    c.font = `600 ${fs}px ${SANS}`;
    c.fillText(s, x + 16, y + 14);
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { texture: t, cell: (i) => [((i % cols) * size) / cv.width, 1 - (Math.floor(i / cols) + 1) * size / cv.height, size / cv.width, size / cv.height] };
}
