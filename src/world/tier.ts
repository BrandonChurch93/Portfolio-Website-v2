import { TIER_PROBE, type Tier } from '../config/site';
import { chooseTier } from './tier-choice';

type Listener = (t: Tier) => void;

// A short GPU timing test: a full screen fragment shader with a fixed loop, drawn a number of frames, timed with a
// read back so the GPU must finish. Returns milliseconds per frame, or null if WebGL is missing.
function probeGpu(): { webgl: boolean; ms: number | null } {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
  if (!gl) return { webgl: false, ms: null };
  try {
    const vs = '#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    const fs = '#version 300 es\nprecision highp float;out vec4 o;uniform float u;void main(){vec2 p=gl_FragCoord.xy/512.;float s=0.;for(int i=0;i<64;i++){p=fract(p*1.37+vec2(.13,.71)+u);s+=sin(p.x*31.+p.y*17.);}o=vec4(vec3(s*.01),1.);}';
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(prog, 0, 'a');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return { webgl: true, ms: null };
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const u = gl.getUniformLocation(prog, 'u');
    const px = new Uint8Array(4);
    gl.uniform1f(u, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now();
    for (let i = 0; i < TIER_PROBE.frames; i++) {
      gl.uniform1f(u, i * 0.01);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const ms = (performance.now() - t0) / TIER_PROBE.frames;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { webgl: true, ms };
  } catch {
    return { webgl: true, ms: null };
  }
}

class TierStore {
  private tier: Tier = 'high';
  private measured: Tier | null = null;
  private forced: Tier | null = null;
  private listeners = new Set<Listener>();
  probeMs: number | null = null;

  detect(): Tier {
    if (this.measured || typeof window === 'undefined') return this.get();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const probe = reducedMotion ? { webgl: !!document.createElement('canvas').getContext('webgl2'), ms: null } : probeGpu();
    this.probeMs = probe.ms;
    const nav = navigator as Navigator & { deviceMemory?: number };
    this.measured = chooseTier({
      reducedMotion,
      webgl: probe.webgl,
      probeMs: probe.ms,
      memoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
      width: innerWidth,
      height: innerHeight,
      dpr: devicePixelRatio || 1,
    });
    this.set();
    return this.get();
  }

  get(): Tier {
    return this.tier;
  }

  // Test hook: force a tier, or null to go back to the measured one.
  force(t: Tier | null): void {
    this.forced = t;
    this.set();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.tier);
    return () => this.listeners.delete(fn);
  }

  private set(): void {
    const next = this.forced ?? this.measured ?? 'high';
    if (next === this.tier && this.listeners.size) return;
    this.tier = next;
    document.documentElement.dataset.tier = next;
    for (const fn of this.listeners) fn(next);
  }
}

export const tiers = new TierStore();
