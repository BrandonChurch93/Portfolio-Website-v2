import { BREAKPOINT_ONE_COLUMN, READING_LINE, type Tier } from '../config/site';
import { registry, stats } from '../hooks/registry';
import { plates } from '../metal/renderer';
import { clock } from '../world/clock';
import { tiers } from '../world/tier';
import { readAnchors } from './anchors';
import { BODY_FS, BODY_VS, PART_FS, PART_VS, POOL_FS, POOL_VS } from './shaders';
import { buildRoute, headAt, headTable, sAtFlowTime, WATER, type Route, type Sample } from './route';

type GL = WebGL2RenderingContext;
type Prog = { p: WebGLProgram; u: (n: string) => WebGLUniformLocation | null };

function program(gl: GL, vs: string, fs: string): Prog {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`water shader: ${gl.getShaderInfoLog(s)}`);
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`water program: ${gl.getProgramInfoLog(p)}`);
  const cache = new Map<string, WebGLUniformLocation | null>();
  return { p, u: (n) => { if (!cache.has(n)) cache.set(n, gl.getUniformLocation(p, n)); return cache.get(n)!; } };
}

interface GpuBranch { vao: WebGLVertexArrayObject; buf: WebGLBuffer; count: number; startS: number; row: number; f0: number; f1: number; riders: number; samples: Sample[] }

export interface WaterOptions {
  approach?: 'a' | 'b';
  // Pages without a source get a stream entering from the top.
  entering?: boolean;
}

// Particle counts per tier: character stays, cost goes.
const BUDGET: Record<Tier, { riders: number; crown: number; drops: number; boil: number; sparks: number; halo: boolean }> = {
  high: { riders: 1, crown: 28, drops: 44, boil: 10, sparks: 26, halo: true },
  mid: { riders: 0.7, crown: 22, drops: 32, boil: 8, sparks: 18, halo: true },
  low: { riders: 0.4, crown: 16, drops: 20, boil: 5, sparks: 10, halo: false },
  static: { riders: 0.6, crown: 0, drops: 0, boil: 0, sparks: 0, halo: true },
};

const ROUTE_COLS = 512;

export class WaterSystem {
  private gl: GL;
  private body: Prog;
  private part: Prog;
  private pool: Prog;
  private branches: GpuBranch[] = [];
  private routeTex: WebGLTexture | null = null;
  private quad: WebGLVertexArrayObject;
  private emptyVao: WebGLVertexArrayObject;
  route: Route | null = null;
  private table: { ys: Float64Array; ss: Float64Array } | null = null;
  private head = 0;
  private headSpeed = 0;
  private forced: number | null = null;
  private startY = 0;
  private move: { fEntry: number; t: number } | null = null;
  private impacts = new Map<number, number>();
  private lights: { host: HTMLElement; near: { x: number; y: number; s: number; d: number; score: number }[] }[] = [];
  private unsub: (() => void)[] = [];
  private dpr = 1;
  private layoutTimer = 0;
  private approach: 'a' | 'b';
  frameMs = 0;

  constructor(private canvas: HTMLCanvasElement, private opts: WaterOptions = {}) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('water: no webgl2');
    this.gl = gl;
    this.approach = opts.approach ?? 'b';
    this.body = program(gl, BODY_VS, BODY_FS);
    this.part = program(gl, PART_VS, PART_FS);
    this.pool = program(gl, POOL_VS, POOL_FS);
    this.quad = gl.createVertexArray()!;
    gl.bindVertexArray(this.quad);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.pool.p, 'aQuad');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.emptyVao = gl.createVertexArray()!;
    gl.bindVertexArray(null);

    const relayout = () => { clearTimeout(this.layoutTimer); this.layoutTimer = window.setTimeout(() => this.layout(), 80); };
    const ro = new ResizeObserver(relayout);
    ro.observe(document.body);
    addEventListener('resize', relayout);
    document.fonts?.ready.then(() => this.layout());
    this.unsub.push(() => { ro.disconnect(); removeEventListener('resize', relayout); });
    this.unsub.push(clock.onFrame((t, dt) => this.frame(t, dt)));
    this.unsub.push(tiers.subscribe(() => this.layout()));
    registry.water({
      head: (v) => this.setHead(v),
      move: (name, t) => this.setMove(name, t),
    });
    this.layout();
  }

  destroy(): void {
    for (const u of this.unsub) u();
    registry.water(null);
    clearTimeout(this.layoutTimer);
    const gl = this.gl;
    for (const b of this.branches) { gl.deleteBuffer(b.buf); gl.deleteVertexArray(b.vao); }
    if (this.routeTex) gl.deleteTexture(this.routeTex);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  // ---- hooks ------------------------------------------------------------------------------------

  setHead(v: number | string | null): void {
    this.move = null;
    if (v === null) { this.forced = null; return; }
    if (!this.route) this.layout();
    const r = this.route!;
    if (typeof v === 'number') this.forced = Math.max(0, Math.min(1, v)) * r.total;
    else {
      const t = r.touch.find((p) => p.anchor === v);
      if (!t) throw new Error(`water.head: no anchor ${v}`);
      this.forced = t.s + 1;
    }
    this.head = this.forced;
    this.draw(clock.now());
  }

  // On /lab/water: scroll to the move's section and show it t seconds after the water reaches it.
  setMove(name: string, t: number): void {
    const el = document.getElementById(`move-${name}`);
    if (!el) throw new Error(`water.move: no section move-${name}`);
    // Land just below the nav, so nothing of the move sits under it.
    const nav = (document.querySelector('header') as HTMLElement | null)?.offsetHeight ?? 0;
    const top = Math.max(0, Math.round(el.getBoundingClientRect().top + scrollY - ('waterOffset' in el.dataset ? nav + (Number(el.dataset.waterOffset) || 24) : 0)));
    if (Math.abs(scrollY - top) > 0.5) window.scrollTo({ top, behavior: 'instant' });
    if (!this.route) this.layout();
    const r = this.route!;
    const key = el.dataset.waterTouch ?? `move-${name}`;
    const touch = r.touch.find((p) => p.anchor === key) ?? r.touch.find((p) => p.anchor.startsWith(key));
    const s = touch ? touch.s : 0;
    const lead = Number(el.dataset.waterLead ?? 0.4);
    this.move = { fEntry: this.fAt(s) - lead, t };
    this.forced = null;
    clock.freeze(t);
    this.draw(t);
  }

  // ---- layout -----------------------------------------------------------------------------------

  layout(): void {
    const { anchors, options } = readAnchors(document, BREAKPOINT_ONE_COLUMN);
    if (this.opts.entering) options.start = { x: options.start.x, y: 0 };
    this.startY = options.start.y;
    const route = buildRoute(anchors, options);
    this.route = route;
    this.table = headTable(route);
    this.upload(route);
    this.measureLights(route);
    this.resize();
    if (this.forced !== null) this.forced = Math.min(this.forced, route.total);
    this.draw(clock.now());
  }

  private resize(): void {
    const tier = tiers.get();
    this.dpr = Math.min(devicePixelRatio || 1, tier === 'high' ? 2 : tier === 'mid' ? 1.5 : 1);
    const w = Math.round(innerWidth * this.dpr), h = Math.round(innerHeight * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  private upload(route: Route): void {
    const gl = this.gl;
    for (const b of this.branches) { gl.deleteBuffer(b.buf); gl.deleteVertexArray(b.vao); }
    this.branches = [];
    const rows = Math.max(1, route.branches.length);
    const tex = new Float32Array(ROUTE_COLS * rows * 4);
    route.branches.forEach((br, row) => {
      const ss = br.samples;
      // Interleaved: pos 2, normal 2, d 4 (s, f, hw, kind), e 2 (side, drop). Two vertices per sample.
      const data = new Float32Array(ss.length * 2 * 10);
      ss.forEach((p, i) => {
        for (let j = 0; j < 2; j++) data.set([p.x, p.y, p.nx, p.ny, p.s, p.f, p.hw, p.kind, j ? 1 : -1, p.drop], (i * 2 + j) * 10);
      });
      const vao = gl.createVertexArray()!;
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const attr = (name: string, size: number, off: number) => {
        const l = gl.getAttribLocation(this.body.p, name);
        if (l < 0) return;
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, size, gl.FLOAT, false, 40, off * 4);
      };
      attr('aPos', 2, 0); attr('aNrm', 2, 2); attr('aD', 4, 4); attr('aE', 2, 8);
      gl.bindVertexArray(null);
      // Columns uniform in travel time, for motes that ride at the water's own speed.
      const f0 = ss[0].f, f1 = ss[ss.length - 1].f;
      let k = 0;
      for (let c = 0; c < ROUTE_COLS; c++) {
        const f = f0 + ((f1 - f0) * c) / (ROUTE_COLS - 1);
        while (k < ss.length - 2 && ss[k + 1].f < f) k++;
        const a = ss[k], b = ss[k + 1] ?? a;
        const m = b.f > a.f ? Math.min(1, Math.max(0, (f - a.f) / (b.f - a.f))) : 0;
        tex.set([a.x + (b.x - a.x) * m, a.y + (b.y - a.y) * m, a.s + (b.s - a.s) * m, a.hw + (b.hw - a.hw) * m], (row * ROUTE_COLS + c) * 4);
      }
      const len = ss[ss.length - 1].s - ss[0].s;
      this.branches.push({ vao, buf, count: ss.length * 2, startS: ss[0].s, row, f0, f1, riders: Math.min(220, Math.round(len / 18)), samples: ss });
    });
    if (this.routeTex) gl.deleteTexture(this.routeTex);
    this.routeTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.routeTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, ROUTE_COLS, rows, 0, gl.RGBA, gl.FLOAT, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  // Each lit plate takes the light of the nearest stretch of water.
  private measureLights(route: Route): void {
    this.lights = [];
    document.querySelectorAll<HTMLElement>('[data-finish]').forEach((host) => {
      const r = host.getBoundingClientRect();
      const box = { l: r.left + scrollX, t: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY };
      const near: { x: number; y: number; s: number; d: number; score: number }[] = [];
      const cy = (box.t + box.b) / 2, cx = (box.l + box.r) / 2;
      for (const br of route.branches) for (let i = 0; i < br.samples.length; i += 3) {
        const p = br.samples[i];
        const dx = Math.max(box.l - p.x, 0, p.x - box.r), dy = Math.max(box.t - p.y, 0, p.y - box.b);
        const d = Math.hypot(dx, dy);
        // Ties along a side go to the stretch nearest the plate's middle, which lights most of it.
        if (d < 220) near.push({ d, x: p.x, y: p.y, s: p.s, score: d + 0.35 * Math.hypot(p.x - cx, p.y - cy) * 0.5 });
      }
      if (near.length) this.lights.push({ host, near });
    });
  }

  // ---- per frame --------------------------------------------------------------------------------

  private fAt(s: number): number {
    if (!this.route) return 0;
    let f = 0;
    for (const b of this.route.branches) {
      const ss = b.samples;
      if (!ss.length || ss[0].s > s) continue;
      let lo = 0, hi = ss.length - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ss[m].s <= s) lo = m; else hi = m - 1; }
      f = Math.max(f, ss[lo].f);
    }
    return f;
  }

  private frame(t: number, dt: number): void {
    if (!this.route || document.hidden) return;
    const t0 = performance.now();
    const goal = this.goal();
    const before = this.head;
    if (clock.isFrozen() || this.forced !== null || this.move || tiers.get() === 'static') this.head = goal;
    else {
      const d = goal - this.head;
      this.head += Math.sign(d) * Math.min(Math.abs(d), Math.max(Math.abs(d) * dt * 4.5, dt * 700));
    }
    // In a move the front advances at the water's own speed, frozen clock or not.
    if (this.move) { const f = this.move.fEntry + this.move.t; this.headSpeed = (sAtFlowTime(this.route, f + 0.02) - this.head) / 0.02; }
    else this.headSpeed = dt > 0 ? Math.abs(this.head - before) / dt : 0;
    this.draw(t);
    this.frameMs = performance.now() - t0;
    stats.waterMs = this.frameMs;
  }

  private goal(): number {
    const r = this.route!;
    if (this.move) return sAtFlowTime(r, this.move.fEntry + this.move.t);
    if (this.forced !== null) return this.forced;
    if (tiers.get() === 'static' || matchMedia('(prefers-reduced-motion: reduce)').matches) return r.total;
    // Where the page has a source, the stream already runs on a little past it at the top of the page.
    return headAt(this.table!, Math.max(scrollY + innerHeight * READING_LINE, this.startY + innerHeight * 0.32));
  }

  // When the water reached a landing. Live, it is the moment the front crossed it; for frozen or forced states it is
  // worked out from the front's travel time, so a shot always shows the same moment.
  private impactTime(i: number, t: number): number {
    const L = this.route!.landings[i];
    if (this.head < L.s) { this.impacts.delete(i); return Infinity; }
    if (this.move) return L.f - this.move.fEntry;
    // At least 1.5 s ago: a page shot shows the landing as it is while water keeps arriving, past the first crown.
    if (this.forced !== null || clock.isFrozen()) return t - Math.max(1.5, this.fAt(this.head) - L.f);
    if (!this.impacts.has(i)) this.impacts.set(i, t);
    return this.impacts.get(i)!;
  }

  private draw(t: number): void {
    const gl = this.gl;
    const route = this.route;
    if (!route) return;
    this.resize();
    const tier = tiers.get();
    const budget = BUDGET[tier];
    const still = tier === 'static';
    const time = still ? 6 : t;
    const narrow = innerWidth < BREAKPOINT_ONE_COLUMN;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    const view = (p: Prog) => {
      gl.uniform2f(p.u('uView'), innerWidth, innerHeight);
      gl.uniform1f(p.u('uScroll'), scrollY);
    };

    // Halo, then the body.
    gl.useProgram(this.body.p);
    view(this.body);
    gl.uniform1f(this.body.u('uTime'), time);
    gl.uniform1f(this.body.u('uHead'), this.head);
    gl.uniform1f(this.body.u('uMode'), this.approach === 'a' ? 0 : 1);
    gl.uniform1f(this.body.u('uPhone'), narrow ? 1 : 0);
    for (const pass of budget.halo ? [1, 0] : [0]) {
      gl.uniform1f(this.body.u('uHalo'), pass);
      gl.uniform1f(this.body.u('uWiden'), pass ? 13 : 1.6);
      for (const b of this.branches) {
        gl.uniform1f(this.body.u('uStartS'), b.startS > 0 ? b.startS : -1e4);
        gl.bindVertexArray(b.vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, b.count);
      }
    }

    // Pools.
    gl.useProgram(this.pool.p);
    view(this.pool);
    gl.bindVertexArray(this.quad);
    for (const p of route.pools) {
      // The pool fills over a second and a half of flow: it spreads from the inflow, it does not appear.
      const wet = this.head < p.s - 1 ? 0 : Math.min(1, Math.max(0, this.flowSince(p.f) / 1.5));
      if (wet <= 0) continue;
      gl.uniform4f(this.pool.u('uPool'), p.x, p.y, p.rx, p.ry);
      gl.uniform1f(this.pool.u('uTime'), time);
      gl.uniform1f(this.pool.u('uWet'), wet);
      gl.uniform1f(this.pool.u('uKick'), 0);
      gl.uniform1f(this.pool.u('uKickTime'), 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // Particles.
    gl.useProgram(this.part.p);
    view(this.part);
    gl.bindVertexArray(this.emptyVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.routeTex);
    gl.uniform1i(this.part.u('uRoute'), 0);
    gl.uniform1i(this.part.u('uCols'), ROUTE_COLS);
    gl.uniform1f(this.part.u('uTime'), time);
    gl.uniform1f(this.part.u('uHead'), this.head);
    gl.uniform1f(this.part.u('uGravity'), WATER.gravity);
    gl.uniform1f(this.part.u('uShutter'), 1 / 110);
    gl.uniform1f(this.part.u('uScale'), narrow ? 0.75 : 1);
    const type = (n: number) => gl.uniform1i(this.part.u('uType'), n);
    type(0);
    for (const b of this.branches) {
      gl.uniform1i(this.part.u('uRow'), b.row);
      gl.uniform1f(this.part.u('uF0'), b.f0);
      gl.uniform1f(this.part.u('uF1'), b.f1);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, Math.round(b.riders * budget.riders));
    }
    if (!still) {
      const hp = this.headPoint();
      const moving = Math.min(1, this.headSpeed / 260);
      if (hp && moving > 0.02 && budget.sparks) {
        type(1);
        gl.uniform4f(this.part.u('uHeadPos'), hp.x, hp.y, hp.dx, hp.dy);
        gl.uniform1f(this.part.u('uHeadMove'), moving);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, budget.sparks);
      }
      route.landings.forEach((L, i) => {
        const y = L.y - scrollY;
        if (y < -300 || y > innerHeight + 300) return;
        const imp = this.impactTime(i, t);
        if (!Number.isFinite(imp)) return;
        gl.uniform4f(this.part.u('uLand'), L.x, L.y, imp, L.dir);
        gl.uniform1f(this.part.u('uLandStrength'), L.strength);
        if (this.approach === 'a') { type(6); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 30); return; }
        type(2); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, budget.crown * 5);
        type(3); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, budget.drops * 4);
        type(4); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 2);
        type(5); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, budget.boil);
      });
    }
    gl.bindVertexArray(null);
    this.light(time);
  }

  // Seconds of flow since the water reached travel time f.
  private flowSince(f: number): number {
    if (this.move) return clock.now() - (f - this.move.fEntry);
    if (this.forced !== null || clock.isFrozen()) return Math.max(1.5, this.fAt(this.head) - f);
    return this.fAt(this.head) - f + 2;
  }

  private headPoint(): { x: number; y: number; dx: number; dy: number } | null {
    for (const b of this.branches) {
      const ss = b.samples;
      if (ss[0].s > this.head || ss[ss.length - 1].s < this.head) continue;
      let lo = 0, hi = ss.length - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ss[m].s <= this.head) lo = m; else hi = m - 1; }
      const a = ss[Math.max(0, lo - 2)], p = ss[lo];
      const l = Math.hypot(p.x - a.x, p.y - a.y) || 1;
      return { x: p.x, y: p.y, dx: (p.x - a.x) / l, dy: (p.y - a.y) / l };
    }
    return null;
  }

  // Metal the water touches picks up its amber light, with falloff, a little alive as it flows.
  private light(t: number): void {
    stats.waterLit = this.lights.length;
    stats.waterLightMax = 0;
    for (const { host, near } of this.lights) {
      // The nearest stretch that is already wet lights the plate; until water reaches it, nothing does.
      let L = { d: Infinity, x: 0, y: 0, s: 0, score: Infinity };
      for (const p of near) if (p.s <= this.head && p.score < L.score) L = p;
      const k = Number.isFinite(L.d) ? Math.exp(-L.d / 140) * (0.88 + 0.12 * Math.sin(t * 2.3 + L.s * 0.01)) : 0;
      stats.waterLightMax = Math.max(stats.waterLightMax, k);
      plates.setWater(host, L.x - scrollX, L.y - scrollY, k);
    }
  }

  // How much the water lights a point of the page (page px), for 3D pieces.
  lightAt(x: number, y: number, radius = 200): number {
    if (!this.route) return 0;
    let best = 0;
    for (const b of this.branches) for (let i = 0; i < b.samples.length; i += 4) {
      const p = b.samples[i];
      if (p.s > this.head) break;
      best = Math.max(best, Math.exp(-Math.hypot(p.x - x, p.y - y) / radius));
    }
    return best;
  }
}
