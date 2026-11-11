// The water's route, built from anchors on the page. Pure: no DOM, no WebGL. Units are CSS pixels in page space
// (y grows down the page) and seconds.
//
// The route is a set of branches of samples. Every sample knows its distance along the route (s), shared by both
// halves of a split, and its travel time (f): how long water takes to get there from the source. Falls are true
// parabolas under gravity, so their travel time grows with the square root of the drop.

export type StrandKind = 'run' | 'surface' | 'cling' | 'fall';
export const KIND_ID: Record<StrandKind, number> = { run: 0, surface: 1, cling: 2, fall: 3 };

export interface Rect { left: number; top: number; right: number; bottom: number }

export type AnchorKind = 'weave' | 'corner' | 'split' | 'pool' | 'edge';

export interface Anchor {
  id: string;
  kind: AnchorKind;
  rect: Rect;
  // weave: which gutter; corner: the corner the water lands on (it runs to the other one).
  side?: 'left' | 'right';
  // split: the section the two falls frame, rejoining under it.
  frame?: Rect;
  // split with a bar narrower than its frame: the control the two halves meet behind, under the frame.
  join?: Rect;
  // edge (a desk front seen in perspective): where it lands and where it pours, page px.
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  // How far it falls after pouring off, px. Default: to the next thing, at most WATER.maxFall.
  fall?: number;
  // weave: run down this page x instead of a gutter (a gap between two columns of things).
  x?: number;
  // pool: where the stream enters a 3D piece that carries it on into its own pool, page px. The page draws no pool.
  at?: { x: number; y: number };
}

export interface RouteOptions {
  start: { x: number; y: number };
  // The page column: the water weaves in the gutters outside it.
  column: { left: number; right: number };
  narrow: boolean;
  // Page width, so a narrow route can run down the middle of the margins.
  width: number;
  // Text and other blocks the water must not cross, page px. The route reaches its gutter before each one.
  avoid?: readonly Rect[];
  // Where the route ends when no pool takes it: page px.
  endY: number;
  gravity?: number;
}

export interface Sample {
  x: number; y: number;
  s: number; f: number;
  hw: number;
  kind: number;
  // Distance fallen since release, for thinning and breakup. 0 off falls.
  drop: number;
  nx: number; ny: number;
}

export interface Branch { id: number; samples: Sample[] }

export interface Landing {
  x: number; y: number; s: number; f: number;
  // Direction the water runs from the impact: -1 left, 1 right, 0 both (a split).
  dir: -1 | 0 | 1;
  strength: number;
  anchor: string;
}

export interface Pool { x: number; y: number; rx: number; ry: number; s: number; f: number; anchor: string }

export interface Route {
  branches: Branch[];
  landings: Landing[];
  pools: Pool[];
  total: number;
  // Where each anchor's interaction happens, for lighting what the water touches.
  touch: { anchor: string; x: number; y: number; s: number }[];
}

export const WATER = {
  // A stretch that starts thinner or wider than its kind eases to its own width over this many px.
  widthEase: 48,
  gravity: 2600,
  step: 3,
  speed: { run: 240, surface: 230, cling: 120 },
  width: { run: 13, surface: 7.5, cling: 8, fall: 12, side: 11 },
  // A phone keeps a narrower stream: its margins are tiny.
  narrowScale: 0.38,
  gutter: 44,
  narrowGutter: 14,
  landInset: 16,
  lip: 2,
  maxFall: 220,
  minFall: 70,
  // How far beside a block of text the water keeps when it goes round it.
  clear: 46,
  // Moving across to a new line, the water drops this far while it crosses, so the turn is a soft step, not a corner.
  crossDrop: 56,
  // A long run meanders a little as it goes, never straight down a gutter: this far either side, this long a bend.
  wander: { amp: 12, wave: 460, minRun: 260 },
} as const;

class Pen {
  samples: Sample[] = [];
  constructor(public x: number, public y: number, public s: number, public f: number, private wScale: number) {}

  private push(x: number, y: number, kind: StrandKind, hw: number, drop: number, df: number): void {
    const ds = Math.hypot(x - this.x, y - this.y);
    if (this.samples.length && ds < 1e-6) return;
    this.s += ds;
    this.f += df;
    this.x = x;
    this.y = y;
    this.samples.push({ x, y, s: this.s, f: this.f, hw: hw * this.wScale, kind: KIND_ID[kind], drop, nx: 0, ny: 0 });
  }

  // The width a new stretch starts from, and how far along it has gone: a run after a thin fall widens over its
  // first stretch instead of jumping, so there is no tick at the join.
  private eased(target: number, from: number, d: number): number {
    const k = Math.min(1, d / WATER.widthEase);
    return from + (target - from) * k * k * (3 - 2 * k);
  }

  private lastHw(fallback: number): number {
    const last = this.samples[this.samples.length - 1];
    return last ? last.hw / this.wScale : fallback;
  }

  begin(kind: StrandKind): void {
    if (!this.samples.length) this.samples.push({ x: this.x, y: this.y, s: this.s, f: this.f, hw: WATER.width[kind] * this.wScale, kind: KIND_ID[kind], drop: 0, nx: 0, ny: 0 });
  }

  // A smooth run down the page with vertical tangents at both ends.
  curveTo(x: number, y: number, kind: Exclude<StrandKind, 'fall'> = 'run'): void {
    this.begin(kind);
    const x0 = this.x, y0 = this.y, dy = y - y0;
    const len = Math.hypot(x - x0, dy) * 1.2;
    const n = Math.max(2, Math.ceil(len / WATER.step));
    const c1y = y0 + dy * 0.5, c2y = y - dy * 0.5;
    let px = x0, py = y0, d = 0;
    const from = this.lastHw(WATER.width[kind]);
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      const bx = u * u * u * x0 + 3 * u * u * t * x0 + 3 * u * t * t * x + t * t * t * x;
      const by = u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y;
      const ds = Math.hypot(bx - px, by - py);
      px = bx; py = by; d += ds;
      this.push(bx, by, kind, this.eased(WATER.width[kind], from, d), 0, ds / WATER.speed[kind]);
    }
  }

  // From heading down to heading level, on a circular arc of radius r, arriving at (x, y) moving sideways.
  bendTo(x: number, y: number, r: number): void {
    this.begin('run');
    const dir = Math.sign(x - this.x) || 1;
    const startY = y - r;
    if (this.y < startY - 1) this.lineTo(this.x, startY, 'run');
    const ox = this.x + dir * r, oy = startY;
    const n = Math.max(4, Math.ceil((Math.PI / 2) * r / WATER.step));
    for (let k = 1; k <= n; k++) {
      const a = (k / n) * (Math.PI / 2);
      const nx = ox - dir * Math.cos(a) * r, ny = oy + Math.sin(a) * r;
      this.push(nx, ny, 'run', WATER.width.run, 0, Math.hypot(nx - this.x, ny - this.y) / WATER.speed.run);
    }
    if (Math.abs(x - this.x) > 1) this.lineTo(x, y, 'run');
  }

  // A long run down to (x, y) that meanders up to amp either side of its line, starting and ending straight, so it
  // meets what comes before and after without a kink.
  wander(x: number, y: number, amp: number): void {
    const x0 = this.x, y0 = this.y, L = y - y0;
    if (amp < 1 || L < WATER.wander.minRun || Math.abs(x - x0) > 2) { this.lineTo(x, y, 'run'); return; }
    this.begin('run');
    const n = Math.max(2, Math.ceil(L / WATER.step));
    const waves = Math.max(1, Math.round(L / WATER.wander.wave));
    const phase = (y0 * 0.0137) % 1 > 0.5 ? 1 : -1;
    const from = this.lastHw(WATER.width.run);
    let d = 0;
    for (let k = 1; k <= n; k++) {
      const t = k / n, env = Math.sin(Math.PI * t) ** 2;
      const nx = x0 + (x - x0) * t + phase * amp * env * Math.sin(Math.PI * 2 * waves * t * 0.5);
      const ny = y0 + L * t;
      const ds = Math.hypot(nx - this.x, ny - this.y);
      d += ds;
      this.push(nx, ny, 'run', this.eased(WATER.width.run, from, d), 0, ds / WATER.speed.run);
    }
  }

  lineTo(x: number, y: number, kind: Exclude<StrandKind, 'fall'>, width: number = WATER.width[kind]): void {
    this.begin(kind);
    const n = Math.max(1, Math.ceil(Math.hypot(x - this.x, y - this.y) / WATER.step));
    const x0 = this.x, y0 = this.y;
    const from = this.lastHw(width), total = Math.hypot(x - x0, y - y0);
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const nx = x0 + (x - x0) * t, ny = y0 + (y - y0) * t;
      this.push(nx, ny, kind, this.eased(width, from, total * t), 0, Math.hypot(nx - this.x, ny - this.y) / WATER.speed[kind]);
    }
  }

  // Around a corner of radius r from heading along the top edge (dir): water clings part way, then lets go along the
  // tangent. Returns the velocity it leaves with, so the fall that follows starts without a kink.
  cling(dir: 1 | -1, r: number, turn = Math.PI / 3): { vx: number; vy: number } {
    this.begin('cling');
    const cx = this.x, cy = this.y + r;
    const n = Math.max(4, Math.ceil(turn * r / WATER.step));
    for (let k = 1; k <= n; k++) {
      const a = (k / n) * turn;
      const x = cx + dir * Math.sin(a) * r, y = cy - Math.cos(a) * r;
      this.push(x, y, 'cling', WATER.width.cling, 0, Math.hypot(x - this.x, y - this.y) / WATER.speed.cling);
    }
    const v = WATER.speed.surface * 0.95;
    return { vx: dir * Math.cos(turn) * v, vy: Math.sin(turn) * v };
  }

  // Free fall from here with initial velocity (vx, vy) until y reaches toY. Samples are spaced by time.
  fall(vx: number, vy: number, toY: number, g: number): void {
    this.begin('fall');
    const x0 = this.x, y0 = this.y, dy = toY - y0;
    if (dy <= 0) return;
    const T = (-vy + Math.sqrt(vy * vy + 2 * g * dy)) / g;
    const v0 = Math.max(60, Math.hypot(vx, vy));
    // Continuity: the stream keeps the width it had when it left, and thins only as it speeds up from there.
    const last = this.samples[this.samples.length - 1];
    // A pour gathers: the stream that leaves an edge is at least as wide as a fall.
    const hw0 = Math.max(last ? last.hw / this.wScale : 0, WATER.width.fall);
    let t = 0;
    while (t < T) {
      const v = Math.hypot(vx, vy + g * t);
      t = Math.min(T, t + Math.max(0.002, WATER.step / Math.max(v, 1)));
      const x = x0 + vx * t, y = y0 + vy * t + 0.5 * g * t * t;
      const speed = Math.hypot(vx, vy + g * t);
      const hw = hw0 * Math.max(0.58, Math.sqrt(v0 / speed));
      this.push(x, y, 'fall', hw, y - y0, Math.hypot(x - this.x, y - this.y) / Math.max(speed, 1));
    }
  }

  // A fall that lands at (x, y): the horizontal speed is whatever reaches it.
  fallTo(x: number, y: number, vy: number, g: number): void {
    const dy = y - this.y;
    if (dy <= 0) { this.lineTo(x, y, 'run'); return; }
    const T = (-vy + Math.sqrt(vy * vy + 2 * g * dy)) / g;
    this.fall((x - this.x) / T, vy, y, g);
  }

  clone(): Pen {
    const p = new Pen(this.x, this.y, this.s, this.f, this.wScale);
    return p;
  }
}

function normals(samples: Sample[]): void {
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    const a = samples[Math.max(0, i - 2)], b = samples[Math.min(n - 1, i + 2)];
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
    samples[i].nx = -ty / l;
    samples[i].ny = tx / l;
  }
}

export function buildRoute(anchors: readonly Anchor[], o: RouteOptions): Route {
  const g = o.gravity ?? WATER.gravity;
  const wScale = o.narrow ? WATER.narrowScale : 1;
  const gutter = o.narrow ? WATER.narrowGutter : WATER.gutter;
  const branches: Branch[] = [];
  const landings: Landing[] = [];
  const pools: Pool[] = [];
  const touch: Route['touch'] = [];
  let nextId = 0;
  let pen = new Pen(o.start.x, o.start.y, 0, 0, wScale);
  const close = (p: Pen) => { if (p.samples.length > 1) branches.push({ id: nextId++, samples: p.samples }); };
  // Wide: a fixed distance outside the column. Narrow: the middle of the margin, which is all the room a phone has.
  const gutterX = (side: 'left' | 'right', r: Rect) => (o.narrow
    ? (side === 'left' ? Math.min(r.left, o.column.left) / 2 : (Math.max(r.right, o.column.right) + o.width) / 2)
    : (side === 'left' ? Math.min(r.left, o.column.left) - gutter : Math.max(r.right, o.column.right) + gutter));
  // A landing ends the falling strand at the impact; the sheet that spreads from it is a new strand. The splash
  // covers the join, as it does on real water, and no ribbon has to turn a right angle.
  const restart = () => { close(pen); pen = new Pen(pen.x, pen.y, pen.s, pen.f, wScale); };
  const avoid = o.avoid ?? [];
  // Run down the page to (x, y). If a block lies across the way, get to x in the clear space above it first.
  // Run down the page to (x, y), going round any block of text on the way: beside it, on the side nearer the target,
  // then across in the clear space below it.
  // How far a run beside text or in a gutter may meander: none on a phone, never nearer the text or the page edge.
  const meander = (x: number) => (o.narrow ? 0 : Math.max(0, Math.min(WATER.wander.amp, WATER.clear - 18, x - 18, o.width - 18 - x)));
  // Beside a block: its clearance from the text, but never nearer the page edge than the middle of the margin.
  const besideX = (r: Rect, left: boolean) => (left
    ? Math.max(r.left / 2, r.left - WATER.clear)
    : Math.min((o.width + r.right) / 2, r.right + WATER.clear));
  const travel = (p: Pen, x: number, y: number) => {
    const blocks = avoid.filter((r) => r.bottom > p.y + 8 && r.top < y - 8).sort((m, n) => m.top - n.top);
    for (const r of blocks) {
      const lo = r.left - 10, hi = r.right + 10;
      const inNow = p.x > lo && p.x < hi, inAt = (q: number) => q > lo && q < hi;
      const crosses = inNow || inAt(x) || (p.x <= lo && x >= hi) || (p.x >= hi && x <= lo);
      if (!crosses) continue;
      const side = besideX(r, x < (r.left + r.right) / 2);
      if (Math.abs(p.x - side) > 1) p.curveTo(side, Math.max(p.y + 24, r.top - 28), 'run');
      // A target further out on this side is reached straight away, moving away from the block: no need to go down
      // beside it first and cross at the last moment.
      const outside = side < r.left ? x <= side : x >= side;
      if (!outside && p.y < r.bottom + 18) p.wander(side, Math.min(y - 4, r.bottom + 18), meander(side));
    }
    p.curveTo(x, y, 'run');
  };
  // Approach a landing point from above: run to a point over it, then fall the last stretch.
  const arrive = (p: Pen, x: number, y: number) => {
    const room = y - p.y;
    const h = Math.max(Math.min(24, room), Math.min(WATER.maxFall, room * 0.42));
    if (room - h > 4) travel(p, x, y - h);
    // Water arrives at the run's own speed, so the fall starts with no pinch.
    p.fallTo(x, y, WATER.speed.run * 0.9, g);
  };

  const sorted = [...anchors].sort((a, b) => a.rect.top - b.rect.top);
  let ended = false;
  for (const a of sorted) {
    const r = a.rect;
    if (a.kind === 'weave') {
      // A line through something (behind the portrait) needs room above it to come in gently; with too little (the
      // portrait at the very top of a page) the water keeps to its own gutter and passes it by.
      if (a.x !== undefined && r.top - pen.y < Math.max(220, Math.abs(a.x - pen.x) * 0.45)) continue;
      const x = a.x ?? gutterX(a.side ?? 'right', r);
      // Never back up the page: a weave that starts above the water joins it where it already is.
      const y0 = Math.max(r.top, pen.y + (Math.abs(x - pen.x) > 1 ? WATER.crossDrop : 0));
      travel(pen, x, y0);
      pen.lineTo(x, r.bottom + 16, 'run');
      touch.push({ anchor: a.id, x, y: (r.top + r.bottom) / 2, s: pen.s });
    } else if (a.kind === 'corner') {
      const land = a.side ?? 'right';
      const dir: 1 | -1 = land === 'right' ? -1 : 1;
      const lx = land === 'right' ? r.right - WATER.landInset : r.left + WATER.landInset;
      const ly = r.top - WATER.lip;
      arrive(pen, lx, ly);
      landings.push({ x: lx, y: ly, s: pen.s, f: pen.f, dir, strength: 1, anchor: a.id });
      touch.push({ anchor: a.id, x: lx, y: ly, s: pen.s });
      restart();
      const ex = dir > 0 ? r.right - 6 : r.left + 6;
      pen.lineTo(ex, ly, 'surface');
      const v = pen.cling(dir, 6);
      touch.push({ anchor: `${a.id}:pour`, x: pen.x, y: pen.y, s: pen.s });
      pen.fall(v.vx, v.vy, a.fall ? pen.y + a.fall : Math.min(r.bottom + 40, pen.y + WATER.maxFall), g);
    } else if (a.kind === 'edge' && a.from && a.to) {
      const dir: 1 | -1 = a.to.x >= a.from.x ? 1 : -1;
      arrive(pen, a.from.x, a.from.y - WATER.lip);
      landings.push({ x: a.from.x, y: a.from.y - WATER.lip, s: pen.s, f: pen.f, dir, strength: 1, anchor: a.id });
      touch.push({ anchor: a.id, x: a.from.x, y: a.from.y, s: pen.s });
      restart();
      pen.lineTo(a.to.x - dir * 6, a.to.y - WATER.lip, 'surface');
      const v = pen.cling(dir, 6);
      // It falls free, but never into the next block of text: it stops above it, and the route goes round it.
      const below = avoid.filter((q) => q.top > pen.y + 10 && pen.x > q.left - 20 && pen.x < q.right + 20).sort((m, n) => m.top - n.top)[0];
      pen.fall(v.vx, v.vy, Math.max(pen.y + 24, Math.min(r.bottom + 60, pen.y + WATER.maxFall, below ? below.top - 70 : Infinity)), g);
    } else if (a.kind === 'split') {
      const cx = (r.left + r.right) / 2;
      const ly = r.top - WATER.lip;
      // From straight above and not far (the city's water onto the work title) it is one clean fall, with no run first.
      const room = ly - pen.y;
      if (Math.abs(pen.x - cx) < 8 && room > 4 && room <= WATER.maxFall * 2) pen.fallTo(cx, ly, WATER.speed.run * 0.9, g);
      else arrive(pen, cx, ly);
      landings.push({ x: cx, y: ly, s: pen.s, f: pen.f, dir: 0, strength: 1.25, anchor: a.id });
      touch.push({ anchor: a.id, x: cx, y: ly, s: pen.s });
      close(pen);
      const frame = a.frame ?? r;
      // A bar set in from its frame: each pour lands on the top corner of the frame's outer card, rounds the corner,
      // clings down the card edges and turns in under the frame. The halves meet behind the control under it (join),
      // which hides the meeting, and one stream leaves from there.
      if (a.frame && r.left - frame.left > 10 && frame.right - r.right > 10 && frame.top - ly > 30) {
        const sill = a.join ? (a.join.top + a.join.bottom) / 2 : frame.bottom + (o.narrow ? 46 : 72);
        const ends: Pen[] = [];
        for (const dir of [-1, 1] as const) {
          const side = dir > 0 ? 'R' : 'L';
          const p = pen.clone();
          const ex = dir > 0 ? r.right - 6 : r.left + 6;
          const corner = dir > 0 ? frame.right : frame.left;
          const fy = frame.top - WATER.lip;
          p.lineTo(ex, ly, 'surface');
          // It lets go of the end as steeply as it must for its own arc to come down on the card, at least 8 in from
          // the corner: a longer drop needs a steeper start. The fall then follows that arc, so there is no kink.
          const arcX = (turn: number) => {
            const vv = WATER.speed.surface * 0.95, vx = Math.cos(turn) * vv, vy = Math.sin(turn) * vv;
            const T = (-vy + Math.sqrt(vy * vy + 2 * g * Math.max(1, fy - ly - 6 * (1 - Math.cos(turn))))) / g;
            return ex + dir * (6 * Math.sin(turn) + vx * T);
          };
          let turn = Math.PI / 3;
          while (turn < 1.5 && dir * (corner - arcX(turn)) < 8) turn += 0.03;
          const v = p.cling(dir, 6, turn);
          touch.push({ anchor: `${a.id}:pour${side}`, x: p.x, y: p.y, s: p.s });
          const lx = corner - dir * Math.min(34, Math.max(8, dir * (corner - arcX(turn))));
          p.fallTo(lx, fy, v.vy, g);
          landings.push({ x: lx, y: fy, s: p.s, f: p.f, dir, strength: 0.8, anchor: `${a.id}:land${side}` });
          touch.push({ anchor: `${a.id}:land${side}`, x: lx, y: fy, s: p.s });
          close(p);
          const q = new Pen(p.x, p.y, p.s, p.f, wScale);
          q.lineTo(corner - dir * 6, fy, 'surface');
          // Radius 12 from 6 inside the corner: it comes round to 6 outside the card's edge and runs down it, gathering
          // into a fuller sheet than a corner's cling, since this run is the frame of the wall.
          q.cling(dir, 12, Math.PI / 2);
          q.lineTo(q.x, frame.bottom + 4, 'cling', WATER.width.side);
          touch.push({ anchor: `${a.id}:side${side}`, x: q.x, y: (frame.top + frame.bottom) / 2, s: q.s });
          q.bendTo(cx + dir * 3, sill, Math.max(8, Math.min(o.narrow ? 22 : 44, sill - q.y - 2)));
          ends.push(q);
        }
        for (const q of ends) close(q);
        const s = Math.max(...ends.map((q) => q.s)), f = Math.max(...ends.map((q) => q.f));
        pen = new Pen(cx, sill, s, f, wScale);
        touch.push({ anchor: `${a.id}:join`, x: cx, y: sill, s });
        continue;
      }
      // Low enough below the section that the two halves curve in gently, never hook.
      // Low enough below the section that the halves curve in gently, but above the next block of text.
      const nextText = avoid.filter((q) => q.top > frame.bottom + 20).sort((m, n) => m.top - n.top)[0];
      const joinY = Math.min(frame.bottom + (o.narrow ? 140 : 260), nextText ? Math.max(frame.bottom + 70, nextText.top - 40) : Infinity);
      // On a phone the halves join in the left margin, where the stream goes on: the right half crosses under the
      // section in the gap. On wide screens they meet in the middle under it.
      const jx = o.narrow ? gutterX('left', { ...frame, left: Math.min(r.left, frame.left), right: Math.max(r.right, frame.right) }) : cx;
      const ends: Pen[] = [];
      for (const dir of [-1, 1] as const) {
        const p = pen.clone();
        const ex = dir > 0 ? r.right - 6 : r.left + 6;
        p.lineTo(ex, ly, 'surface');
        const v = p.cling(dir, 6);
        touch.push({ anchor: `${a.id}:pour${dir > 0 ? 'R' : 'L'}`, x: p.x, y: p.y, s: p.s });
        const fx = o.narrow ? gutterX(dir > 0 ? 'right' : 'left', { ...frame, left: Math.min(r.left, frame.left), right: Math.max(r.right, frame.right) }) : dir > 0 ? Math.max(r.right, frame.right) + 14 : Math.min(r.left, frame.left) - 14;
        // It leaves the end along the cling's tangent, falls free, then runs into the gutter beside the section.
        p.fall(v.vx, v.vy, ly + (o.narrow ? 50 : 70), g);
        p.curveTo(fx, Math.min(frame.top + 140, frame.bottom), 'run');
        p.lineTo(fx, frame.bottom + 18, 'run');
        if (o.narrow && dir < 0) p.lineTo(jx, joinY, 'run');
        else p.curveTo(jx + (o.narrow ? 0 : dir * 3), joinY, 'run');
        ends.push(p);
      }
      for (const p of ends) close(p);
      // Wide: the mirror halves meet together. Phone: the left half carries straight on and the right comes in later as a
      // tributary, so the stream never waits at the join.
      const s = o.narrow ? ends[0].s : Math.max(...ends.map((p) => p.s));
      const f = o.narrow ? ends[0].f : Math.max(...ends.map((p) => p.f));
      pen = new Pen(jx, joinY, s, f, wScale);
      touch.push({ anchor: `${a.id}:join`, x: jx, y: joinY, s });
    } else if (a.kind === 'pool' && a.at) {
      // Handed to a piece: it comes level into the piece's edge, which carries it on.
      const inward = a.at.x <= (r.left + r.right) / 2 ? 1 : -1;
      const room = inward > 0 ? a.at.x - 8 : o.width - 8 - a.at.x;
      const bend = Math.max(6, Math.min(34, (room - 8) / 1.6));
      travel(pen, a.at.x - inward * Math.min(bend + 30, room), a.at.y - bend - 40);
      pen.bendTo(a.at.x + inward * 6, a.at.y, bend);
      touch.push({ anchor: a.id, x: a.at.x, y: a.at.y, s: pen.s });
      ended = true;
      break;
    } else if (a.kind === 'pool') {
      const cx = (r.left + r.right) / 2;
      const py = r.top + (r.bottom - r.top) * 0.62;
      travel(pen, cx, py - 14);
      pen.lineTo(cx, py, 'run');
      pools.push({ x: cx, y: py, rx: (r.right - r.left) * 0.42, ry: Math.max(14, (r.right - r.left) * 0.12), s: pen.s, f: pen.f, anchor: a.id });
      landings.push({ x: cx, y: py, s: pen.s, f: pen.f, dir: 0, strength: 0.55, anchor: `${a.id}:in` });
      touch.push({ anchor: a.id, x: cx, y: py, s: pen.s });
      ended = true;
      break;
    }
  }
  if (!ended && o.endY > pen.y + 40) {
    // To the foot of the page, round any text still below (the ledger under a desk, the footer).
    const under = avoid.filter((q) => q.bottom > pen.y + 8 && q.top < o.endY && pen.x > q.left - 20 && pen.x < q.right + 20).sort((m, n) => m.top - n.top)[0];
    const x = under ? besideX(under, pen.x < (under.left + under.right) / 2) : pen.x;
    if (under) travel(pen, x, o.endY);
    else pen.wander(x, o.endY, meander(x));
  }
  close(pen);
  for (const b of branches) normals(b.samples);
  const total = Math.max(0, ...branches.map((b) => b.samples[b.samples.length - 1].s));
  return { branches, landings, pools, total, touch };
}

// For each y down the page, the furthest distance along the route at or above it. The head follows the scroll by this.
export function headTable(route: Route): { ys: Float64Array; ss: Float64Array } {
  const pts: [number, number][] = [];
  for (const b of route.branches) for (const p of b.samples) pts.push([p.y, p.s]);
  pts.sort((a, b) => a[0] - b[0]);
  const ys = new Float64Array(pts.length), ss = new Float64Array(pts.length);
  let mx = 0;
  pts.forEach(([y, s], i) => { mx = Math.max(mx, s); ys[i] = y; ss[i] = mx; });
  return { ys, ss };
}

export function headAt(table: { ys: Float64Array; ss: Float64Array }, y: number): number {
  const { ys, ss } = table;
  if (!ys.length || y < ys[0]) return 0;
  let lo = 0, hi = ys.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ys[m] <= y) lo = m; else hi = m - 1; }
  return ss[lo];
}

// The distance along the route the front has reached after flowing for t seconds (it speeds up in falls).
export function sAtFlowTime(route: Route, f: number): number {
  let best = 0;
  for (const b of route.branches) {
    const ss = b.samples;
    if (!ss.length || ss[0].f > f) continue;
    let lo = 0, hi = ss.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ss[m].f <= f) lo = m; else hi = m - 1; }
    const a = ss[lo], c = ss[Math.min(ss.length - 1, lo + 1)];
    const k = c.f > a.f ? Math.min(1, (f - a.f) / (c.f - a.f)) : 0;
    best = Math.max(best, a.s + (c.s - a.s) * k);
  }
  return best;
}

// Every sample that lies inside a rect, grown by margin: the route must cross no text.
export function crossings(route: Route, rects: readonly Rect[], margin = 4): { x: number; y: number; rect: number }[] {
  const out: { x: number; y: number; rect: number }[] = [];
  for (const b of route.branches) for (const p of b.samples) {
    rects.forEach((r, i) => {
      const w = p.hw;
      if (p.x + w > r.left - margin && p.x - w < r.right + margin && p.y > r.top - margin && p.y < r.bottom + margin) out.push({ x: p.x, y: p.y, rect: i });
    });
  }
  return out;
}

// Largest turn between consecutive samples, in radians, away from corners the water is meant to round.
export function maxKink(route: Route): number {
  let worst = 0;
  for (const b of route.branches) {
    const s = b.samples;
    for (let i = 2; i < s.length; i++) {
      const a1 = Math.atan2(s[i - 1].y - s[i - 2].y, s[i - 1].x - s[i - 2].x);
      const a2 = Math.atan2(s[i].y - s[i - 1].y, s[i].x - s[i - 1].x);
      let d = Math.abs(a2 - a1);
      if (d > Math.PI) d = 2 * Math.PI - d;
      worst = Math.max(worst, d);
    }
  }
  return worst;
}
