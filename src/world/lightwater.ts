import * as THREE from 'three';

// Light-water for 3D pieces: the site's golden water drawn inside a scene, so where it crosses a piece the two agree
// on depth. A strip of rows along a path; each vertex carries its distance along the route (for the wet front),
// its travel time (so the flow pattern moves at the water's own speed and stretches in falls), the distance fallen,
// and a seed. Additive, no depth write.

export interface WaterRow { c: THREE.Vector3; side: THREE.Vector3; w: number; s: number; f: number; d?: number; seed?: number }

const VS = /* glsl */ `
attribute vec4 flow;
attribute float lane;
varying vec4 vFlow; varying float vLane;
void main(){ vFlow = flow; vLane = lane; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Falls turn to face the camera about their own axis, so a fall seen edge on still has width.
const FALL_VS = /* glsl */ `
attribute vec4 flow;
attribute float lane;
attribute vec3 tang;
attribute float wid;
varying vec4 vFlow; varying float vLane;
void main(){
  vFlow = flow; vLane = lane;
  vec4 w = modelMatrix * vec4(position, 1.0);
  float sc = length(modelMatrix[0].xyz);
  vec3 T = normalize(mat3(modelMatrix) * tang);
  vec3 side = normalize(cross(T, normalize(cameraPosition - w.xyz)));
  w.xyz += side * lane * wid * 0.5 * sc;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FS = /* glsl */ `
uniform float uTime, uFill, uGain, uFall;
varying vec4 vFlow; varying float vLane;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * noise(p); p = p * 2.07 + 13.7; a *= 0.5; } return s; }
void main(){
  float reveal = smoothstep(uFill + 2.0, uFill - 30.0, vFlow.x);
  if (reveal <= 0.0) discard;
  float v = vLane, av = abs(v);
  float u = (vFlow.y - uTime) * 60.0 + vFlow.w * 31.0;
  // The same water as the page's: a lens of light with a core thread and two braided threads, fine caustics, sparse
  // glints and a rim that catches light, carried at the water's own speed (u runs at 60 a second here).
  float dk = uFall * clamp(vFlow.z / 200.0, 0.0, 1.0);
  float avn = av / (1.0 - 0.3 * dk);
  float body = smoothstep(1.0, 0.5, avn);
  float lens = 1.0 - avn * avn;
  float wa = noise(vec2(u * 0.024, uTime * 0.11 + vFlow.w)) - 0.5, wb = noise(vec2(u * 0.036 + 17.0, uTime * 0.13)) - 0.5;
  float core = exp(-pow((v - wa * 0.5) / 0.3, 2.0));
  float thA = exp(-pow((v - 0.55 * sin(u * 0.072 + wa * 4.0)) / 0.1, 2.0));
  float thB = exp(-pow((v + 0.5 * sin(u * 0.056 + 1.9 + wb * 4.0)) / 0.085, 2.0));
  float a = fbm(vec2(u * 0.064, v * 1.6 + uTime * 0.2));
  float r1 = pow(1.0 - abs(2.0 * a - 1.0), 6.0);
  float glint = smoothstep(0.86, 0.985, noise(vec2(u * 0.44 + 4.0, v * 4.0 + uTime * 0.8))) * smoothstep(0.95, 0.4, avn);
  float rim = exp(-pow((avn - 0.78) / 0.12, 2.0));
  float edge = smoothstep(0.62, 0.9, av) * smoothstep(1.02, 0.88, av) * (1.0 - uFall);
  float I = min(1.6, body * (0.42 * lens + 0.8 * core + 0.55 * thA + 0.45 * thB + r1 * 0.32 + glint * 1.2 + rim * 0.38) + edge * 0.22);
  float tear = noise(vec2(v * 4.0 + vFlow.w * 7.0, u * 0.012)) * 0.6 + noise(vec2(v * 11.0 - vFlow.w, u * 0.03)) * 0.4;
  float strands = smoothstep(0.2 + 0.4 * dk, 0.32 + 0.4 * dk, tear);
  I *= mix(1.0, strands * (1.2 + 0.5 * dk), uFall * smoothstep(5.0, 50.0, vFlow.z));
  float head = exp(-pow((uFill - vFlow.x) / 22.0, 2.0)) * 1.2;
  vec3 c = mix(vec3(1.0, 0.34, 0.05), vec3(1.0, 0.56, 0.16), smoothstep(0.35, 1.2, I));
  c = mix(c, vec3(1.0, 0.78, 0.46), smoothstep(1.3, 2.4, I));
  gl_FragColor = vec4(c * (I + head) * uGain * reveal, 1.0);
}`;

export function waterMaterial(gain: number, fall = false): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    vertexShader: fall ? FALL_VS : VS, fragmentShader: FS,
    uniforms: { uTime: { value: 0 }, uFill: { value: 1e6 }, uGain: { value: gain }, uFall: { value: fall ? 1 : 0 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  m.userData.gain = gain;
  return m;
}

// A flat strip through rows: across each row from -w/2 to w/2 along its side direction.
export function waterStrip(rows: WaterRow[], across = 6): THREE.BufferGeometry {
  const pos: number[] = [], flow: number[] = [], lane: number[] = [], idx: number[] = [];
  for (const row of rows) for (let i = 0; i <= across; i++) {
    const k = i / across - 0.5;
    pos.push(row.c.x + row.side.x * row.w * k, row.c.y + row.side.y * row.w * k, row.c.z + row.side.z * row.w * k);
    flow.push(row.s, row.f, row.d ?? 0, row.seed ?? 0);
    lane.push(k * 2);
  }
  return finish(pos, flow, lane, idx, rows.length, across);
}

// A fall as a ribbon about its centre line, turned to the camera in the vertex shader.
export function fallStrip(rows: WaterRow[], across = 4): THREE.BufferGeometry {
  const pos: number[] = [], flow: number[] = [], lane: number[] = [], tang: number[] = [], wid: number[] = [], idx: number[] = [];
  rows.forEach((row, j) => {
    const a = rows[Math.max(0, j - 1)].c, b = rows[Math.min(rows.length - 1, j + 1)].c;
    const t = b.clone().sub(a).normalize();
    for (let i = 0; i <= across; i++) {
      pos.push(row.c.x, row.c.y, row.c.z);
      flow.push(row.s, row.f, row.d ?? 0, row.seed ?? 0);
      lane.push((i / across - 0.5) * 2);
      tang.push(t.x, t.y, t.z);
      wid.push(row.w);
    }
  });
  const g = finish(pos, flow, lane, idx, rows.length, across);
  g.setAttribute('tang', new THREE.Float32BufferAttribute(tang, 3));
  g.setAttribute('wid', new THREE.Float32BufferAttribute(wid, 1));
  return g;
}

function finish(pos: number[], flow: number[], lane: number[], idx: number[], n: number, across: number): THREE.BufferGeometry {
  const W = across + 1;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < across; i++) { const a = j * W + i; idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 4));
  g.setAttribute('lane', new THREE.Float32BufferAttribute(lane, 1));
  g.setIndex(idx);
  return g;
}

// Thrown drops at a landing: stateless points, each from its seed and the clock, on ballistic arcs.
const DROP_VS = /* glsl */ `
attribute vec4 seed;
uniform float uTime, uPx, uG;
varying float vK;
void main(){
  float crown = step(0.55, fract(seed.x * 3.7));
  float v = mix(40.0 + seed.z * 90.0, 90.0 + seed.z * 70.0, crown), up = mix(0.5 + 0.45 * fract(seed.x * 7.31), 0.18 + 0.2 * fract(seed.x * 5.3), crown);
  float life = 2.0 * v * up / uG;
  float t = fract(uTime / life + seed.x) * life;
  float a = seed.y * 6.2831853;
  vec3 p = position + vec3(cos(a) * v * t * (1.0 - up * 0.6), v * up * t - 0.5 * uG * t * t, sin(a) * v * t * (1.0 - up * 0.6));
  vK = 1.0 - t / life;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = max(1.5, seed.w * uPx / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const DROP_FS = /* glsl */ `
uniform float uOp;
varying float vK;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float k = exp(-d * d * 4.0) * (0.35 + 0.65 * vK);
  gl_FragColor = vec4(vec3(1.0, 0.62, 0.28) * k * uOp * 1.6, 1.0);
}`;

export function dropsMaterial(g: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader: DROP_VS, fragmentShader: DROP_FS, uniforms: { uTime: { value: 0 }, uOp: { value: 1 }, uPx: { value: 400 }, uG: { value: g } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
}

export function dropsAt(points: THREE.Vector3[], perPoint: number, spread: number, size: [number, number], rnd: () => number): THREE.Points {
  const pos: number[] = [], sd: number[] = [];
  for (const p of points) for (let i = 0; i < perPoint; i++) { pos.push(p.x + (rnd() - 0.5) * spread, p.y, p.z + (rnd() - 0.5) * spread); sd.push(rnd(), rnd(), rnd(), size[0] + rnd() * (size[1] - size[0])); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.Float32BufferAttribute(sd, 4));
  const pts = new THREE.Points(g, undefined);
  pts.frustumCulled = false;
  pts.userData.noWire = true;
  return pts;
}

// The pixel scale for drops: how many device pixels a model unit is at unit distance.
export function dropScale(camera: THREE.PerspectiveCamera, heightPx: number, unit: number): number {
  return (heightPx * 0.5) / Math.tan((camera.fov * Math.PI) / 360) * unit;
}

// A crown at a landing: a ring wall of water whose height and edge flicker, torn into fingers. Uses uTime and uFill
// like the water, so it rises only once the water reaches it (seed is its distance along the route).
const CROWN_VS = /* glsl */ `uniform float uH; varying float vH; varying float vA; void main(){ vH = clamp(position.y / uH, 0.0, 1.0); vA = atan(position.z, position.x); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const CROWN_FS = /* glsl */ `
uniform float uTime, uFill, uGain, uSeed, uAt;
varying float vH; varying float vA;
float ch(float x){ return fract(sin(x * 127.1 + uSeed) * 43758.5453); }
float cn(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(ch(i), ch(i + 1.0), f); }
void main(){
  float on = smoothstep(uAt, uAt + 40.0, uFill);
  if (on <= 0.0) discard;
  float a = vA * 9.0;
  float top = 0.45 + 0.55 * cn(a + uTime * 3.1) * cn(a * 0.5 - uTime * 1.7 + 4.0);
  float fingers = smoothstep(0.25, 0.65, cn(a * 2.3 + uTime * 0.8));
  float k = smoothstep(top, top - 0.35, vH) * mix(0.35, 1.0, fingers) * smoothstep(0.0, 0.12, vH);
  float rim = exp(-pow((vH - top * 0.85) / 0.07, 2.0)) * fingers;
  vec3 c = mix(vec3(1.0, 0.5, 0.15), vec3(1.0, 0.8, 0.5), smoothstep(0.6, 1.0, k));
  gl_FragColor = vec4(c * (k * 0.7 + rim * 0.9) * uGain * on, 1.0);
}`;

export function crownMesh(rTop: number, rBase: number, h: number, seed: number, at = 0): THREE.Mesh {
  const g = new THREE.CylinderGeometry(rTop, rBase, h, 72, 1, true);
  g.translate(0, h / 2, 0);
  const m = new THREE.ShaderMaterial({ vertexShader: CROWN_VS, fragmentShader: CROWN_FS, uniforms: { uTime: { value: 0 }, uFill: { value: 1e6 }, uGain: { value: 0.9 }, uSeed: { value: seed }, uH: { value: h }, uAt: { value: at } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  m.userData.gain = 0.9;
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.userData.noWire = true;
  return mesh;
}

// Motes riding the flow along a straight stretch from A to B: each slides at the water's speed from its seed and the
// clock, a little off the centre line, and shows only where the water already is.
const RIDE_VS = /* glsl */ `
attribute vec4 seed;
uniform float uTime, uPx, uFill, uS0, uLen, uSpeed;
uniform vec3 uA, uB, uSide;
varying float vK;
void main(){
  float k = fract(uTime * uSpeed * (0.85 + 0.3 * seed.z) / uLen + seed.x);
  vec3 p = mix(uA, uB, k) + uSide * (seed.y - 0.5) * seed.w + vec3(0.0, 0.8, 0.0);
  vK = step(uS0 + k * uLen, uFill) * (0.5 + 0.5 * sin(seed.x * 40.0 + uTime * 6.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = max(1.5, (1.0 + 1.6 * seed.z) * uPx / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const RIDE_FS = /* glsl */ `
varying float vK;
void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float k = exp(-d * d * 4.0) * vK; if (k < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.72, 0.38) * k * 1.4, 1.0); }`;

export function riders(a: THREE.Vector3, b: THREE.Vector3, side: THREE.Vector3, width: number, s0: number, speed: number, n: number, rnd: () => number): THREE.Points {
  const pos = new Float32Array(n * 3), sd: number[] = [];
  for (let i = 0; i < n; i++) sd.push(rnd(), rnd(), rnd(), width);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.Float32BufferAttribute(sd, 4));
  const m = new THREE.ShaderMaterial({ vertexShader: RIDE_VS, fragmentShader: RIDE_FS, uniforms: { uTime: { value: 0 }, uPx: { value: 400 }, uFill: { value: 1e6 }, uS0: { value: s0 }, uLen: { value: a.distanceTo(b) }, uSpeed: { value: speed }, uA: { value: a.clone() }, uB: { value: b.clone() }, uSide: { value: side.clone().normalize() } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.userData.noWire = true;
  return pts;
}
