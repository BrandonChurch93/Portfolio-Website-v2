import * as THREE from 'three';
import { site } from '../../content/site';

// The handheld's screen: a small game made for this site, drawn from the clock into a low resolution canvas that the
// LCD shader turns into lit pixels. A runner carrying a lantern crosses the rooftops of a night city, jumping the gaps
// where light pours down, gathering drops of light. Every rooftop is seeded by its index, so the run never repeats.

const HW = site.pieces.handheld;
export const RES = { w: 192, h: 128 } as const;
const SPEED = 34;
const RUNNER_X = 52;
// The boot: the screen opens from a line, shows the title, then wipes into the game.
export const BOOT = { open: 0.28, title: 1.5, wipe: 1.85 } as const;

const C = {
  off: '#0d0805', skyTop: '#130a04', skyMid: '#1d1006', skyLow: '#2a1607', far: '#3a200b', farWin: '#7c4513', mid: '#1f1108', midWin: '#b0661b',
  face: '#4a2a0f', faceDark: '#3a2009', edge: '#e09442', win: '#ffc46e', winOff: '#5e3510', water: '#ffb150', waterHi: '#ffe7b0',
  drop: '#ffe7b0', dropCore: '#ffb150', ink: '#140b05', body: '#ffd08a', glow: '#8f5316', hud: '#ffe2a6', star: '#d98b3a', moon: '#f7c983',
};

const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110',
  ' ': '000000000000000', '.': '000000000000010', '·': '000000010000000',
};

function hash(i: number, k: number): number {
  let x = Math.imul(i | 0, 374761393) + Math.imul(k | 0, 668265263);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

interface Seg { x: number; w: number; y: number; gap: number; drops: number[]; gapDrop: boolean; fall: boolean; tank: boolean; mast: boolean; cum: number }

// The rooftops, grown as far as the run has gone.
class World {
  segs: Seg[] = [];
  at(i: number): Seg {
    while (this.segs.length <= i) {
      const n = this.segs.length, prev = this.segs[n - 1];
      const w = 44 + Math.floor(hash(n, 1) * 46);
      let y = 86 + Math.floor(hash(n, 2) * 4) * 6;
      if (n === 0) y = 92;
      const x = prev ? prev.x + prev.w + prev.gap : -40;
      const nd = Math.floor(hash(n, 4) * 3);
      const drops = Array.from({ length: nd }, (_, j) => x + (w * (j + 1)) / (nd + 1));
      const cum = prev ? prev.cum + prev.drops.length + (prev.gapDrop ? 1 : 0) : 0;
      this.segs.push({ x, w, y, gap: 18 + Math.floor(hash(n, 3) * 14), drops, gapDrop: hash(n, 5) > 0.35, fall: hash(n, 6) > 0.45, tank: hash(n, 7) > 0.62, mast: hash(n, 8) > 0.55, cum });
    }
    return this.segs[i];
  }
  // The rooftop the runner is over or jumping from.
  find(xr: number): number {
    let i = 0;
    while (this.at(i + 1).x + 4 <= xr) i++;
    return i;
  }
}

export interface RunState { x: number; y: number; air: boolean; jumpS: number; seg: number; aK: number; pressRight: boolean }

export function runAt(world: World, g: number, hops: readonly number[]): RunState {
  const xr = g * SPEED + RUNNER_X;
  const i = world.find(xr);
  const a = world.at(i), b = world.at(i + 1);
  const take = a.x + a.w - 6, land = b.x + 4;
  let y = a.y, air = false, s = 0;
  if (xr >= take) {
    s = (xr - take) / (land - take);
    const H = 12 + Math.max(0, a.y - b.y);
    y = a.y + (b.y - a.y) * s - 4 * H * s * (1 - s);
    air = true;
  }
  for (const h of hops) {
    const k = (g - h) / 0.42;
    if (k > 0 && k < 1) { y -= 40 * k * (1 - k); air = true; }
  }
  return { x: xr, y, air, jumpS: s, seg: i, aK: Math.min(1, Math.max(0, 1.6 - Math.abs(xr - take - 1) / 3.5)), pressRight: !air };
}

export class HandheldScreen {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  private c: CanvasRenderingContext2D;
  private world = new World();
  private stamp = '';
  private skyBase: HTMLCanvasElement;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = RES.w;
    this.canvas.height = RES.h;
    this.c = this.canvas.getContext('2d')!;
    this.c.imageSmoothingEnabled = false;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.skyBase = document.createElement('canvas');
    this.skyBase.width = RES.w;
    this.skyBase.height = RES.h;
    const s = this.skyBase.getContext('2d')!;
    s.fillStyle = C.skyTop;
    s.fillRect(0, 0, RES.w, RES.h);
    s.fillStyle = C.skyMid;
    s.fillRect(0, 58, RES.w, RES.h);
    s.fillStyle = C.skyLow;
    s.fillRect(0, 84, RES.w, RES.h);
  }

  run(g: number, hops: readonly number[]): RunState { return runAt(this.world, g, hops); }

  // power: 0 off, 1 on. boot: seconds since power on (null once the game runs). g: game seconds.
  draw(power: number, boot: number | null, g: number, hops: readonly number[]): void {
    const key = `${power.toFixed(2)}|${boot === null ? '-' : Math.floor(boot * 30)}|${Math.floor(g * 30)}|${hops.length}`;
    if (key === this.stamp) return;
    this.stamp = key;
    const c = this.c;
    c.fillStyle = C.off;
    c.fillRect(0, 0, RES.w, RES.h);
    if (power > 0) {
      if (boot !== null && boot < BOOT.wipe) this.boot(boot, g, hops);
      else this.game(g, hops);
    }
    this.texture.needsUpdate = true;
  }

  private px(x: number, y: number, col: string, w = 1, h = 1): void {
    this.c.fillStyle = col;
    this.c.fillRect(Math.round(x), Math.round(y), w, h);
  }

  private text(s: string, x: number, y: number, scale: number, col: string): void {
    let cx = x;
    for (const ch of s.toUpperCase()) {
      const g = FONT[ch] ?? FONT[' '];
      for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === '1') this.px(cx + q * scale, y + r * scale, col, scale, scale);
      cx += 4 * scale;
    }
  }

  private textW(s: string, scale: number): number { return s.length * 4 * scale - scale; }

  private dropIcon(x: number, y: number, col = C.drop, core = C.dropCore): void {
    this.px(x + 1, y, col);
    this.px(x, y + 1, col, 3, 1);
    this.px(x, y + 2, col, 3, 1);
    this.px(x + 1, y + 3, col);
    this.px(x + 1, y + 2, core);
  }

  private boot(b: number, g: number, hops: readonly number[]): void {
    const c = this.c;
    if (b < BOOT.open) {
      // The screen opens from a bright line at its middle.
      const k = b / BOOT.open, hh = Math.max(1, Math.round(RES.h * k * k));
      c.fillStyle = C.skyLow;
      c.fillRect(0, Math.round((RES.h - hh) / 2), RES.w, hh);
      c.fillStyle = C.waterHi;
      c.fillRect(0, Math.round(RES.h / 2) - 1, RES.w, 1);
      return;
    }
    this.sky(0);
    const k = Math.min(1, (b - BOOT.open) / 0.35);
    const tw = this.textW(HW.title, 3);
    const col = k < 0.34 ? C.far : k < 0.67 ? C.midWin : C.hud;
    this.dropIcon(RES.w / 2 - 1, 30, k < 0.5 ? C.midWin : C.drop);
    this.text(HW.title, Math.round((RES.w - tw) / 2), 42, 3, col);
    const sw = this.textW(HW.boot, 1);
    if (b > BOOT.open + 0.3) this.text(HW.boot, Math.round((RES.w - sw) / 2), 66, 1, C.farWin);
    if (b > BOOT.title) {
      // Wipe into the game, column by column.
      const w = Math.round(RES.w * Math.min(1, (b - BOOT.title) / (BOOT.wipe - BOOT.title)));
      const keep = c.getImageData(w, 0, RES.w - w, RES.h);
      this.game(g, hops);
      if (w < RES.w) c.putImageData(keep, w, 0);
    }
  }

  // A night sky in ordered dither steps, as a small LCD would draw it.
  private sky(cam: number): void {
    this.c.drawImage(this.skyBase, 0, 0);
    for (let i = 0; i < 46; i++) {
      const sx = ((hash(i, 21) * 600 - cam * 0.04) % RES.w + RES.w) % RES.w, sy = 10 + hash(i, 22) * 52;
      if (Math.sin(cam * 0.02 + i * 2.1 + hash(i, 23) * 40) > -0.4) this.px(sx, sy, hash(i, 24) > 0.8 ? C.moon : C.star);
    }
  }

  private game(g: number, hops: readonly number[]): void {
    const c = this.c;
    const cam = g * SPEED;
    const r = this.run(g, hops);
    this.sky(cam);
    // The moon.
    c.fillStyle = C.moon;
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) if (x * x + y * y <= 49) this.px(158 + x, 24 + y, (x + 2) * (x + 2) + (y + 1) * (y + 1) < 5 || (x - 3) * (x - 3) + (y - 3) * (y - 3) < 3 ? C.star : C.moon);
    // Far city, with a spire whose beacon blinks.
    const farCam = cam * 0.2;
    for (let i = Math.floor(farCam / 18) - 1; i < Math.floor(farCam / 18) + 13; i++) {
      const x = i * 18 - farCam, h = 18 + hash(i, 31) * 30, w = 12 + Math.floor(hash(i, 32) * 8);
      this.px(x, 104 - h, C.far, w, h + 24);
      for (let wy = 104 - h + 3; wy < 100; wy += 4) for (let wx = 2; wx < w - 2; wx += 3) if (hash(i * 97 + wx, wy) > 0.72) this.px(x + wx, wy, C.farWin);
      if (hash(i, 33) > 0.82) {
        this.px(x + w / 2 - 1, 104 - h - 14, C.far, 2, 14);
        this.px(x + w / 2 - 1, 104 - h - 18, C.far, 1, 4);
        if (Math.floor(g * 1.4 + i) % 2 === 0) this.px(x + w / 2 - 1, 104 - h - 19, C.waterHi);
      }
    }
    // A craft crossing the sky now and then.
    const ct = (g % 11) / 11, cn = Math.floor(g / 11);
    if (hash(cn, 41) > 0.3) {
      const cx = RES.w + 10 - ct * (RES.w + 30), cy = 20 + hash(cn, 42) * 26;
      this.px(cx, cy, C.midWin, 5, 1);
      this.px(cx + 1, cy - 1, C.midWin, 2, 1);
      if (Math.floor(g * 4) % 2 === 0) this.px(cx + 5, cy, C.waterHi);
    }
    // Middle city.
    const midCam = cam * 0.5;
    for (let i = Math.floor(midCam / 26) - 1; i < Math.floor(midCam / 26) + 10; i++) {
      const x = i * 26 - midCam, h = 24 + hash(i, 51) * 26, w = 16 + Math.floor(hash(i, 52) * 10);
      this.px(x, 112 - h, C.mid, w, h + 20);
      for (let wy = 112 - h + 4; wy < 110; wy += 5) for (let wx = 3; wx < w - 3; wx += 4) if (hash(i * 131 + wx, wy) > 0.66) this.px(x + wx, wy, C.midWin, 2, 2);
    }
    // The rooftops the runner crosses.
    const first = this.world.find(cam - 60);
    for (let i = first; ; i++) {
      const s = this.world.at(i);
      const x = s.x - cam;
      if (x > RES.w) break;
      this.building(i, s, x, g);
      if (s.fall) this.fall(s, x, g);
    }
    // Drops of light: on the roofs and at the top of each jump. Taken ones flash and are gone.
    let score = 0;
    for (let i = first; ; i++) {
      const s = this.world.at(i);
      if (s.x - cam > RES.w) break;
      const n = this.world.at(i + 1);
      const list = s.drops.map((dx) => ({ x: dx, y: s.y - 9 }));
      if (s.gapDrop) { const H = 12 + Math.max(0, s.y - n.y); list.push({ x: (s.x + s.w - 6 + n.x + 4) / 2, y: (s.y + n.y) / 2 - H - 6 }); }
      for (const d of list) {
        const sx = d.x - cam;
        const passed = r.x - d.x;
        if (passed < 0) this.dropIcon(sx - 1, d.y - 2 + Math.round(Math.sin(g * 4 + d.x) * 1));
        else if (passed < 14) {
          const k = passed / 14, rr = 2 + k * 6;
          for (let a = 0; a < 8; a++) this.px(sx + Math.cos(a * 0.785) * rr, d.y + Math.sin(a * 0.785) * rr, k < 0.5 ? C.waterHi : C.water);
        }
      }
    }
    const si = this.world.find(r.x);
    const seg = this.world.at(si), nx = this.world.at(si + 1);
    score = seg.cum + seg.drops.filter((d) => d < r.x).length;
    if (seg.gapDrop && r.x > (seg.x + seg.w - 6 + nx.x + 4) / 2) score += 1;
    this.runner(r, g);
    // Score and distance.
    this.dropIcon(5, 6);
    this.text(String(score), 12, 4, 2, C.hud);
    const dist = `${Math.floor(r.x / 16)} ${HW.unit}`;
    this.text(dist, RES.w - 5 - this.textW(dist, 2), 4, 2, C.hud);
  }

  private building(i: number, s: Seg, x: number, g: number): void {
    this.px(x, s.y, C.face, s.w, RES.h - s.y);
    this.px(x + s.w - 3, s.y + 2, C.faceDark, 3, RES.h - s.y);
    this.px(x, s.y, C.edge, s.w, 1);
    this.px(x, s.y + 1, C.faceDark, s.w, 1);
    for (let wy = s.y + 6; wy < RES.h; wy += 7) for (let wx = 4; wx < s.w - 6; wx += 6) {
      const lit = hash(i * 211 + wx, wy) > 0.45 !== (hash(i * 7 + wx, Math.floor(g / 7) + wy) > 0.94);
      this.px(x + wx, wy, lit ? C.win : C.winOff, 3, 3);
    }
    if (s.tank) {
      const tx = x + Math.floor(s.w * 0.22);
      this.px(tx, s.y - 7, C.faceDark, 7, 5);
      this.px(tx, s.y - 7, C.edge, 7, 1);
      this.px(tx + 1, s.y - 2, C.faceDark, 1, 2);
      this.px(tx + 5, s.y - 2, C.faceDark, 1, 2);
    }
    if (s.mast) {
      const mx = x + Math.floor(s.w * 0.7);
      this.px(mx, s.y - 12, C.faceDark, 1, 12);
      this.px(mx - 2, s.y - 9, C.faceDark, 5, 1);
      if (Math.floor(g * 1.2 + i) % 3 === 0) this.px(mx, s.y - 13, C.waterHi);
    }
  }

  // Light pouring from a spout under the roof edge into the gap, in dashes that run downward.
  private fall(s: Seg, x: number, g: number): void {
    const sx = x + s.w, top = s.y + 4;
    this.px(sx, top - 1, C.edge, 2, 2);
    for (let y = top; y < RES.h; y++) {
      const d = y - top;
      const bend = Math.min(3, Math.floor(Math.sqrt(d) * 0.6));
      const k = ((d * 0.5 - g * 46) % 9 + 9) % 9;
      this.px(sx + 1 + bend, y, k < 3 ? C.waterHi : C.water, 2, 1);
      if (k < 1 && d > 6) this.px(sx + bend, y, C.water);
    }
    for (let a = 0; a < 3; a++) {
      const ph = (g * 3 + a * 0.33) % 1;
      this.px(sx + 2 + 3 + (a - 1) * ph * 6, RES.h - 2 - Math.sin(ph * Math.PI) * 5, C.waterHi);
    }
  }

  // The runner: a small figure holding a lantern ahead of it, its light warming the roof edge under it.
  private runner(r: RunState, g: number): void {
    const x = RUNNER_X, y = Math.round(r.y);
    for (let dx = -9; dx <= 12; dx++) {
      const k = 1 - Math.abs(dx - 3) / 12;
      if (k > 0.35 && !r.air) this.px(x + dx, y, C.waterHi);
    }
    const f = r.air ? -1 : Math.floor(g * 11) % 4;
    const ink = C.ink, body = C.body;
    this.px(x + 1, y - 10, ink, 4, 4);
    this.px(x + 2, y - 9, body, 2, 2);
    this.px(x + 1, y - 6, ink, 4, 4);
    this.px(x + 2, y - 6, body, 2, 3);
    const legs = f === -1 ? [[1, 0], [4, -1]] : f === 0 ? [[0, 0], [4, 0]] : f === 1 ? [[1, 0], [3, -1]] : f === 2 ? [[2, 0], [2, 0]] : [[3, -1], [1, 0]];
    for (const [lx, ly] of legs) this.px(x + lx, y - 3 + ly, ink, 1, 3);
    const ly = y - 6 + (f === 1 || f === 3 ? 1 : 0);
    this.px(x + 5, ly, ink, 2, 1);
    this.px(x + 7, ly - 1, ink, 3, 4);
    this.px(x + 8, ly, C.waterHi, 1, 2);
    if (Math.floor(g * 6) % 2 === 0) this.px(x + 11, ly, C.water);
  }

  dispose(): void { this.texture.dispose(); }
}
