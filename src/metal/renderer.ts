import { LAMP } from '../config/site';
import { registry, stats } from '../hooks/registry';
import { lamp } from '../lamp/lamp';
import { clock } from '../world/clock';
import { tiers } from '../world/tier';
import { FINISHES, INK } from './finishes';
import { MASK_FONTS, paintMask, type Mask, type PlateSpec } from './mask';
import { distanceField } from './sdf';
import { BAKE, LIGHT, VERT } from './shaders';

export interface PlatePhoto {
  src: string; // an image URL, or a video URL when video is true
  video?: boolean;
  focus?: [number, number]; // which part of the picture stays in view when it is cropped, 0 to 1
  zoom?: number; // 1 covers the window; more crops in further around the focus
}

export interface PlateEntry {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  spec: PlateSpec;
  photo?: PlatePhoto;
  onState?: (state: 'ready' | 'failed') => void;
}

interface Plate extends PlateEntry {
  ctx: CanvasRenderingContext2D;
  cssW: number;
  cssH: number;
  dpr: number;
  mask: Mask | null;
  b0: WebGLTexture | null;
  b1: WebGLTexture | null;
  photoTex: WebGLTexture | null;
  photoAspect: number;
  videoEl: HTMLVideoElement | null;
  visible: boolean;
  bakeGen: number;
  sig: string;
  tilt: { x: number; y: number; gx: number; gy: number };
  water: { x: number; y: number; z: number; k: number };
  seed: number;
}

type GL = WebGL2RenderingContext;

// A plate's scratches and patina come from its own words, so the same plate always looks the same.
function seedOf(spec: PlateSpec): number {
  const s = [spec.finish, spec.kind, spec.label, spec.big, spec.facts].join('|');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 1 + ((h >>> 0) % 10000) / 997;
}

function compile(gl: GL, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`metal shader: ${gl.getShaderInfoLog(s)}`);
  return s;
}

function program(gl: GL, frag: string) {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(p, 0, 'a');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`metal program: ${gl.getProgramInfoLog(p)}`);
  const u = new Map<string, WebGLUniformLocation | null>();
  return { p, u: (name: string) => { if (!u.has(name)) u.set(name, gl.getUniformLocation(p, name)); return u.get(name)!; } };
}

function texture(gl: GL, w: number, h: number, internal: number, format: number, type: number, data: ArrayBufferView | null, filter: number): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

const DESIGN_MM = { thick: 3.4, bevel: 5.2, cutDepth: 1.7, cutWall: 0.95, panelDepth: 2.4, raise: 2.4, windowDepth: 20 };

// The one plate renderer: a single WebGL2 context, off the page, that draws every plate and copies it to the plate's
// own canvas. Plates bake once per size and redraw only when the lamp, their place in the viewport, the water or
// their tilt changed.
class PlateRenderer {
  private gl: GL | null = null;
  private glCanvas: HTMLCanvasElement | null = null;
  private bake: ReturnType<typeof program> | null = null;
  private light: ReturnType<typeof program> | null = null;
  private quad: WebGLVertexArrayObject | null = null;
  private plates = new Set<Plate>();
  private io: IntersectionObserver | null = null;
  private ro: ResizeObserver | null = null;
  private byHost = new Map<Element, Plate>();
  private started = false;
  private broken = false;
  private fontsReady: Promise<unknown> | null = null;
  frameMs = 0;

  private init(): boolean {
    if (this.gl) return true;
    if (this.broken || typeof document === 'undefined') return false;
    try {
      const c = document.createElement('canvas');
      c.width = 4;
      c.height = 4;
      const gl = c.getContext('webgl2', { premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true, alpha: true, powerPreference: 'high-performance' });
      if (!gl) throw new Error('no webgl2');
      if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) { /* the bake writes RGBA8 only; floats are only read */ }
      this.gl = gl;
      this.glCanvas = c;
      this.bake = program(gl, BAKE);
      this.light = program(gl, LIGHT);
      this.quad = gl.createVertexArray();
      gl.bindVertexArray(this.quad);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost(); });
      this.io = new IntersectionObserver((entries) => {
        for (const en of entries) { const p = this.byHost.get(en.target); if (p) { p.visible = en.isIntersecting; p.sig = ''; } }
      }, { rootMargin: '300px 0px' });
      this.ro = new ResizeObserver((entries) => {
        for (const en of entries) { const p = this.byHost.get(en.target); if (p) this.measure(p); }
      });
      this.fontsReady = Promise.all(MASK_FONTS.map((f) => document.fonts.load(f))).catch(() => undefined);
      return true;
    } catch {
      this.broken = true;
      this.gl = null;
      return false;
    }
  }

  private lost(): void {
    this.broken = true;
    for (const p of this.plates) p.onState?.('failed');
  }

  private start(): void {
    if (this.started) return;
    this.started = true;
    clock.onFrame(() => this.frame());
    tiers.subscribe(() => { for (const p of this.plates) this.measure(p); });
    registry.onFreeze((t) => (t === null ? this.resumeVideos() : this.seekVideos(t)));
  }

  add(entry: PlateEntry): () => void {
    if (!this.init()) { entry.onState?.('failed'); return () => undefined; }
    const ctx = entry.canvas.getContext('2d');
    if (!ctx) { entry.onState?.('failed'); return () => undefined; }
    const p: Plate = {
      ...entry, ctx, cssW: 0, cssH: 0, dpr: 1, mask: null, b0: null, b1: null, photoTex: null, photoAspect: 1, videoEl: null,
      visible: false, bakeGen: 0, sig: '', tilt: { x: 0, y: 0, gx: 0, gy: 0 }, water: { x: 0, y: 0, z: 26, k: 0 },
      seed: seedOf(entry.spec),
    };
    this.plates.add(p);
    this.byHost.set(entry.host, p);
    this.io!.observe(entry.host);
    this.ro!.observe(entry.host);
    if (entry.photo) this.loadPhoto(p, entry.photo);
    this.measure(p);
    this.start();
    return () => this.remove(p);
  }

  private remove(p: Plate): void {
    this.plates.delete(p);
    this.byHost.delete(p.host);
    this.io?.unobserve(p.host);
    this.ro?.unobserve(p.host);
    const gl = this.gl;
    if (gl) { if (p.b0) gl.deleteTexture(p.b0); if (p.b1) gl.deleteTexture(p.b1); if (p.photoTex) gl.deleteTexture(p.photoTex); }
    p.videoEl?.pause();
    p.bakeGen++;
  }

  // Tilt toward the cursor, a few degrees, eased in frame().
  setTilt(host: Element, x: number, y: number): void {
    const p = this.byHost.get(host);
    if (p) { p.tilt.gx = x; p.tilt.gy = y; }
  }

  // The water near a plate: where it is (viewport CSS px) and how much it lights it, 0 to 1.
  setWater(host: Element, x: number, y: number, k: number): void {
    const p = this.byHost.get(host);
    if (p) { p.water.x = x; p.water.y = y; p.water.k = k; }
  }

  private loadPhoto(p: Plate, photo: PlatePhoto): void {
    if (photo.video) {
      const v = document.createElement('video');
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.crossOrigin = 'anonymous';
      v.src = photo.src;
      p.videoEl = v;
      registry.track(new Promise<void>((resolve) => {
        v.addEventListener('loadeddata', () => { p.photoAspect = v.videoWidth / v.videoHeight || 16 / 9; resolve(); }, { once: true });
        v.addEventListener('error', () => resolve(), { once: true });
      }));
      v.play().catch(() => undefined);
      return;
    }
    const im = new Image();
    im.decoding = 'async';
    im.src = photo.src;
    registry.track(im.decode().then(() => {
      const gl = this.gl;
      if (!gl) return;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const ext = gl.getExtension('EXT_texture_filter_anisotropic');
      if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
      p.photoTex = t;
      p.photoAspect = im.naturalWidth / im.naturalHeight;
      p.sig = '';
    }).catch(() => undefined));
  }

  private measure(p: Plate): void {
    const r = p.host.getBoundingClientRect();
    // Plates keep crisp words: the device's own ratio up to 3x, except on the low tier (1.5x). They redraw only on change.
    const dpr = Math.min(devicePixelRatio || 1, tiers.get() === 'low' ? 1.5 : 3);
    const cssW = Math.round(r.width * 100) / 100;
    const cssH = Math.round(r.height * 100) / 100;
    if (cssW < 4 || cssH < 4) return;
    if (cssW === p.cssW && cssH === p.cssH && dpr === p.dpr && p.mask) return;
    p.cssW = cssW;
    p.cssH = cssH;
    p.dpr = dpr;
    const gen = ++p.bakeGen;
    registry.track(this.rebake(p, gen));
  }

  private async rebake(p: Plate, gen: number): Promise<void> {
    await this.fontsReady;
    if (gen !== p.bakeGen || !this.gl) return;
    const mask = paintMask(p.spec, p.cssW, p.cssH, p.dpr);
    const rg = await distanceField(mask.glyphs, mask.panel, mask.w, mask.h);
    if (gen !== p.bakeGen || !this.gl) return;
    const gl = this.gl;
    const sdf = texture(gl, mask.w, mask.h, gl.RG16F, gl.RG, gl.FLOAT, rg, gl.LINEAR);
    if (p.b0) gl.deleteTexture(p.b0);
    if (p.b1) gl.deleteTexture(p.b1);
    p.b0 = texture(gl, mask.w, mask.h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR);
    p.b1 = texture(gl, mask.w, mask.h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, p.b0, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, p.b1, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    const b = this.bake!;
    gl.useProgram(b.p);
    gl.bindVertexArray(this.quad);
    gl.viewport(0, 0, mask.w, mask.h);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sdf);
    gl.uniform1i(b.u('uSdf'), 0);
    this.common(b, p, mask);
    const F = FINISHES[p.spec.finish];
    const S = mask.S;
    gl.uniform1i(b.u('uFinish'), F.id);
    gl.uniform1f(b.u('uThick'), DESIGN_MM.thick * S);
    gl.uniform1f(b.u('uBevel'), DESIGN_MM.bevel * S);
    // Fine lettering at low pixel density gets a shallower cut, so its shading does not thicken or double the strokes.
    gl.uniform1f(b.u('uCutDepth'), DESIGN_MM.cutDepth * S * Math.min(1, Math.max(0.45, (S - 0.35) / 1.3)));
    gl.uniform1f(b.u('uCutWall'), Math.max(0.55, DESIGN_MM.cutWall * S));
    gl.uniform1f(b.u('uPanelDepth'), DESIGN_MM.panelDepth * S);
    gl.uniform1f(b.u('uRaise'), DESIGN_MM.raise * S);
    gl.uniform1f(b.u('uGrain'), p.spec.kind === 'control' ? Math.max(F.grain, 0.05) : F.grain);
    gl.uniform1f(b.u('uPatina'), F.patina);
    gl.uniform1f(b.u('uScratch'), F.scratch * (p.spec.kind === 'control' ? 0.25 : 1));
    gl.uniform1f(b.u('uPillow'), p.spec.kind === 'control' ? 5 * S : 0);
    gl.uniform1f(b.u('uSeed'), p.seed);
    const sc = new Float32Array(24);
    mask.screws.slice(0, 6).forEach((s, i) => sc.set(s, i * 4));
    gl.uniform4fv(b.u('uScrew'), sc);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(sdf);
    p.mask = mask;
    p.canvas.width = mask.w;
    p.canvas.height = mask.h;
    p.sig = '';
    if (this.glCanvas!.width < mask.w || this.glCanvas!.height < mask.h) {
      this.glCanvas!.width = Math.max(this.glCanvas!.width, mask.w);
      this.glCanvas!.height = Math.max(this.glCanvas!.height, mask.h);
    }
    this.draw(p, true);
    p.onState?.('ready');
  }

  private common(prog: ReturnType<typeof program>, p: Plate, mask: Mask): void {
    const gl = this.gl!;
    gl.uniform2f(prog.u('uRes'), mask.w, mask.h);
    gl.uniform1f(prog.u('uS'), mask.S);
    gl.uniform1f(prog.u('uRad'), mask.radius);
    gl.uniform1f(prog.u('uInset'), 1.5 * mask.S);
    const win = mask.win ?? [0, 0, 1, 1];
    gl.uniform4f(prog.u('uWin'), win[0], win[1], win[2], win[3]);
    gl.uniform1f(prog.u('uWinOn'), mask.win ? 1 : 0);
    gl.uniform1f(prog.u('uWinR'), mask.winR);
    gl.uniform1f(prog.u('uWinDepth'), DESIGN_MM.windowDepth * mask.S);
  }

  private frame(): void {
    if (!this.gl || this.broken) return;
    const t0 = performance.now();
    const frozen = clock.isFrozen();
    const k = frozen ? 1 : 0.14;
    // Every plate's place is read before anything is written, so the page lays out once a frame, not once a plate.
    const rects = new Map<Plate, DOMRect>();
    for (const p of this.plates) if (p.visible && p.mask) rects.set(p, p.host.getBoundingClientRect());
    for (const p of this.plates) {
      const dx = p.tilt.gx - p.tilt.x;
      const dy = p.tilt.gy - p.tilt.y;
      if (Math.abs(dx) + Math.abs(dy) > 1e-5) {
        p.tilt.x += dx * k;
        p.tilt.y += dy * k;
        p.canvas.style.transform = `rotateX(${(p.tilt.x * 57.2958).toFixed(3)}deg) rotateY(${(p.tilt.y * 57.2958).toFixed(3)}deg)`;
      }
    }
    for (const [p, r] of rects) this.draw(p, false, r);
    this.frameMs = performance.now() - t0;
    stats.metalMs = this.frameMs;
    stats.plates = this.plates.size;
  }

  private draw(p: Plate, force: boolean, rect?: DOMRect): void {
    const gl = this.gl!;
    const mask = p.mask!;
    const r = rect ?? p.host.getBoundingClientRect();
    const L = lamp.get();
    const video = p.videoEl && p.videoEl.readyState >= 2;
    const sig = [Math.round(L.px), Math.round(L.py), Math.round(r.left), Math.round(r.top), clock.view.w, clock.view.h,
      p.tilt.x.toFixed(3), p.tilt.y.toFixed(3), p.water.k.toFixed(3), Math.round(p.water.x), Math.round(p.water.y), !!p.photoTex,
      video ? p.videoEl!.currentTime.toFixed(3) : ''].join();
    if (!force && sig === p.sig) return;
    if (tiers.get() === 'static' && p.sig && !force) return;
    p.sig = sig;
    if (video) this.uploadVideo(p);
    const l = this.light!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(l.p);
    gl.bindVertexArray(this.quad);
    gl.viewport(0, 0, mask.w, mask.h);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, p.b0); gl.uniform1i(l.u('uB0'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, p.b1); gl.uniform1i(l.u('uB1'), 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, p.photoTex ?? p.b0); gl.uniform1i(l.u('uPhoto'), 2);
    this.common(l, p, mask);
    gl.uniform1f(l.u('uDpr'), p.dpr);
    gl.uniform2f(l.u('uOrigin'), r.left, r.top);
    gl.uniform2f(l.u('uView'), clock.view.w, clock.view.h);
    gl.uniform3f(l.u('uLamp'), L.px, L.py, LAMP.depth * Math.max(clock.view.w, clock.view.h * 0.8));
    gl.uniform1f(l.u('uLampI'), 1.15 + 0.3 * L.led);
    // A portrait's glass glares softly: the lamp's spot should not sit on a face.
    gl.uniform1f(l.u('uGlare'), p.spec.kind === 'frame' ? 0.06 : 1);
    gl.uniform3f(l.u('uWater'), p.water.x, p.water.y, p.water.z);
    gl.uniform1f(l.u('uWaterI'), p.water.k * 8.0);
    gl.uniform2f(l.u('uTilt'), p.tilt.x, p.tilt.y);
    const F = FINISHES[p.spec.finish];
    gl.uniform3fv(l.u('uF0a'), F.a);
    gl.uniform3fv(l.u('uF0b'), F.b);
    gl.uniform3fv(l.u('uInk'), INK);
    gl.uniform1f(l.u('uRa'), F.ra);
    gl.uniform1f(l.u('uRb'), F.rb);
    gl.uniform1f(l.u('uAniso'), F.aniso);
    gl.uniform1f(l.u('uPhotoAspect'), p.photoAspect);
    gl.uniform1f(l.u('uPhotoOn'), p.photoTex ? 1 : 0);
    const focus = p.photo?.focus ?? [0.5, 0.3];
    gl.uniform2f(l.u('uPhotoFocus'), focus[0], focus[1]);
    gl.uniform1f(l.u('uPhotoZoom'), p.photo?.zoom ?? 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    p.ctx.clearRect(0, 0, mask.w, mask.h);
    p.ctx.drawImage(this.glCanvas!, 0, this.glCanvas!.height - mask.h, mask.w, mask.h, 0, 0, mask.w, mask.h);
    p.host.style.setProperty('--lamp-dx', ((r.left + r.width / 2 - L.px) / clock.view.w).toFixed(3));
    p.host.style.setProperty('--lamp-dy', ((r.top + r.height / 2 - L.py) / clock.view.h).toFixed(3));
  }

  private uploadVideo(p: Plate): void {
    const gl = this.gl!;
    const v = p.videoEl!;
    if (!p.photoTex) {
      p.photoTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, p.photoTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D, p.photoTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
  }

  // Frozen clock: the video shows the frame at t, so a shot of it is repeatable.
  async seekVideos(t: number): Promise<void> {
    const waits: Promise<void>[] = [];
    for (const p of this.plates) {
      const v = p.videoEl;
      if (!v || !v.duration) continue;
      v.pause();
      const target = t % v.duration;
      if (Math.abs(v.currentTime - target) < 1e-3) continue;
      waits.push(new Promise((res) => { v.addEventListener('seeked', () => res(), { once: true }); v.currentTime = target; }));
    }
    await Promise.all(waits);
    for (const p of this.plates) p.sig = '';
  }

  resumeVideos(): void {
    for (const p of this.plates) p.videoEl?.play().catch(() => undefined);
  }

  count(): number {
    return this.plates.size;
  }
}

export const plates = new PlateRenderer();
