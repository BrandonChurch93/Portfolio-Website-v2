import * as THREE from 'three';
import { Builder, at, cyl, fin, interp, lathe, loft, rbox, ring, seeded, slab, wall, xf, type Section } from '../../world/build';
import { interiorMaterial } from '../../world/interior';
import { panelize } from '../../world/panels';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { grid, lawn, paving } from './textures';
import { cityLight, cityLightUniforms, organic } from './glow';

// The floating city, in millimetres (the root is scaled by 0.001). Park level of the outer lawn is y = 0; terraces step
// up to the spire. +z faces the viewer; the main canal runs to the front and its fall is the start of the page's water.

export const CITY = { R: 456, LIFT: 200, L0: 0, L1: 9, L2: 19, L3: 31, SCALE: 0.001 } as const;
const { R, L0, L1, L2, L3 } = CITY;
const D2R = Math.PI / 180;
const pol = (r: number, deg: number): [number, number] => [r * Math.sin(deg * D2R), r * Math.cos(deg * D2R)];
export const CANALS = [0, 72, -72, 144, -144];
// The water moves at the city's scale, not the model's: a scene gravity and a canal speed chosen so a fall off the
// rim takes about two thirds of a second and reads heavy, as a big fall seen from far away does.
const VCANAL = 50, G = 900, FALL_T = Math.sqrt((2 * CITY.LIFT) / G), LAND = R + 4 + VCANAL * FALL_T;

export interface Rise { group: THREE.Group; t0: number; dur: number; height: number }
export interface Mover { mesh: THREE.InstancedMesh; update: (t: number) => void }

export interface CityModel {
  root: THREE.Group;
  city: THREE.Group;
  rises: Rise[];
  movers: Mover[];
  water: THREE.ShaderMaterial[];
  falls: THREE.ShaderMaterial;
  plan: THREE.ShaderMaterial;
  slab: THREE.MeshStandardMaterial;
  pools: THREE.ShaderMaterial[];
  spray: THREE.ShaderMaterial;
  mists: THREE.SpriteMaterial[];
  crowns: THREE.ShaderMaterial[];
  rooms: THREE.MeshStandardMaterial[];
  glow: ReturnType<typeof cityLightUniforms>;
  glowLights: THREE.PointLight[];
  tris: number;
}

// flow: distance along the route (mm), travel time (s), distance fallen (mm, 0 off the falls), a seed per strand.
const WATER_VS = /* glsl */ `
attribute vec4 flow;
attribute float lane;
varying vec4 vFlow; varying float vLane; varying vec3 vW;
void main(){ vFlow = flow; vLane = lane; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const WATER_FS = /* glsl */ `
uniform float uTime, uFill, uGain, uFall;
varying vec4 vFlow; varying float vLane; varying vec3 vW;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * noise(p); p = p * 2.07 + 13.7; a *= 0.5; } return s; }
void main(){
  float reveal = smoothstep(uFill + 2.0, uFill - 30.0, vFlow.x);
  if (reveal <= 0.0) discard;
  float v = vLane, av = abs(v);
  float u = (vFlow.y - uTime) * 60.0 + vFlow.w * 31.0;
  float a = fbm(vec2(u * 0.022, v * 2.4 + vFlow.w));
  float b = fbm(vec2(u * 0.06 + 9.0, v * 4.2 - uTime * 0.15));
  float streak = pow(1.0 - abs(2.0 * a - 1.0), 4.0);
  float glint = pow(1.0 - abs(2.0 * b - 1.0), 8.0);
  // Falls narrow at the core and tear into strands the further they drop.
  float dk = uFall * clamp(vFlow.z / 200.0, 0.0, 1.0);
  float body = smoothstep(1.0, 0.75, av / (1.0 - 0.3 * dk));
  float edge = smoothstep(0.55, 0.92, av) * smoothstep(1.05, 0.9, av) * (1.0 - uFall);
  float I = body * (0.55 + 0.75 * streak + 0.6 * glint) + edge * 0.45;
  float tear = noise(vec2(v * 5.0 + vFlow.w * 7.0, u * 0.015));
  I *= mix(1.0, smoothstep(0.15 + 0.45 * dk, 0.45 + 0.4 * dk, tear) * 1.4, uFall * smoothstep(5.0, 60.0, vFlow.z));
  // White water at the foot of each cascade.
  I += (1.0 - uFall) * smoothstep(3.0, 11.0, vFlow.z) * body * (0.9 + 0.8 * glint);
  float head = exp(-pow((uFill - vFlow.x) / 22.0, 2.0)) * 1.2;
  vec3 c = mix(vec3(1.0, 0.45, 0.1), vec3(1.0, 0.66, 0.26), smoothstep(0.3, 1.1, I));
  c = mix(c, vec3(1.0, 0.78, 0.46), smoothstep(1.3, 2.4, I));
  gl_FragColor = vec4(c * (I + head) * uGain * reveal, 1.0);
}`;

// Falls are ribbons turned about their own axis to face the camera, so a fall seen from the side still has width.
const FALL_VS = /* glsl */ `
attribute vec4 flow;
attribute float lane;
attribute vec3 tang;
attribute float wid;
varying vec4 vFlow; varying float vLane; varying vec3 vW;
void main(){
  vFlow = flow; vLane = lane;
  vec4 w = modelMatrix * vec4(position, 1.0);
  float sc = length(modelMatrix[0].xyz);
  vec3 T = normalize(mat3(modelMatrix) * tang);
  vec3 side = normalize(cross(T, normalize(cameraPosition - w.xyz)));
  w.xyz += side * lane * wid * 0.5 * sc;
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// Where a fall lands: a glow, rings running out from the impact, a bright core.
const POOL_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const POOL_FS = /* glsl */ `
uniform float uTime, uOp, uSeed;
varying vec2 vUv;
void main(){
  vec2 q = vUv - 0.5;
  float r = length(q) * 2.0, a = atan(q.y, q.x);
  float rings = 0.0;
  for (int i = 0; i < 4; i++){
    float ph = fract(uTime * 0.42 + float(i) * 0.25 + uSeed);
    float rr = 0.08 + ph * 0.85 + 0.015 * sin(a * 7.0 + uTime * 1.3 + float(i));
    rings += exp(-pow((r - rr) / (0.018 + ph * 0.03), 2.0)) * (1.0 - ph) * (1.0 - ph);
  }
  float base = exp(-r * r * 6.0);
  float core = exp(-r * r * 90.0);
  vec3 c = vec3(1.0, 0.42, 0.1) * (base * 0.85 + rings * 0.55) + vec3(1.0, 0.72, 0.4) * core * 1.6;
  gl_FragColor = vec4(c * uOp * (1.0 - smoothstep(0.8, 1.0, r)), 1.0);
}`;

// Spray thrown up where a fall lands: stateless, each drop from its seed and the clock.
const SPRAY_VS = /* glsl */ `
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
  gl_PointSize = max(1.0, seed.w * uPx / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const SPRAY_FS = /* glsl */ `
uniform float uOp;
varying float vK;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float k = exp(-d * d * 4.0) * (0.35 + 0.65 * vK);
  gl_FragColor = vec4(vec3(1.0, 0.62, 0.28) * k * uOp * 1.6, 1.0);
}`;

// The crown at a landing: a ring wall of water whose height and edge flicker, torn into fingers.
const CROWN_VS = /* glsl */ `uniform float uH; varying float vH; varying float vA; void main(){ vH = clamp(position.y / uH, 0.0, 1.0); vA = atan(position.z, position.x); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const CROWN_FS = /* glsl */ `
uniform float uTime, uOp, uSeed;
varying float vH; varying float vA;
float ch(float x){ return fract(sin(x * 127.1 + uSeed) * 43758.5453); }
float cn(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(ch(i), ch(i + 1.0), f); }
void main(){
  float a = vA * 9.0;
  float top = 0.45 + 0.55 * cn(a + uTime * 3.1) * cn(a * 0.5 - uTime * 1.7 + 4.0);
  float fingers = smoothstep(0.25, 0.65, cn(a * 2.3 + uTime * 0.8));
  float k = smoothstep(top, top - 0.35, vH) * mix(0.35, 1.0, fingers) * smoothstep(0.0, 0.12, vH);
  vec3 c = mix(vec3(1.0, 0.5, 0.15), vec3(1.0, 0.82, 0.55), smoothstep(0.6, 1.0, k));
  gl_FragColor = vec4(c * k * uOp * 0.9, 1.0);
}`;

// Drops riding down each fall on its own parabola, spreading as they go.
const RIDER_VS = /* glsl */ `
attribute vec4 seed;
attribute vec2 dir;
uniform float uTime, uPx, uG, uV, uT;
varying float vK;
void main(){
  float tt = fract(uTime / uT + seed.x) * uT;
  vec3 d3 = vec3(dir.x, 0.0, dir.y), side = vec3(dir.y, 0.0, -dir.x);
  float k = tt / uT;
  float spread = (seed.y - 0.5) * seed.w * 0.85 * (1.0 + 0.45 * k);
  float v = uV * (0.9 + 0.35 * seed.z);
  vec3 p = position + d3 * v * tt + side * spread + vec3(0.0, -0.5 * uG * tt * tt, 0.0);
  vK = 1.0 - 0.45 * k;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = max(1.0, (0.8 + 1.2 * seed.z) * uPx / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

// The plan of the city drawn in light on the ground at the start: outlines appear as a front sweeps out.
const PLAN_FS = /* glsl */ `
uniform float uDraw, uFade, uR;
varying vec4 vFlow; varying float vLane; varying vec3 vW;
void main(){
  float r = length(vW.xz) / uR;
  float front = smoothstep(uDraw + 0.02, uDraw - 0.08, r);
  float line = 1.0 - smoothstep(0.35, 1.0, abs(vLane));
  float hot = exp(-pow((uDraw - r) / 0.03, 2.0));
  gl_FragColor = vec4(vec3(1.0, 0.5, 0.15) * line * (front * 0.9 + hot * 2.2) * uFade, 1.0);
}`;

function waterMaterial(gain: number, fall = 0, vs = WATER_VS): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: vs, fragmentShader: WATER_FS,
    uniforms: { uTime: { value: 0 }, uFill: { value: 1e6 }, uGain: { value: gain }, uFall: { value: fall } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

interface Row { c: THREE.Vector3; side: THREE.Vector3; w: number; s: number; f: number; d?: number; seed?: number }

// A strip of water through rows of (center, across direction, width, distance, travel time, distance fallen).
function strip(rows: Row[], across: number): THREE.BufferGeometry {
  const pos: number[] = [], flow: number[] = [], lane: number[] = [], idx: number[] = [];
  for (const row of rows) for (let i = 0; i <= across; i++) {
    const k = i / across - 0.5;
    pos.push(row.c.x + row.side.x * row.w * k, row.c.y + row.side.y * row.w * k, row.c.z + row.side.z * row.w * k);
    flow.push(row.s, row.f, row.d ?? 0, row.seed ?? 0);
    lane.push(k * 2);
  }
  const W = across + 1;
  for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < across; i++) { const a = j * W + i; idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 4));
  g.setAttribute('lane', new THREE.Float32BufferAttribute(lane, 1));
  g.setIndex(idx);
  return g;
}

export function buildCity(): CityModel {
  const r = seeded(20261110);
  const root = new THREE.Group();
  root.scale.setScalar(CITY.SCALE);
  const city = new THREE.Group();
  root.add(city);
  const rises: Rise[] = [];
  const movers: Mover[] = [];
  const rooms: THREE.MeshStandardMaterial[] = [];
  let tris = 0;

  // ---- materials ---------------------------------------------------------------------------------
  const P = (o: THREE.MeshPhysicalMaterialParameters, name: string) => { const m = new THREE.MeshPhysicalMaterial(o); m.name = name; return m; };
  const ivory = panelize(P({ color: 0xe6dccb, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }, 'ivory'), { scale: CITY.SCALE, size: [16, 10], depth: 0.3 });
  const stone = panelize(P({ color: 0xc9bca6, roughness: 0.72 }, 'stone'), { scale: CITY.SCALE, size: [9, 3], depth: 0.3, vary: 0.1 });
  const brass = P({ color: 0xd0a45a, metalness: 1, roughness: 0.36 }, 'brass');
  const domeBrass = panelize(P({ color: 0xc89a52, metalness: 1, roughness: 0.5 }, 'domeBrass'), { scale: CITY.SCALE, size: [6, 4], depth: 0.25, vary: 0.1 });
  const bronze = panelize(P({ color: 0x8a5c33, metalness: 1, roughness: 0.4 }, 'bronze'), { scale: CITY.SCALE, size: [24, 12], depth: 0.35, vary: 0.12 });
  const dark = P({ color: 0x2c221a, metalness: 0.85, roughness: 0.45 }, 'mullion');
  const rimPanel = panelize(P({ color: 0x7a5230, metalness: 1, roughness: 0.48 }, 'rimPanel'), { scale: CITY.SCALE, size: [9, 7], depth: 0.4, vary: 0.14 });
  const bed = P({ color: 0x1a120c, metalness: 0.9, roughness: 0.32 }, 'bed');
  const plazaM = P({ map: paving('#a8987e', '#9d8d73', '#6e6150', 11), roughness: 0.62 }, 'plaza');
  const terraceM = P({ map: paving('#8f7a5c', '#857154', '#5e4e3a', 12), roughness: 0.66 }, 'terrace');
  const promM = P({ map: paving('#9c8a6a', '#928062', '#665740', 13), roughness: 0.6 }, 'prom');
  for (const m of [plazaM, terraceM, promM]) m.map!.repeat.set(1 / 30, 1 / 30);
  const lawnM = P({ map: lawn(14), roughness: 0.93 }, 'lawn');
  lawnM.map!.repeat.set(1 / 60, 1 / 60);
  const glowWarm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb468).multiplyScalar(1.7) });
  glowWarm.name = 'glowWarm';
  const skyGlass = P({ color: 0x3a2a1a, metalness: 0.2, roughness: 0.08, emissive: 0xffa860, emissiveIntensity: 0.35, envMapIntensity: 1.5 }, 'skylight');
  const slit = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb26a).multiplyScalar(1.5) });
  slit.name = 'slit';
  const lampHead = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc27a).multiplyScalar(4) });
  lampHead.name = 'lampHead';
  const beacon = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a3a).multiplyScalar(6) });
  beacon.name = 'beacon';
  // Light from the water and the street lamps onto everything built or planted near them.
  const glowU = cityLightUniforms();
  const layout = { scale: CITY.SCALE, radius: R, levels: [L0, L1, L2, L3] as [number, number, number, number], steps: [102, 232, 292] as [number, number, number], canals: CANALS, canalWidth: (main: boolean) => (main ? 20 : 13), moat: { r: 85, w: 11 }, lamps: { r: R - 30, y: L0 + 11.6, every: 6, offset: 3 } };
  for (const mm of [ivory, stone, plazaM, terraceM, promM, lawnM, bed]) cityLight(mm, glowU, layout);
  organic(lawnM, 'lawn');
  for (const pm of [plazaM, terraceM, promM]) organic(pm, 'paving');
  const roomsM = (seed: number, warmth: number, lit = 0.72) => { const m = interiorMaterial({ scale: CITY.SCALE, warmth, lit, seed, gain: 1.7 }); rooms.push(m); return m; };

  // ---- the disc and its terraces ---------------------------------------------------------------------
  const base = new Builder();
  base.add(ring(0, 104, L3, 96), plazaM, undefined, { uv: 'box', tile: 1 });
  base.add(ring(102, 234, L2, 160), terraceM, undefined, { uv: 'box' });
  base.add(ring(232, 292, L1, 192), promM, undefined, { uv: 'box' });
  base.add(ring(290, R - 40, L0, 220), lawnM, undefined, { uv: 'box' });
  base.add(ring(R - 42, R - 8, L0 + 0.3, 256), promM, undefined, { uv: 'box' });
  for (const [rr, y0, y1] of [[102, L2, L3], [232, L1, L2], [292, L0, L1]] as [number, number, number][]) {
    base.add(wall(rr, y0, y1 + 0.2, 160), stone, undefined, { uv: 'box', tile: 1 });
    base.add(ring(rr - 2.4, rr + 0.8, y1 + 0.5, 160), ivory);
    base.add(wall(rr + 0.8, y1, y1 + 0.5, 160), ivory);
  }
  // The rim and the underside: a bronze lathe with a lit seam, brass ribs and a brass cap.
  // The underside steps in to a keel, each step edged with a lit ring, so the disc reads as a made thing from below.
  base.add(lathe([[0, -150], [42, -150], [60, -130], [150, -124], [172, -102], [268, -96], [292, -76], [R - 50, -72], [R - 16, -64], [R + 2.5, -45], [R + 2.5, -16], [R + 0.6, -15], [R + 0.6, -11], [R + 2.5, -10], [R + 2.5, 1.5], [R + 1, 3.4], [R - 8, 3.4], [R - 8, 0.3]], 220), bronze);
  base.add(ring(R - 8.6, R + 2, 3.6, 256), brass);
  for (let a = 0; a < 360; a += 6) { const [x, z] = pol(R + 3, a); base.add(rbox(1.6, a % 30 === 0 ? 30 : 24, 1.2, 0.3), brass, xf({ p: [x, -31, z], r: [0, a * D2R, 0] })); }
  for (const [rr, y] of [[61.5, -131], [173.5, -103], [293.5, -77]] as [number, number][]) { const t = new THREE.TorusGeometry(rr, 1.1, 6, 200); t.rotateX(Math.PI / 2); base.add(t, glowWarm, at(0, y, 0), { shadow: false }); }
  // Ribs under each step of the keel and a ring of small lights.
  for (const [r0, r1, y] of [[64, 148, -128.5], [176, 266, -100.5], [296, R - 52, -74.5]] as [number, number, number][]) for (let a = 0; a < 360; a += 10) { const [x, z] = pol((r0 + r1) / 2, a + 5); base.add(rbox(1.6, 2.2, r1 - r0, 0.4), bronze, xf({ p: [x, y, z], r: [0, (a + 5) * D2R, 0] })); }
  for (let a = 0; a < 360; a += 5) { const [x, z] = pol(222, a); base.add(new THREE.SphereGeometry(0.9, 8, 6), glowWarm, at(x, -100.5, z), { shadow: false }); }
  // Rim panels between the ribs, a little proud of the band, in a darker bronze.
  for (let a = 0; a < 360; a += 6) { const [x, z] = pol(R + 2.9, a + 3); base.add(rbox((Math.PI * 2 * R) / 60 - 9, 22, 1, 0.3), rimPanel, xf({ p: [x, -31, z], r: [0, a * D2R + 3 * D2R, 0] })); }
  // Rails on the terrace edges and the rim, with posts.
  for (const [rr, y] of [[R - 11, L0 + 0.3], [290, L1], [230, L2], [100, L3]] as [number, number][]) {
    const t = new THREE.TorusGeometry(rr, 0.35, 6, 220);
    t.rotateX(Math.PI / 2);
    base.add(t, brass, at(0, y + 5.2, 0));
    const n = Math.round((rr * Math.PI * 2) / 14);
    for (let i = 0; i < n; i++) { const [x, z] = pol(rr, (i / n) * 360); base.add(cyl(0.3, 5.2, 6), brass, at(x, y + 2.6, z)); }
  }
  const seamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff9a38).multiplyScalar(3) });
  seamMat.name = 'seam';
  base.add(wall(R + 1.4, -13.6, -11.4, 256), seamMat, undefined, { shadow: false });
  const baseGroup = new THREE.Group();
  city.add(baseGroup);
  base.build(baseGroup, 'base');
  tris += base.tris;

  // ---- light water: the moat, five canals with cascades, falls off the rim --------------------------------
  const water: THREE.ShaderMaterial[] = [];
  const canalM = waterMaterial(1.0);
  const fallM = waterMaterial(1.15, 1, FALL_VS);
  water.push(canalM, fallM);
  const canalGroup = new THREE.Group();
  city.add(canalGroup);
  const X = new THREE.Vector3(1, 0, 0);
  const cascades: [number, number, number, number][] = [];
  CANALS.forEach((deg, ci) => {
    const main = ci === 0, w = main ? 20 : 13;
    const rows: Row[] = [];
    let s = 0, f = 0;
    const run = (r0: number, r1: number, y: number) => { for (let q = r0; q <= r1 + 0.01; q += 4) { rows.push({ c: new THREE.Vector3(0, y + 0.7, q), side: X, w, s: s + (q - r0), f: f + (q - r0) / VCANAL }); } s += r1 - r0; f += (r1 - r0) / VCANAL; };
    const step = (rr: number, y0: number, y1: number) => { for (let i = 1; i <= 5; i++) { const k = i / 5, d = (y0 - y1) * k; rows.push({ c: new THREE.Vector3(0, y0 - d + 0.7, rr + 0.8 + k * k * 3), side: X, w, s: s + d, f: f + Math.sqrt((2 * d) / G), d }); } cascades.push([deg, rr + 4.5, y1 + 0.7, w]); s += y0 - y1; f += Math.sqrt((2 * (y0 - y1)) / G); };
    run(92, 102, L3); step(102, L3, L2); run(103, 232, L2); step(232, L2, L1); run(233, 292, L1); step(292, L1, L0); run(293, R + 4, L0);
    const g = strip(rows, 6);
    g.rotateY(deg * D2R);
    const m = new THREE.Mesh(g, canalM);
    m.frustumCulled = false;
    m.userData.noWire = true;
    canalGroup.add(m);
    // Off the rim: a curtain that falls as a true parabola, in three layers that part as they drop.
    for (let layer = 0; layer < 2; layer++) {
      const fr: Row[] = [];
      const v0 = VCANAL * (1 + layer * 0.18);
      for (let j = 0; j <= 40; j++) {
        const tt = (j / 40) * FALL_T, d = 0.5 * G * tt * tt;
        fr.push({ c: new THREE.Vector3(0, 0.6 - d, R + 4 + v0 * tt + layer * 1.5), side: X, w: (w - 2 + layer * 5) * (1 + 0.35 * (d / CITY.LIFT)), s: s + v0 * tt + d, f: f + tt, d, seed: layer + ci * 3 });
      }
      const rot = new THREE.Matrix4().makeRotationY(deg * D2R);
      for (const row of fr) row.c.applyMatrix4(rot);
      const fm = new THREE.Mesh(fallStrip(fr, 4), fallM);
      fm.frustumCulled = false;
      fm.userData.noWire = true;
      canalGroup.add(fm);
    }
    // Channel walls, the spout and steps beside the cascades.
    const b = new Builder();
    const M = xf({ r: [0, deg * D2R, 0] });
    for (const sx of [-1, 1]) {
      for (const [r0, r1, y] of [[90, 102, L3], [104, 232, L2], [234, 292, L1], [294, R + 2, L0]] as [number, number, number][]) if (sx < 0) b.add(rbox(w + 0.4, 0.8, r1 - r0, 0.3), bed, xf({ p: [0, y + 0.1, (r0 + r1) / 2] }).premultiply(M));
      for (const [r0, r1, y] of [[90, 102, L3], [104, 232, L2], [234, 292, L1], [294, R + 2, L0]] as [number, number, number][]) b.add(rbox(2.4, 4, r1 - r0, 0.5), ivory, xf({ p: [sx * (w / 2 + 1.2), y + 2, (r0 + r1) / 2] }).premultiply(M));
      for (const [rr, y0, y1] of [[102, L2, L3], [232, L1, L2], [292, L0, L1]] as [number, number, number][]) for (let i = 0; i < 5; i++) {
        const hh = (y1 - y0) * (1 - i / 5);
        b.add(rbox(10, hh, 2.6, 0.3), stone, xf({ p: [sx * (w / 2 + 8), y0 + hh / 2, rr + 1.3 + i * 2.6] }).premultiply(M), { uv: 'box', tile: 1 });
      }
    }
    b.add(rbox(w + 8, 3, 10, 0.8), ivory, xf({ p: [0, -1.2, R + 1] }).premultiply(M));
    for (const sx of [-1, 1]) b.add(rbox(2.6, 7, 12, 0.6), brass, xf({ p: [sx * (w / 2 + 2.6), 1.4, R + 1] }).premultiply(M));
    // A bridge across the canal on the boulevard ring.
    b.add(rbox(w + 10, 2, 16, 0.6), ivory, xf({ p: [0, L1 + 3, 262] }).premultiply(M));
    for (const sx of [-1, 1]) b.add(rbox(1, 3, 16, 0.3), brass, xf({ p: [sx * (w / 2 + 4.5), L1 + 5, 262] }).premultiply(M));
    b.build(canalGroup, `canal${ci}`);
    tris += b.tris;
  });
  // The moat round the spire.
  {
    // The moat fills before the canals: its distances run up to 0, where the canals start.
    const rows: Row[] = [];
    for (let a = 0; a <= 360; a += 2) { const [x, z] = pol(85, a); rows.push({ c: new THREE.Vector3(x, L3 + 0.7, z), side: new THREE.Vector3(x, 0, z).normalize(), w: 11, s: Math.abs(180 - a) * 1.1 - 200, f: a / 40, seed: 20 }); }
    const m = new THREE.Mesh(strip(rows, 4), canalM);
    m.frustumCulled = false;
    m.userData.noWire = true;
    canalGroup.add(m);
    const b = new Builder();
    b.add(wall(79.5, L3, L3 + 2, 120), ivory);
    b.add(ring(78, 79.5, L3 + 2, 120), ivory);
    b.add(wall(91, L3, L3 + 2, 120), ivory);
    b.add(ring(91, 92.5, L3 + 2, 120), ivory);
    b.build(canalGroup, 'moat');
  }

  const keepOut: [number, number, number][] = [];
  const deckFolk: [number, number, number][] = [];
  const roofTrees: [number, number, number][] = [];

  // ---- buildings ------------------------------------------------------------------------------------
  const building = (name: string, t0: number, dur = 1.1) => {
    const g = new THREE.Group();
    g.name = name;
    city.add(g);
    const b = new Builder();
    const rise: Rise = { group: g, t0, dur, height: 0 };
    rises.push(rise);
    return { g, b, rise, done: (h: number) => { rise.height = h; b.build(g, name); tris += b.tris; } };
  };
  // A curtain wall: interior mapped glass over a stack of sections, slabs at every floor, fins between bays, ribs.
  const facade = (b: Builder, secs: Section[], o: { bays: number; floor: number; rooms: THREE.Material; frame: THREE.Material; seg?: number; belt?: number; ribs?: number; finDepth?: number; ribDepth?: number; slabOut?: number; seed?: number; cx?: number; cz?: number }) => {
    const seg = o.seg ?? Math.max(56, o.bays * 2);
    const M = at(o.cx ?? 0, 0, o.cz ?? 0);
    b.add(loft(secs, seg, { bays: o.bays, floor: o.floor, depth: o.floor * 1.2, seed: o.seed ?? 0, cap: true }), o.rooms, M, { uv: 'keep' });
    const y0 = secs[0].y, y1 = secs[secs.length - 1].y;
    const floors = Math.max(1, Math.round((y1 - y0) / o.floor));
    for (let k = 0; k <= floors; k++) {
      const y = y0 + ((y1 - y0) * k) / floors;
      const big = k === 0 || k === floors || k % (o.belt ?? 4) === 0;
      b.add(slab(interp(secs, y), seg, big ? 2.2 : 0.7, big ? (o.slabOut ?? 1.6) : 0.5), big ? o.frame : dark, M);
    }
    const dense: Section[] = [];
    for (let k = 0; k <= floors; k++) dense.push(interp(secs, y0 + ((y1 - y0) * k) / floors));
    for (let k = 0; k < o.bays; k++) b.add(fin(dense, k / o.bays, o.finDepth ?? 0.9, 0.45), dark, M);
    const ribs = o.ribs ?? Math.round(o.bays / 6);
    for (let k = 0; k < ribs; k++) b.add(fin(dense, (k + 0.5) / ribs, o.ribDepth ?? 2.6, 1.3), o.frame, M);
  };
  const crown = (b: Builder, cx: number, cz: number, y: number, rr: number, h: number, frame: THREE.Material) => {
    b.add(lathe([[rr, y], [rr + 1.5, y + 1.5], [rr * 0.8, y + h * 0.4], [rr * 0.35, y + h * 0.85], [0.6, y + h], [0, y + h]], 48), frame, at(cx, 0, cz));
    b.add(new THREE.SphereGeometry(1.1, 10, 8), beacon, at(cx, y + h + 1, cz), { shadow: false });
  };

  // The spire: ribbed glass shaft, five swept ivory blades with brass edges, a rotunda, a ring deck, a lens lantern,
  // a needle. About as tall as the disc is wide, as in the reference.
  {
    const S = building('spire', 2.2, 1.9);
    const TOP = 520, BLADE = 390, DECK = 470;
    const shaft = (y: number) => 24 - 10 * Math.min(1, y / TOP) - 2.5 * Math.max(0, Math.min(1, (y - (TOP - 80)) / 80));
    const secs: Section[] = [];
    for (let y = 0; y <= TOP; y += 13) secs.push({ y: L3 + y, rx: shaft(y), rz: shaft(y) });
    facade(S.b, secs, { bays: 30, floor: 13, rooms: roomsM(11, 0.35, 0.8), frame: brass, belt: 5, ribs: 10, ribDepth: 3 });
    for (const deg of [36, -36, 108, -108, 180]) {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 28; i++) { const t = i / 28, y = t * BLADE, ro = (1 - t) * (1 - t) * 74 + 2 * (1 - t) * t * 26 + t * t * (shaft(BLADE) + 1); pts.push(new THREE.Vector2(ro + 2.5, L3 + y)); }
      for (let i = 28; i >= 0; i--) { const t = i / 28, y = t * BLADE; pts.push(new THREE.Vector2(Math.max(shaft(y) + 0.5, (1 - t) * (1 - t) * 48 + 2 * (1 - t) * t * 18 + t * t * shaft(BLADE)), L3 + y)); }
      const blade = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 5, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 2, curveSegments: 4 });
      blade.translate(0, 0, -2.5);
      S.b.add(blade, ivory, xf({ r: [0, (deg - 90) * D2R, 0] }));
      const edge = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(0, 29).map((p) => new THREE.Vector3(p.x + 0.5, p.y, 0))), 80, 1.6, 8);
      S.b.add(edge, brass, xf({ r: [0, (deg - 90) * D2R, 0] }));
      // Brass bands across the fin every so often.
      for (let i = 2; i < 24; i += 3) {
        const tt = i / 24, y = tt * BLADE;
        const ro = (1 - tt) * (1 - tt) * 74 + 2 * (1 - tt) * tt * 26 + tt * tt * (shaft(BLADE) + 1) + 2.5;
        const ri = Math.max(shaft(y) + 0.5, (1 - tt) * (1 - tt) * 48 + 2 * (1 - tt) * tt * 18 + tt * tt * shaft(BLADE));
        if (ro - ri > 2) S.b.add(rbox(ro - ri + 0.6, 1.4, 6.2, 0.3), brass, xf({ p: [(ro + ri) / 2, L3 + y + 6, 0] }).premultiply(xf({ r: [0, (deg - 90) * D2R, 0] })));
      }
      // Slit windows up both faces of the fin.
      for (let i = 1; i < 22; i++) {
        const tt = i / 24, y = tt * BLADE;
        const ro = (1 - tt) * (1 - tt) * 74 + 2 * (1 - tt) * tt * 26 + tt * tt * (shaft(BLADE) + 1) + 2.5;
        const ri = Math.max(shaft(y) + 0.5, (1 - tt) * (1 - tt) * 48 + 2 * (1 - tt) * tt * 18 + tt * tt * shaft(BLADE));
        const len = (ro - ri) * 0.6;
        if (len < 3) continue;
        for (const sd of [-1, 1]) S.b.add(rbox(len, 1.1, 0.5, 0.2), slit, xf({ p: [(ro + ri) / 2, L3 + y, sd * 2.75], r: [0, 0, 0] }).premultiply(xf({ r: [0, (deg - 90) * D2R, 0] })), { shadow: false });
      }
    }
    facade(S.b, [{ y: L3, rx: 44, rz: 44 }, { y: L3 + 22, rx: 41, rz: 41 }], { bays: 40, floor: 11, rooms: roomsM(12, 0.75, 0.9), frame: ivory, ribs: 10 });
    S.b.add(lathe([[41, L3 + 22], [47, L3 + 23], [47, L3 + 24.5], [30, L3 + 29], [22, L3 + 29]], 72), ivory);
    for (let a = 0; a < 360; a += 10) { const [x, z] = pol(38, a + 5); S.b.add(rbox(17, 0.9, 1, 0.3), brass, xf({ p: [x, L3 + 27, z], r: [0, (a + 5 - 90) * D2R, -0.31] })); }
    S.b.add(new THREE.TorusGeometry(26, 0.7, 6, 96).rotateX(Math.PI / 2), glowWarm, at(0, L3 + 29.2, 0), { shadow: false });
    // The ring deck: a brass hoop on five spokes with a lit underside.
    const ringT = new THREE.TorusGeometry(62, 1.6, 8, 160); ringT.rotateX(Math.PI / 2);
    S.b.add(ringT, brass, at(0, L3 + DECK, 0));
    // A walkway round the hoop with a rail each side, and people on it.
    S.b.add(ring(57, 67, L3 + DECK + 1.7, 160), ivory);
    S.b.add(wall(67, L3 + DECK + 0.2, L3 + DECK + 1.7, 160), ivory);
    for (const rr of [57.4, 66.6]) { const rt = new THREE.TorusGeometry(rr, 0.25, 5, 160); rt.rotateX(Math.PI / 2); S.b.add(rt, brass, at(0, L3 + DECK + 4.4, 0)); }
    for (let a = 0; a < 360; a += 6) for (const rr of [57.4, 66.6]) { const [x, z] = pol(rr, a); S.b.add(cyl(0.18, 2.7, 4), brass, at(x, L3 + DECK + 3, z)); }
    for (let i = 0; i < 14; i++) { const [x, z] = pol(62 + (r() - 0.5) * 6, r() * 360); deckFolk.push([x, L3 + DECK + 1.7, z]); }
    const ringG = new THREE.TorusGeometry(62, 0.6, 6, 160); ringG.rotateX(Math.PI / 2);
    S.b.add(ringG, glowWarm, at(0, L3 + DECK - 1.9, 0), { shadow: false });
    for (let a = 0; a < 360; a += 72) { const [x, z] = pol(38, a + 36); S.b.add(cyl(0.8, 48, 6).rotateZ(Math.PI / 2), brass, xf({ p: [x, L3 + DECK, z], r: [0, (a + 36 + 90) * D2R, 0] })); }
    // The lantern: a lens of rooms between two ivory rims.
    const lens: Section[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12, q = 12 + 25 * Math.sin(Math.PI * (0.08 + 0.84 * t)) ** 0.8; lens.push({ y: L3 + TOP + t * 46, rx: q, rz: q }); }
    facade(S.b, lens, { bays: 40, floor: 9, rooms: roomsM(13, 0.25, 0.9), frame: brass, ribs: 12, ribDepth: 1.6 });
    S.b.add(lathe([[15, L3 + TOP - 4], [40, L3 + TOP - 1], [42, L3 + TOP + 0.5], [40, L3 + TOP + 2], [15, L3 + TOP + 1]], 72), ivory);
    S.b.add(lathe([[32, L3 + TOP + 44], [35, L3 + TOP + 46], [13, L3 + TOP + 55], [8, L3 + TOP + 55]], 64), ivory);
    // The needle, with brass collars.
    const N0 = TOP + 55;
    S.b.add(lathe([[8, L3 + N0], [5.4, L3 + N0 + 24], [3.5, L3 + N0 + 58], [1.5, L3 + N0 + 100], [0.5, L3 + N0 + 128], [0, L3 + N0 + 128]], 28), ivory);
    for (const [y, q] of [[3, 9.2], [24, 6.4], [58, 4.5], [90, 2.8]] as [number, number][]) { const t = new THREE.TorusGeometry(q, 0.9, 8, 40); t.rotateX(Math.PI / 2); S.b.add(t, brass, at(0, L3 + N0 + y, 0)); }
    S.b.add(new THREE.SphereGeometry(2.2, 14, 10), beacon, at(0, L3 + N0 + 130, 0), { shadow: false });
    // Ribs up the needle, more collars, and two small dishes on arms.
    { const prof: [number, number][] = [[8, 0], [5.4, 24], [3.5, 58], [1.5, 100], [0.6, 122]];
      for (let a = 0; a < 360; a += 90) S.b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(prof.map(([q, y]) => new THREE.Vector3(Math.sin(a * D2R) * (q + 0.35), L3 + N0 + y, Math.cos(a * D2R) * (q + 0.35)))), 40, 0.32, 5), brass);
      for (const [y, q] of [[40, 4.8], [75, 3.0], [110, 1.6]] as [number, number][]) { const tt = new THREE.TorusGeometry(q, 0.5, 6, 32); tt.rotateX(Math.PI / 2); S.b.add(tt, brass, at(0, L3 + N0 + y, 0)); }
      for (const sd of [-1, 1]) { S.b.add(rbox(9, 0.6, 0.6, 0.2), brass, at(sd * 8.5, L3 + N0 + 44, 0)); const dish = lathe([[0, 0], [2.6, 0.9], [2.8, 1.2]], 24); dish.rotateZ(sd * Math.PI / 2); S.b.add(dish, ivory, at(sd * 13, L3 + N0 + 44, 0)); } }
    // Fins at the needle's foot, a band of lit slits, a glow under the canopy's edge and ribs under the lower rim.
    for (let a = 0; a < 360; a += 45) { const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(6, 0), new THREE.Vector2(0.4, 30), new THREE.Vector2(0, 30)]); const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false }); fg.translate(5.2, 0, -0.4); S.b.add(fg, brass, xf({ p: [0, L3 + N0, 0], r: [0, a * D2R, 0] })); }
    for (let a = 0; a < 360; a += 30) { const [x, z] = pol(5.6, a); S.b.add(rbox(0.6, 5, 0.6, 0.2), slit, xf({ p: [x, L3 + N0 + 14, z], r: [0, a * D2R, 0] }), { shadow: false }); }
    S.b.add(new THREE.TorusGeometry(32.5, 0.5, 6, 96).rotateX(Math.PI / 2), glowWarm, at(0, L3 + TOP + 45.4, 0), { shadow: false });
    for (let a = 0; a < 360; a += 15) { const [x, z] = pol(28, a); S.b.add(rbox(1, 2.5, 26, 0.3), ivory, xf({ p: [x, L3 + TOP - 3, z], r: [0, a * D2R, 0] })); }
    S.done(L3 + N0 + 132);
  }

  // Six large structures that differ in shape, between the canals on the middle terrace.
  // 1 · the twisted tower: each floor plate turned a little more.
  {
    const [cx, cz] = pol(204, 40), B = building('twist', 2.6, 1.3);
    const H = 360;
    const secs: Section[] = [];
    for (let y = 0; y <= H; y += 10) secs.push({ y: L2 + y, rx: 22 - y * 0.018, rz: 14 - y * 0.01, n: 3.2, twist: (y / H) * 1.6 });
    facade(B.b, secs, { bays: 28, floor: 10, rooms: roomsM(21, 0.55), frame: ivory, cx, cz, belt: 6, ribs: 4 });
    // An open crown: brass fins that carry the twist on up and close to a point.
    { const top: Section[] = []; for (let i = 0; i <= 8; i++) { const t = i / 8; top.push({ y: L2 + H + t * 44, rx: (22 - H * 0.018) * (1 - t * 0.9), rz: (14 - H * 0.01) * (1 - t * 0.9), n: 3.2, twist: 1.6 + t * 0.9 }); }
      for (let k = 0; k < 10; k++) B.b.add(fin(top, k / 10, 1.6, 0.7), brass, at(cx, 0, cz));
      B.b.add(slab(top[0], 48, 2.4, 1.4), ivory, at(cx, 0, cz)); }
    facade(B.b, [{ y: L2, rx: 30, rz: 22, n: 3 }, { y: L2 + 16, rx: 30, rz: 22, n: 3 }], { bays: 24, floor: 16, rooms: roomsM(22, 0.85, 0.9), frame: ivory, cx, cz });
    B.done(L2 + H + 46);
  }
  // 2 · the stepped tower: three setbacks with garden ledges.
  {
    const [cx, cz] = pol(200, -40), B = building('stepped', 2.75, 1.3);
    const tiers: [number, number, number, number][] = [[0, 150, 26, 22], [150, 260, 20, 17], [260, 330, 14, 12]];
    for (const [y0, y1, rx, rz] of tiers) {
      facade(B.b, [{ y: L2 + y0, rx, rz, n: 4 }, { y: L2 + y1, rx, rz, n: 4 }], { bays: 28, floor: 10, rooms: roomsM(31 + y0, 0.6), frame: brass, cx, cz, belt: 3, ribs: 4 });
      B.b.add(slab({ y: L2 + y1 + 1, rx: rx + 3, rz: rz + 3, n: 4 }, 48, 2.5, 0), ivory, at(cx, 0, cz));
    }
    // A roof garden and a mast with three cross arms.
    B.b.add(cyl(1.2, 46, 10), brass, at(cx, L2 + 332 + 23, cz));
    for (const [y, w] of [[18, 16], [28, 11], [37, 7]] as [number, number][]) B.b.add(rbox(w, 0.9, 0.9, 0.3), brass, xf({ p: [cx, L2 + 332 + y, cz], r: [0, 40 * D2R, 0] }));
    B.b.add(new THREE.SphereGeometry(1, 10, 8), beacon, at(cx, L2 + 332 + 47, cz), { shadow: false });
    roofTrees.push([cx + 7, L2 + 332, cz + 3], [cx - 6, L2 + 332, cz - 4], [cx + 1, L2 + 332, cz - 7]);
    B.done(L2 + 375);
  }
  // 3 · the lens tower: an ellipsoid of glass on a slim neck.
  {
    const [cx, cz] = pol(196, 112), B = building('lens', 2.9, 1.3);
    const NECK = 60, BODY = 230;
    const secs: Section[] = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20, q = 6 + 23 * Math.sin(Math.PI * t) ** 0.7; secs.push({ y: L2 + NECK + t * BODY, rx: q, rz: q * 0.82 }); }
    facade(B.b, secs, { bays: 30, floor: 9, rooms: roomsM(41, 0.3, 0.75), frame: brass, cx, cz, ribs: 10, ribDepth: 1.8 });
    B.b.add(cyl(6.5, NECK, 24), ivory, at(cx, L2 + NECK / 2, cz));
    B.b.add(lathe([[22, L2], [24, L2 + 2], [9, L2 + 10], [7, L2 + NECK]], 48), ivory, at(cx, 0, cz));
    B.b.add(new THREE.TorusGeometry(6, 0.8, 8, 32).rotateX(Math.PI / 2), brass, at(cx, L2 + NECK + BODY + 1, cz));
    B.b.add(new THREE.SphereGeometry(2.4, 14, 10), brass, at(cx, L2 + NECK + BODY + 3.5, cz));
    B.b.add(cyl(0.5, 12, 6), brass, at(cx, L2 + NECK + BODY + 11, cz));
    B.done(L2 + NECK + BODY + 28);
  }
  // 4 · the drums: offset cylinders stacked with lit gaps between.
  {
    const [cx, cz] = pol(198, -112), B = building('drums', 3.05, 1.3);
    const drums: [number, number, number, number, number][] = [[0, 80, 24, 0, 0], [88, 160, 20, 5, -3], [168, 230, 17, -4, 4], [238, 285, 13, 2, 2]];
    for (const [y0, y1, rr, ox, oz] of drums) {
      facade(B.b, [{ y: L2 + y0, rx: rr, rz: rr }, { y: L2 + y1, rx: rr, rz: rr }], { bays: 26, floor: 10, rooms: roomsM(51 + y0, 0.7), frame: bronze, cx: cx + ox, cz: cz + oz, ribs: 6 });
      B.b.add(cyl(rr * 0.72, 8, 48), ivory, at(cx + ox, L2 + y1 + 4, cz + oz));
      B.b.add(cyl(rr * 0.74, 2.2, 48), glowWarm, at(cx + ox, L2 + y1 + 4, cz + oz), { shadow: false });
      for (let a = 0; a < 360; a += 30) { const [x, z] = pol(rr * 0.8, a); B.b.add(rbox(1.2, 8, 1.2, 0.3), bronze, at(cx + ox + x, L2 + y1 + 4, cz + oz + z)); }
    }
    // A shallow brass dish turned up to the sky, on a short collar, with a feed on a tripod.
    B.b.add(lathe([[4, L2 + 286], [9, L2 + 288], [15, L2 + 292], [16, L2 + 293], [15.5, L2 + 293.6], [8.5, L2 + 289.4], [0, L2 + 288.5]], 48), brass, at(cx + 2, 0, cz + 2));
    for (let a = 0; a < 360; a += 120) { const [x, z] = pol(12, a); B.b.add(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(x, L2 + 292, z), new THREE.Vector3(0, L2 + 304, 0)), 1, 0.35, 5), bronze, at(cx + 2, 0, cz + 2)); }
    B.b.add(new THREE.SphereGeometry(1, 10, 8), beacon, at(cx + 2, L2 + 305, cz + 2), { shadow: false });
    B.done(L2 + 306);
  }
  // 5 · the twin gates: two slim square towers joined by two glass sky bridges, astride the back canal.
  {
    const B = building('gates', 3.2, 1.3);
    const H = 320;
    const [ax, az] = pol(204, 163), [bx, bz] = pol(204, 197);
    for (const [cx, cz] of [[ax, az], [bx, bz]]) {
      facade(B.b, [{ y: L2, rx: 17, rz: 15, n: 6 }, { y: L2 + H, rx: 14, rz: 12.5, n: 6 }], { bays: 24, floor: 10, rooms: roomsM(61 + cx, 0.45), frame: ivory, cx, cz, ribs: 4, ribDepth: 3.4 });
      B.b.add(slab({ y: L2 + H + 1, rx: 15.5, rz: 14, n: 6 }, 32, 2.4, 0), ivory, at(cx, 0, cz));
    }
    // A lintel joins the two tops, so the pair reads as one gate.
    { const mx = (ax + bx) / 2, mz = (az + bz) / 2, len = Math.hypot(bx - ax, bz - az) + 22, ang = Math.atan2(bx - ax, bz - az);
      // The sky hall: three floors of rooms spanning the gap, under an ivory roof.
      B.b.add(loft([{ y: L2 + H - 30, rx: 10, rz: len / 2, n: 6 }, { y: L2 + H + 4, rx: 10, rz: len / 2, n: 6 }], 32, { bays: 22, floor: 11, depth: 10, seed: 77, cap: true }), roomsM(78, 0.8, 0.95), xf({ p: [mx, 0, mz], r: [0, ang, 0] }), { uv: 'keep' });
      B.b.add(rbox(24, 4, len + 6, 1.2), ivory, xf({ p: [mx, L2 + H + 6, mz], r: [0, ang, 0] }));
      B.b.add(rbox(23, 2.2, len, 0.6), ivory, xf({ p: [mx, L2 + H - 31, mz], r: [0, ang, 0] }));
      B.b.add(rbox(14.6, 1.2, len + 0.6, 0.4), brass, xf({ p: [mx, L2 + H + 2.4, mz], r: [0, ang, 0] }));
      B.b.add(rbox(3, 0.8, len - 30, 0.3), glowWarm, xf({ p: [mx, L2 + H + 1.6, mz], r: [0, ang, 0] }), { shadow: false }); }
    for (const y of [150, 220]) {
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, len = Math.hypot(bx - ax, bz - az);
      const ang = Math.atan2(bx - ax, bz - az);
      const br = loft([{ y: L2 + y, rx: 5, rz: len / 2, n: 6 }, { y: L2 + y + 9, rx: 5, rz: len / 2, n: 6 }], 24, { bays: 14, floor: 9, depth: 8, seed: y });
      B.b.add(br, roomsM(70 + y, 0.65, 0.95), xf({ p: [mx, 0, mz], r: [0, ang, 0] }), { uv: 'keep' });
      B.b.add(rbox(12, 1.6, len, 0.5), brass, xf({ p: [mx, L2 + y - 0.8, mz], r: [0, ang, 0] }));
      B.b.add(rbox(12, 1.6, len, 0.5), brass, xf({ p: [mx, L2 + y + 9.8, mz], r: [0, ang, 0] }));
    }
    B.done(L2 + H + 12);
  }
  // 6 · the forum: a ribbed dome on a colonnade, by the main canal on the plaza's edge.
  {
    const [cx, cz] = pol(130, -22), B = building('forum', 2.45, 0.9);
    facade(B.b, [{ y: L2, rx: 30, rz: 30 }, { y: L2 + 16, rx: 30, rz: 30 }], { bays: 32, floor: 16, rooms: roomsM(81, 0.9, 1), frame: ivory, cx, cz, ribs: 8 });
    for (let a = 0; a < 360; a += 15) { const [x, z] = pol(34, a); B.b.add(cyl(1.4, 16, 12), ivory, at(cx + x, L2 + 8, cz + z)); }
    B.b.add(ring(30, 37, L2 + 16.2, 64), ivory, at(cx, 0, cz));
    const dome: [number, number][] = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * (Math.PI / 2) * 0.92; dome.push([31 * Math.cos(a), L2 + 17 + 22 * Math.sin(a)]); }
    dome.push([0, L2 + 17 + 22]);
    B.b.add(lathe(dome, 96), domeBrass, at(cx, 0, cz));
    for (let a = 0; a < 360; a += 22.5) { const ribPts: THREE.Vector3[] = dome.slice(0, 12).map(([q, y]) => new THREE.Vector3(Math.sin(a * D2R) * (q + 0.5), y, Math.cos(a * D2R) * (q + 0.5))); B.b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribPts), 24, 0.6, 5), ivory, at(cx, 0, cz)); }
    B.b.add(cyl(5, 2, 32), glowWarm, at(cx, L2 + 39, cz), { shadow: false });
    B.done(L2 + 42);
  }
  // 7 · the ring house: a saucer of rooms on a stalk.
  {
    const [cx, cz] = pol(150, 82), B = building('ring', 3.35, 1.2);
    const Y = 220;
    B.b.add(cyl(5.5, Y, 48), ivory, at(cx, L2 + Y / 2, cz));
    // Flutes up the stalk, collars every forty, and a lit lift shaft on the face toward the city.
    { const st: Section[] = [{ y: L2, rx: 5.5, rz: 5.5 }, { y: L2 + Y - 12, rx: 5.5, rz: 5.5 }]; for (let k = 0; k < 12; k++) B.b.add(fin(st, k / 12, 1.2, 0.8), ivory, at(cx, 0, cz)); }
    for (let y = 30; y < Y - 12; y += 40) B.b.add(new THREE.TorusGeometry(6.6, 0.7, 6, 40).rotateX(Math.PI / 2), brass, at(cx, L2 + y, cz));
    { const inward = Math.atan2(-cx, -cz); for (let y = 6; y < Y - 14; y += 3.2) B.b.add(rbox(2.2, 2, 0.6, 0.2), slit, xf({ p: [cx + Math.sin(inward) * 6.6, L2 + y, cz + Math.cos(inward) * 6.6], r: [0, inward, 0] }), { shadow: false }); }
    facade(B.b, [{ y: L2 + Y, rx: 34, rz: 34 }, { y: L2 + Y + 12, rx: 34, rz: 34 }], { bays: 44, floor: 12, rooms: roomsM(91, 0.6), frame: brass, cx, cz, ribs: 11 });
    B.b.add(lathe([[0, L2 + Y - 12], [10, L2 + Y - 11], [36, L2 + Y - 1], [36, L2 + Y + 0.5], [0, L2 + Y + 0.5]], 64), ivory, at(cx, 0, cz));
    B.b.add(lathe([[36, L2 + Y + 11.5], [36, L2 + Y + 13], [14, L2 + Y + 20], [0, L2 + Y + 21]], 64), ivory, at(cx, 0, cz));
    B.b.add(new THREE.TorusGeometry(35, 0.6, 6, 120).rotateX(Math.PI / 2), glowWarm, at(cx, L2 + Y - 1, cz), { shadow: false });
    B.done(L2 + Y + 22);
  }

  // Mid-rise balcony towers on the middle terrace: every floor a balcony whose edge swells and recedes up the
  // tower, so the outline ripples. They step the skyline down from the towers toward the rim.
  {
    const B = building('midrise', 2.5, 1.0);
    const mr = [roomsM(140, 0.6), roomsM(141, 0.8)];
    [[150, 22, 128], [150, -58, 112], [150, 128, 120], [150, -128, 104]].forEach(([q, deg, H], i) => {
      const [cx, cz] = pol(q, deg), tw = -deg * D2R;
      facade(B.b, [{ y: L2, rx: 13, rz: 10, n: 2.4, twist: tw }, { y: L2 + H, rx: 12, rz: 9, n: 2.4, twist: tw }], { bays: 20, floor: 8, rooms: mr[i % 2], frame: ivory, cx, cz, ribs: 0, belt: 100, seed: 90 + i });
      const floors = Math.round(H / 8);
      for (let f = 1; f <= floors; f++) { const y = L2 + (f / floors) * H, out = 2.2 + 1.8 * Math.sin(f * 0.55 + i); B.b.add(slab({ y, rx: 13 - (f / floors), rz: 10 - (f / floors), n: 2.4, twist: tw }, 40, 0.9, out), ivory, at(cx, 0, cz)); }
      B.b.add(cyl(5, 6, 24), bronze, at(cx, L2 + H + 3, cz));
      B.b.add(new THREE.TorusGeometry(5.2, 0.4, 6, 32).rotateX(Math.PI / 2), glowWarm, at(cx, L2 + H + 5.6, cz), { shadow: false });
      roofTrees.push([cx + 6, L2 + H, cz + 2], [cx - 6, L2 + H, cz - 2]);
      keepOut.push([cx, cz, 20]);
    });
    B.done(L2 + 140);
  }
  // Transit stations under the ring train's track on the boulevard ring: curved halls with glass faces and a
  // ribbed brass roof, one per sector.
  {
    const B = building('stations', 2.1, 0.8);
    const sr = roomsM(150, 0.9, 1);
    for (let k = 0; k < 5; k++) {
      const c = 36 + k * 72, len = 20 * D2R, rot = xf({ r: [0, (c + 180) * D2R, 0] });
      B.b.add(roomsArc(276, 0, L1, L1 + 11, len, 32, { floor: 11, bays: 22, depth: 8, seed: 150 + k, inward: false }), sr, rot, { uv: 'keep' });
      B.b.add(roomsArc(250, 0, L1, L1 + 11, len, 32, { floor: 11, bays: 20, depth: 8, seed: 160 + k, inward: true }), sr, rot, { uv: 'keep' });
      B.b.add(ring(248, 278, L1 + 11.4, 32, Math.PI / 2 - len / 2, Math.PI / 2 + len / 2), ivory, rot);
      for (let j = 0; j <= 10; j++) { const a = c - 10 + j * 2; const [x, z] = pol(263, a); B.b.add(rbox(1, 1.2, 31, 0.3), brass, xf({ p: [x, L1 + 12.4, z], r: [0, a * D2R, 0] })); }
      for (const sd of [-1, 1]) { const a = c + sd * 10; const [x, z] = pol(263, a); B.b.add(rbox(29, 13, 2, 0.6), ivory, xf({ p: [x, L1 + 6.5, z], r: [0, (a - 90) * D2R, 0] })); }
    }
    B.done(L1 + 14);
  }

  // The outer lawn ring: one landmark in the middle of each sector, terraced blocks either side of it.
  {
    const B = building('outer', 1.9, 1.1);
    const blockRooms = [roomsM(100, 0.55), roomsM(101, 0.85)];
    const glass = P({ color: 0x2a2018, metalness: 0.2, roughness: 0.06, transparent: true, opacity: 0.42, envMapIntensity: 1.4 }, 'conservatory');
    glass.depthWrite = false;
    // Terrace houses: curved blocks that follow the ring, stepping up toward the spire, rooms on every face that
    // shows, a planted roof on each step, end walls in ivory.
    let seed = 1;
    for (let k = 0; k < 5; k++) for (const side of [-1, 1]) {
      const c = 36 + k * 72 + side * 21 + (r() - 0.5) * 2;
      const len = (15 + r() * 3) * D2R;
      const rot = xf({ r: [0, (c + 180) * D2R, 0] });
      const tall = 1 + (r() - 0.5) * 0.35;
      const steps: [number, number, number][] = [[386, 402, 15 * tall], [372, 386, 27 * tall], [358, 372, 39 * tall]];
      steps.forEach(([r0, r1, h], i) => {
        const y1 = L0 + h;
        B.b.add(roomsArc(r1, 0, L0, y1, len, 28, { floor: 8, bays: Math.round((r1 * len) / 5), depth: 8, seed: seed++, inward: false }), blockRooms[(k + i) % 2], rot, { uv: 'keep' });
        if (i === steps.length - 1) B.b.add(roomsArc(r0, 0, L0, y1, len, 28, { floor: 8, bays: Math.round((r0 * len) / 5), depth: 8, seed: seed++, inward: true }), blockRooms[(k + i + 1) % 2], rot, { uv: 'keep' });
        B.b.add(ring(r0 - 0.6, r1 + 0.8, y1 + 0.6, 28, Math.PI / 2 - len / 2, Math.PI / 2 + len / 2), ivory, rot);
        B.b.add(ring(r0, r1, y1 + 1.4, 28, Math.PI / 2 - len / 2 + 0.01, Math.PI / 2 + len / 2 - 0.01), lawnM, rot, { uv: 'box' });
        const floors = Math.max(1, Math.round(h / 8));
        for (let e = 1; e < floors; e++) { const fl = L0 + (e / floors) * h; B.b.add(ring(r1 - 0.2, r1 + 1.2, fl, 28, Math.PI / 2 - len / 2, Math.PI / 2 + len / 2), (k + i) % 2 ? ivory : bronze, rot); }
        for (const s of [-1, 1]) {
          const a = c + s * (len / D2R) / 2;
          const [x, z] = pol((r0 + r1) / 2, a);
          const q = (r1 - r0) / 2 + 0.6;
          facade(B.b, [{ y: L0, rx: q, rz: q }, { y: L0 + h, rx: q, rz: q }], { bays: 8, floor: 8, rooms: blockRooms[(k + i + 1) % 2], frame: ivory, cx: x, cz: z, ribs: 0, belt: 2, seed: seed++ });
          B.b.add(new THREE.TorusGeometry(q + 1.2, 0.35, 5, 40).rotateX(Math.PI / 2), brass, at(x, L0 + h + 1.9, z));
          { const sky: [number, number][] = []; for (let s = 0; s <= 8; s++) { const a = (s / 8) * Math.PI / 2; sky.push([q * 0.6 * Math.cos(a), L0 + h + 1.1 + q * 0.32 * Math.sin(a)]); } B.b.add(lathe(sky, 32), skyGlass, at(x, 0, z), { shadow: false }); for (let a = 0; a < 360; a += 45) B.b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sky.map(([qq, yy]) => new THREE.Vector3(Math.sin(a * D2R) * (qq + 0.15), yy, Math.cos(a * D2R) * (qq + 0.15)))), 12, 0.22, 4), brass, at(x, 0, z)); }
        }
        if (i < 2) for (const f of [-0.25, 0.25]) { const [x, z] = pol((r0 + r1) / 2, c + (f * len) / D2R); roofTrees.push([x, y1 + 1.4, z]); }
      });
      for (const f of [-0.35, 0, 0.35]) { const [x, z] = pol(380, c + (f * len) / D2R); keepOut.push([x, z, 24]); }
    }
    // 36°: the landing pad tower. A fluted core with three round pads cantilevered at three heights.
    {
      const [cx, cz] = pol(362, 36);
      const core: Section[] = [];
      for (let y = 0; y <= 96; y += 8) core.push({ y: L0 + y, rx: 9 - y * 0.02, rz: 9 - y * 0.02 });
      facade(B.b, core, { bays: 18, floor: 8, rooms: blockRooms[0], frame: ivory, cx, cz, ribs: 6, seed: 40 });
      for (const [y, dir, rad] of [[44, 120, 15], [70, 250, 13], [96, 10, 17]] as [number, number, number][]) {
        const [ox, oz] = pol(rad * 0.9, dir);
        B.b.add(cyl(rad, 2.2, 48), ivory, at(cx + ox, L0 + y + 1.1, cz + oz));
        B.b.add(new THREE.TorusGeometry(rad, 0.6, 6, 64).rotateX(Math.PI / 2), brass, at(cx + ox, L0 + y + 2.2, cz + oz));
        B.b.add(new THREE.TorusGeometry(rad * 0.62, 0.3, 4, 48).rotateX(Math.PI / 2), glowWarm, at(cx + ox, L0 + y + 2.3, cz + oz), { shadow: false });
        B.b.add(lathe([[rad * 0.95, L0 + y], [rad * 0.5, L0 + y - 5], [4, L0 + y - 8]], 32), bronze, at(cx + ox, 0, cz + oz));
      }
      keepOut.push([cx, cz, 30]);
    }
    // 108°: the garden pyramid. Five terraces of rooms, each ledge planted.
    {
      const [cx, cz] = pol(360, 108), tw = -108 * D2R;
      let s0 = 30, y = L0;
      for (let i = 0; i < 5; i++) {
        const h = 11;
        facade(B.b, [{ y, rx: s0, rz: s0, n: 6, twist: tw }, { y: y + h, rx: s0 - 1, rz: s0 - 1, n: 6, twist: tw }], { bays: 32 - i * 4, floor: 11, rooms: blockRooms[i % 2], frame: ivory, cx, cz, ribs: 4, seed: 50 + i });
        B.b.add(slab({ y: y + h + 0.8, rx: s0 + 0.5, rz: s0 + 0.5, n: 6, twist: tw }, 48, 1.6, 0), stone, at(cx, 0, cz), { uv: 'box', tile: 1 });
        y += h + 1.6;
        s0 -= 5.5;
      }
      B.b.add(cyl(3, 10, 16), brass, at(cx, y + 5, cz));
      B.b.add(new THREE.SphereGeometry(1.2, 10, 8), beacon, at(cx, y + 11, cz), { shadow: false });
      keepOut.push([cx, cz, 40]);
    }
    // 180°: the crescent. A bowed slab of rooms with its hollow toward the spire, rooms on both faces.
    {
      const [cx, cz] = pol(384, 180);
      const RAD = 62, D = 9, H = 64, LEN = 1.5;
      B.b.add(roomsArc(RAD, RAD, L0, L0 + H, LEN, 56, { floor: 8, bays: 44, depth: 8, seed: 60, inward: true }), blockRooms[1], at(cx, 0, cz), { uv: 'keep' });
      B.b.add(roomsArc(RAD + D, RAD, L0, L0 + H, LEN, 56, { floor: 8, bays: 50, depth: 8, seed: 61, inward: false }), blockRooms[0], at(cx, 0, cz), { uv: 'keep' });
      for (const [y, t] of [[L0 + H + 1, 2.2], [L0 + 33, 1.2]] as [number, number][]) {
        const top = ring(RAD - 1.5, RAD + D + 1.5, 0, 56, Math.PI / 2 - LEN / 2, Math.PI / 2 + LEN / 2);
        B.b.add(top, ivory, at(cx, y, cz + RAD));
        void t;
      }
      for (const sgn of [-1, 1]) {
        const q = RAD + D / 2, x = sgn * q * Math.sin(LEN / 2), z = RAD - q * Math.cos(LEN / 2);
        B.b.add(rbox(D + 2, H + 2, 4, 0.8), ivory, xf({ p: [cx + x, L0 + H / 2 + 1, cz + z], r: [0, -sgn * LEN / 2, 0] }));
      }
      keepOut.push([cx, cz + 20, 50]);
    }
    // 252°: the amphitheatre. Rings of seats stepping down to a lit stage, an ivory rim with brass posts.
    {
      const [cx, cz] = pol(362, -108);
      for (let i = 0; i < 7; i++) B.b.add(ring(12 + i * 3.2, 15.4 + i * 3.2, L0 + 0.6 + i * 1.6, 72), i % 2 ? stone : ivory, at(cx, 0, cz), { uv: 'box', tile: 1 });
      for (let i = 0; i < 7; i++) B.b.add(wall(12 + i * 3.2, L0 + i * 1.6 - 1, L0 + 0.6 + i * 1.6, 72), stone, at(cx, 0, cz));
      B.b.add(cyl(10, 1, 48), bronze, at(cx, L0 + 0.5, cz));
      B.b.add(new THREE.TorusGeometry(9, 0.4, 6, 64).rotateX(Math.PI / 2), glowWarm, at(cx, L0 + 1.1, cz), { shadow: false });
      B.b.add(wall(35, L0, L0 + 13, 96), ivory, at(cx, 0, cz));
      B.b.add(ring(34, 37, L0 + 13, 96), ivory, at(cx, 0, cz));
      for (let a = 0; a < 360; a += 15) { const [x, z] = pol(36, a); B.b.add(cyl(0.5, 8, 6), brass, at(cx + x, L0 + 17, cz + z)); }
      keepOut.push([cx, cz, 42]);
    }
    // 324°: the conservatory. A glass dome on brass ribs over a garden.
    {
      const [cx, cz] = pol(362, -36);
      const dome: [number, number][] = [];
      for (let i = 0; i <= 16; i++) { const a = (i / 16) * (Math.PI / 2); dome.push([30 * Math.cos(a), L0 + 6 + 30 * Math.sin(a)]); }
      B.b.add(lathe(dome, 64), glass, at(cx, 0, cz), { shadow: false });
      for (let a = 0; a < 360; a += 15) {
        const pts = dome.map(([q, y]) => new THREE.Vector3(Math.sin(a * D2R) * (q + 0.3), y, Math.cos(a * D2R) * (q + 0.3)));
        B.b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.45, 5), brass, at(cx, 0, cz));
      }
      for (const y of [12, 22, 30]) { const q = Math.sqrt(Math.max(0, 900 - (y - 6) ** 2)); B.b.add(new THREE.TorusGeometry(q + 0.3, 0.4, 5, 64).rotateX(Math.PI / 2), brass, at(cx, L0 + y, cz)); }
      B.b.add(wall(30.5, L0, L0 + 6, 96), ivory, at(cx, 0, cz));
      B.b.add(ring(30, 33, L0 + 6, 96), ivory, at(cx, 0, cz));
      B.b.add(new THREE.SphereGeometry(2, 12, 8), beacon, at(cx, L0 + 37, cz), { shadow: false });
      keepOut.push([cx, cz, 36]);
    }
    B.done(110);
  }

  // ---- parks: trees in three species, people, lamps --------------------------------------------------
  const folk = new THREE.Group();
  city.add(folk);
  rises.push({ group: folk, t0: 3.4, dur: 0.6, height: 30 });
  const treeSpots: [number, number, number][] = [];
  for (const deg of CANALS) for (const sx of [-1, 1]) {
    for (let q = 300; q < R - 50; q += 16) { const [x, z] = pol(q, deg); const n = new THREE.Vector3(Math.cos(deg * D2R), 0, -Math.sin(deg * D2R)); treeSpots.push([x + n.x * sx * (deg === 0 ? 30 : 22), L0, z + n.z * sx * (deg === 0 ? 30 : 22)]); }
    for (let q = 118; q < 220; q += 22) { const [x, z] = pol(q, deg); const n = new THREE.Vector3(Math.cos(deg * D2R), 0, -Math.sin(deg * D2R)); treeSpots.push([x + n.x * sx * 22, L2, z + n.z * sx * 22]); }
  }
  // Groves on the lawn ring: clusters round a few centres per sector, plus trees lining the ring path.
  for (let k = 0; k < 5; k++) for (let g = 0; g < 5; g++) {
    const gd = 36 + k * 72 + (r() - 0.5) * 56, gq = 304 + r() * 46;
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * 16; const [x0, z0] = pol(gq, gd); const x = x0 + Math.cos(a) * rr, z = z0 + Math.sin(a) * rr; const deg = Math.atan2(x, z) / D2R; if (!CANALS.some((c) => Math.abs(((deg - c + 540) % 360) - 180) < 7)) treeSpots.push([x, L0, z]); }
  }
  for (let a = 0; a < 360; a += 3.2) { if (CANALS.some((c) => Math.abs(((a - c + 540) % 360) - 180) < 6)) continue; for (const q of [312, 340]) { const [x, z] = pol(q, a + (q > 320 ? 1.6 : 0)); treeSpots.push([x, L0, z]); } }
  for (let i = 0; i < 160; i++) { const deg = r() * 360, q = 300 + r() * 110; const near = CANALS.some((c) => Math.abs(((deg - c + 540) % 360) - 180) < 9); if (!near) { const [x, z] = pol(q, deg); if (!keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) treeSpots.push([x, L0, z]); } }
  for (let i = treeSpots.length - 1; i >= 0; i--) { const [x, , z] = treeSpots[i]; if (keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) treeSpots.splice(i, 1); }
  treeSpots.push(...roofTrees);
  // Trees in three species, each a few variants: canopies of displaced lobes shaded darker underneath, and
  // trunks that fork into branches. Every tree gets its own size, lean, turn and tint.
  const leafM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, vertexColors: true });
  leafM.name = 'leaves';
  const barkM = new THREE.MeshStandardMaterial({ color: 0x3b2a1d, roughness: 0.9 });
  cityLight(leafM, glowU, layout, 0.8);
  organic(leafM, 'leaves');
  cityLight(barkM, glowU, layout, 0.8);
  barkM.name = 'bark';
  const leafTints = [0x5f6a2c, 0x77702f, 0x8c7432, 0x4c5a28, 0x9a7a36, 0x667030];
  const variants: { leaf: THREE.BufferGeometry; bark: THREE.BufferGeometry }[] = [];
  for (let v = 0; v < 9; v++) variants.push(makeTree(v % 3, seeded(900 + v)));
  const bins: [number, number, number][][] = variants.map(() => []);
  treeSpots.forEach((sp, i) => bins[(i * 7 + Math.floor(r() * 3)) % variants.length].push(sp));
  variants.forEach((vg, vi) => {
    const spots = bins[vi];
    if (!spots.length) return;
    const im = new THREE.InstancedMesh(vg.leaf, leafM, spots.length);
    const tm = new THREE.InstancedMesh(vg.bark, barkM, spots.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    spots.forEach(([x, y, z], i) => {
      const sz = 1.05 + r() * 0.65;
      m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.12, r() * 6.28, (r() - 0.5) * 0.12)), new THREE.Vector3(sz, sz * (0.85 + r() * 0.3), sz));
      im.setMatrixAt(i, m4); tm.setMatrixAt(i, m4);
      col.setHex(leafTints[Math.floor(r() * leafTints.length)]).offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * 0.08);
      im.setColorAt(i, col);
    });
    for (const mm of [im, tm]) { mm.castShadow = true; mm.receiveShadow = true; folk.add(mm); }
    tris += (vg.leaf.getAttribute('position').count / 3 + vg.bark.getAttribute('position').count / 3) * spots.length;
  });
  // People: standing on the plaza and the promenade, in small groups.
  {
    const pm = person(0);
    const cloth = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, vertexColors: true });
    const n = 140 + deckFolk.length;
    const im = new THREE.InstancedMesh(pm, cloth, n);
    const cols = [0xefe6d6, 0xc9a56c, 0x6d4a2c, 0x2b211a, 0xd98a3c, 0x8c7a66];
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const onPlaza = i < 40;
      const deg = r() * 360, q = onPlaza ? 50 + r() * 26 : (i < 90 ? R - 25 + r() * 10 : 240 + r() * 40);
      let [x, z] = pol(q, deg);
      let y = onPlaza ? L3 : i < 90 ? L0 + 0.3 : L1;
      if (i >= 140) [x, y, z] = deckFolk[i - 140];
      m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6.28, 0)), new THREE.Vector3(1, 0.9 + r() * 0.2, 1));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    }
    im.castShadow = true;
    folk.add(im);
  }
  // Footpaths on the lawn: a ring between the tree lines and radial paths from the boulevard to the promenade.
  {
    const b = new Builder();
    b.add(ring(323, 329, L0 + 0.25, 256), promM, undefined, { uv: 'box' });
    for (let k = 0; k < 5; k++) for (const off of [-24, 24]) { const deg = 36 + k * 72 + off; b.add(rbox(5, 0.5, R - 40 - 292, 0.2), promM, xf({ p: [...((): [number, number, number] => { const [x, z] = pol((292 + R - 40) / 2, deg); return [x, L0 + 0.25, z]; })()], r: [0, deg * D2R, 0] }), { uv: 'box' }); }
    // Clipped hedges either side of the ring path, broken where the radial paths cross, and benches between.
    const hedgeM = organic(cityLight(new THREE.MeshStandardMaterial({ color: 0x4a5426, roughness: 0.9 }), glowU, layout, 0.8), 'leaves');
    hedgeM.name = 'hedge';
    for (let k = 0; k < 5; k++) for (const rr of [319.6, 332.4]) for (let a = 72 * k + 15; a <= 72 * k + 57; a += 1.15) { const [x, z] = pol(rr, a); b.add(rbox((rr * 1.15 * Math.PI) / 180 + 1.2, 2.6, 1.9, 0.25), hedgeM, xf({ p: [x, L0 + 1.3, z], r: [0, a * D2R, 0] })); }
    for (let k = 0; k < 5; k++) for (let a = 72 * k + 19; a < 72 * k + 55; a += 6) { const [x, z] = pol(326, a); const rot = xf({ p: [x, L0, z], r: [0, a * D2R, 0] }); b.add(rbox(4.2, 0.5, 1.3, 0.2), bronze, xf({ p: [0, 1.4, -1.6] }).premultiply(rot)); b.add(rbox(4.2, 1.4, 0.4, 0.15), bronze, xf({ p: [0, 2.1, -2.3] }).premultiply(rot)); for (const e of [-1.8, 1.8]) b.add(rbox(0.4, 1.4, 1, 0.1), dark, xf({ p: [e, 0.7, -1.6] }).premultiply(rot)); }
    b.build(folk, 'paths');
    // Shrubs in loose clusters on the lawn and round the trees.
    const shrubG = (() => { const parts: THREE.BufferGeometry[] = []; const rs = seeded(77); for (let i = 0; i < 5; i++) { const g = new THREE.IcosahedronGeometry(1.1 + rs() * 0.7, 2); g.translate((rs() - 0.5) * 3, 1 + rs() * 0.8, (rs() - 0.5) * 3); parts.push(g); } const w = mergeList(parts); w.deleteAttribute('normal'); w.deleteAttribute('uv'); const g = mergeVertices(w, 1e-3); g.computeVertexNormals(); const p = g.getAttribute('position'); const col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const k = 0.5 + 0.22 * p.getY(i); col.set([k, k, k], i * 3); } g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; })();
    const shrubs: [number, number][] = [];
    for (let c = 0; c < 70; c++) { const deg = r() * 360, q = 298 + r() * 112; const [x0, z0] = pol(q, deg); for (let i = 0; i < 5; i++) { const x = x0 + (r() - 0.5) * 12, z = z0 + (r() - 0.5) * 12; const dd = Math.atan2(x, z) / D2R, qq = Math.hypot(x, z); if (CANALS.some((cc) => Math.abs(((dd - cc + 540) % 360) - 180) < 7) || Math.abs(qq - 326) < 8 || keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue; shrubs.push([x, z]); } }
    const sim = new THREE.InstancedMesh(shrubG, leafM, shrubs.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    shrubs.forEach(([x, z], i) => { const s = 0.7 + r() * 0.6; m4.compose(new THREE.Vector3(x, L0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6.28, 0)), new THREE.Vector3(s, s * (0.7 + r() * 0.4), s)); sim.setMatrixAt(i, m4); sim.setColorAt(i, col.setHex([0x4c5a28, 0x5f6a2c, 0x6b5a2a, 0x8c6a30][i % 4])); });
    sim.castShadow = true; sim.receiveShadow = true;
    folk.add(sim);
  }
  // Lamps along the promenade.
  {
    const b = new Builder();
    for (let a = 0; a < 360; a += 6) { const [x, z] = pol(R - 30, a + 3); b.add(cyl(0.4, 11, 6), bronze, at(x, L0 + 5.5, z)); b.add(new THREE.SphereGeometry(1.2, 10, 8), lampHead, at(x, L0 + 11.6, z), { shadow: false }); b.add(cyl(1.5, 0.6, 10), bronze, at(x, L0 + 12.9, z)); }
    b.build(folk, 'lamps');
  }

  // ---- traffic: a ring train, pods on guideways, craft in the air, walkers ---------------------------
  // The ring train runs clockwise on an elevated track over the boulevard.
  {
    const b = new Builder();
    const TR = 262, TY = L1 + 18;
    const track = new THREE.TorusGeometry(TR, 1.2, 6, 240); track.rotateX(Math.PI / 2);
    b.add(track, bronze, at(0, TY - 2, 0));
    for (let a = 0; a < 360; a += 8) { const [x, z] = pol(TR, a); b.add(cyl(1, TY - 3 - L1, 8), ivory, at(x, L1 + (TY - 3 - L1) / 2, z)); }
    b.build(city, 'track');
    const car = rbox(7, 4, 18, 1.6, 2);
    const carM = new THREE.MeshStandardMaterial({ color: 0xe6dccb, roughness: 0.3, metalness: 0.2, emissive: 0xffb062, emissiveIntensity: 0.6 });
    const n = 12;
    const im = new THREE.InstancedMesh(car, carM, n);
    im.castShadow = true;
    city.add(im);
    const m4 = new THREE.Matrix4();
    movers.push({ mesh: im, update: (t) => {
      for (let i = 0; i < n; i++) {
        const train = Math.floor(i / 6), k = i % 6;
        const a = -(t * 9 + train * 180 + k * 4.2);
        const [x, z] = pol(TR, a);
        m4.compose(new THREE.Vector3(x, TY + 1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (a + 90) * D2R, 0)), new THREE.Vector3(1, 1, 1));
        im.setMatrixAt(i, m4);
      }
      im.instanceMatrix.needsUpdate = true;
    } });
  }
  // Pods on four radial guideways, going in and out.
  {
    const b = new Builder();
    const ways = [72, -72, 144, -144];
    for (const deg of ways) {
      const pts: THREE.Vector3[] = [];
      for (let q = 110; q <= 286; q += 16) { const [x, z] = pol(q, deg); pts.push(new THREE.Vector3(x, L2 + 40 - (q - 110) * 0.09, z)); }
      b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.8, 6), brass);
      for (let q = 140; q <= 270; q += 40) {
        const y = L2 + 40 - (q - 110) * 0.09, g0 = q > 232 ? L1 : L2, n = [Math.cos(deg * D2R), -Math.sin(deg * D2R)];
        const [x, z] = pol(q, deg);
        for (const sd of [-1, 1]) b.add(cyl(0.7, y - g0, 8), ivory, at(x + n[0] * sd * 10, (y + g0) / 2, z + n[1] * sd * 10));
        b.add(rbox(22, 1.4, 1.6, 0.4), ivory, xf({ p: [x, y - 1.6, z], r: [0, deg * D2R, 0] }));
      }
    }
    b.build(city, 'guideways');
    const pod = new THREE.CapsuleGeometry(2.2, 6, 4, 10); pod.rotateX(Math.PI / 2);
    const podM = new THREE.MeshStandardMaterial({ color: 0xd0a45a, metalness: 0.8, roughness: 0.3, emissive: 0xff9a50, emissiveIntensity: 0.5 });
    const n = ways.length * 4;
    const im = new THREE.InstancedMesh(pod, podM, n);
    im.castShadow = true;
    city.add(im);
    const m4 = new THREE.Matrix4();
    movers.push({ mesh: im, update: (t) => {
      for (let i = 0; i < n; i++) {
        const w = Math.floor(i / 4), k = i % 4, dir = k % 2 ? 1 : -1;
        const ph = ((t * 0.09 * dir + k * 0.27 + w * 0.13) % 1 + 1) % 1;
        const q = 110 + ph * 176, deg = ways[w];
        const [x, z] = pol(q, deg + (dir > 0 ? 0.6 : -0.6));
        const y = L2 + 40 - (q - 110) * 0.09 + 2.4;
        m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, deg * D2R + (dir > 0 ? 0 : Math.PI), 0)), new THREE.Vector3(1, 1, 1));
        im.setMatrixAt(i, m4);
      }
      im.instanceMatrix.needsUpdate = true;
    } });
  }
  // Craft in the air: two loops at two heights, one each way, each craft with a warm running light.
  {
    const body = new THREE.SphereGeometry(1, 24, 14); body.scale(4.2, 1.5, 9);
    const wing = rbox(13, 0.5, 3.2, 0.25); wing.translate(0, -0.3, -2.5);
    const nacL = cyl(1.1, 6, 12); nacL.rotateX(Math.PI / 2); nacL.translate(-6, -0.2, -2.6);
    const nacR = cyl(1.1, 6, 12); nacR.rotateX(Math.PI / 2); nacR.translate(6, -0.2, -2.6);
    const tail = rbox(0.5, 3, 3, 0.2); tail.translate(0, 1.6, -7);
    const craftGeo = mergeList([body, wing, nacL, nacR, tail]);
    const canopyGeo = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2); canopyGeo.scale(2.4, 1.4, 3.6); canopyGeo.translate(0, 0.9, 3.2);
    const lightGeo = mergeList([new THREE.SphereGeometry(0.6, 8, 6).translate(-6, -0.2, -5.7), new THREE.SphereGeometry(0.6, 8, 6).translate(6, -0.2, -5.7), new THREE.SphereGeometry(0.45, 8, 6).translate(0, 3.2, -7.4)]);
    const craftM = new THREE.MeshStandardMaterial({ color: 0xece2d0, metalness: 0.35, roughness: 0.3 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0x1a130d, metalness: 0.3, roughness: 0.08, envMapIntensity: 1.6 });
    const n = 10;
    const im = new THREE.InstancedMesh(craftGeo, craftM, n);
    const cm = new THREE.InstancedMesh(canopyGeo, glassM, n);
    const lm = new THREE.InstancedMesh(lightGeo, lampHead, n);
    im.castShadow = true;
    city.add(im, cm, lm);
    const m4 = new THREE.Matrix4();
    movers.push({ mesh: cm, update: () => { cm.instanceMatrix.needsUpdate = true; } });
    movers.push({ mesh: lm, update: () => { lm.instanceMatrix.needsUpdate = true; } });
    movers.push({ mesh: im, update: (t) => {
      for (let i = 0; i < n; i++) {
        const lane = i % 2, dir = lane ? 1 : -1;
        const a = (t * (lane ? 7 : 5) * dir + i * 36) % 360;
        const rr = lane ? 300 : 360, y = lane ? 170 + 8 * Math.sin(t * 0.7 + i) : 240 + 10 * Math.sin(t * 0.5 + i * 2);
        const [x, z] = pol(rr, a);
        m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05 * dir, (a + 90 * dir) * D2R, 0.18 * dir)), new THREE.Vector3(1, 1, 1));
        im.setMatrixAt(i, m4); cm.setMatrixAt(i, m4); lm.setMatrixAt(i, m4);
      }
      im.instanceMatrix.needsUpdate = true;
    } });
  }
  // Walkers on the promenade, both ways.
  {
    const im = new THREE.InstancedMesh(person(1), new THREE.MeshStandardMaterial({ color: 0xd9cbb4, roughness: 0.7, vertexColors: true }), 36);
    im.castShadow = true;
    folk.add(im);
    const m4 = new THREE.Matrix4();
    movers.push({ mesh: im, update: (t) => {
      for (let i = 0; i < 36; i++) {
        const dir = i % 2 ? 1 : -1;
        const a = (t * 1.6 * dir + i * 10) % 360;
        const [x, z] = pol(R - 20 + (i % 3) * 3, a);
        const bob = Math.abs(Math.sin(t * 6 + i)) * 0.4;
        m4.compose(new THREE.Vector3(x, L0 + 0.3 + bob, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
        im.setMatrixAt(i, m4);
      }
      im.instanceMatrix.needsUpdate = true;
    } });
  }

  // ---- the slab under the city, with its grid and the pools where the falls land -----------------------
  // The slab fades into the page with distance, so it has no edge and no horizon line.
  const slabG = new THREE.CircleGeometry(4000, 128); slabG.rotateX(-Math.PI / 2);
  const gridTex = grid(); gridTex.repeat.set(40, 40);
  const fade = radial([[0, 1], [0.225, 1], [0.75, 0]]);
  const slabM = new THREE.MeshStandardMaterial({ color: 0x0f0c0a, roughness: 0.55, metalness: 0.2, emissive: 0xffffff, emissiveMap: gridTex, emissiveIntensity: 0.32, alphaMap: fade, transparent: true });
  slabM.name = 'slab';
  const slabMesh = new THREE.Mesh(slabG, slabM);
  slabMesh.position.y = -CITY.LIFT;
  slabMesh.receiveShadow = true;
  // Drawn before every light-water layer, which writes no depth and would otherwise be painted over.
  slabMesh.renderOrder = -10;
  slabMesh.userData.noWire = true;
  root.add(slabMesh);
  const poolM = new THREE.ShaderMaterial({ vertexShader: POOL_VS, fragmentShader: POOL_FS, uniforms: { uTime: { value: 0 }, uOp: { value: 0 }, uSeed: { value: 0 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sprayM = new THREE.ShaderMaterial({ vertexShader: SPRAY_VS, fragmentShader: SPRAY_FS, uniforms: { uTime: { value: 0 }, uOp: { value: 0 }, uPx: { value: 400 }, uG: { value: G } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sprayPos: number[] = [], spraySeed: number[] = [];
  const pools: THREE.ShaderMaterial[] = [];
  const mists: THREE.SpriteMaterial[] = [];
  const crowns: THREE.ShaderMaterial[] = [];
  const crownM = new THREE.ShaderMaterial({ vertexShader: CROWN_VS, fragmentShader: CROWN_FS, uniforms: { uTime: { value: 0 }, uOp: { value: 0 }, uH: { value: 8 }, uSeed: { value: 0 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const mistTex = radial([[0, 0.55], [0.4, 0.18], [1, 0]]);
  for (const deg of CANALS) {
    const [x, z] = pol(LAND + 2, deg);
    const n = deg === 0 ? 220 : 120;
    for (let i = 0; i < n; i++) { sprayPos.push(x + (r() - 0.5) * 14, -CITY.LIFT + 0.5, z + (r() - 0.5) * 10); spraySeed.push(r(), r(), r(), 1.4 + r() * 1.8); }
    const pm = poolM.clone();
    pm.uniforms.uSeed.value = r();
    pools.push(pm);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(deg === 0 ? 64 : 44, 64).rotateX(-Math.PI / 2), pm);
    pool.position.set(x, -CITY.LIFT + 0.5, z);
    pool.userData.noWire = true;
    root.add(pool);
    // A crown of water thrown up round the impact, flickering.
    { const cg = new THREE.CylinderGeometry(deg === 0 ? 11 : 8, deg === 0 ? 5 : 3.6, deg === 0 ? 9 : 6.5, 64, 1, true); cg.translate(0, (deg === 0 ? 9 : 6.5) / 2, 0); const cm = crownM.clone(); cm.uniforms.uH.value = deg === 0 ? 9 : 6.5; cm.uniforms.uSeed.value = r() * 10; crowns.push(cm); const crown = new THREE.Mesh(cg, cm); crown.position.set(x, -CITY.LIFT + 0.4, z); crown.userData.noWire = true; root.add(crown); }
    // Mist hanging over the landing.
    const mm = new THREE.SpriteMaterial({ map: mistTex, color: new THREE.Color(0xff9a48).multiplyScalar(0.9), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
    mists.push(mm);
    const mist = new THREE.Sprite(mm);
    mist.position.set(x, -CITY.LIFT + (deg === 0 ? 16 : 12), z);
    mist.scale.setScalar(deg === 0 ? 70 : 50);
    mist.userData.noWire = true;
    root.add(mist);
  }
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(sprayPos, 3));
    g.setAttribute('seed', new THREE.Float32BufferAttribute(spraySeed, 4));
    const pts = new THREE.Points(g, sprayM);
    pts.frustumCulled = false;
    pts.userData.noWire = true;
    root.add(pts);
  }
  // Drops riding the falls, with the city.
  const riderM = new THREE.ShaderMaterial({ vertexShader: RIDER_VS, fragmentShader: SPRAY_FS, uniforms: { uTime: sprayM.uniforms.uTime, uOp: sprayM.uniforms.uOp, uPx: sprayM.uniforms.uPx, uG: { value: G }, uV: { value: VCANAL }, uT: { value: FALL_T } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  {
    const pos: number[] = [], sd: number[] = [], dr: number[] = [];
    CANALS.forEach((deg, ci) => { const w = ci === 0 ? 20 : 13, n = ci === 0 ? 260 : 150; const [x, z] = pol(R + 4, deg); for (let i = 0; i < n; i++) { pos.push(x, 0.6, z); sd.push(r(), r(), r(), w); dr.push(Math.sin(deg * D2R), Math.cos(deg * D2R)); } });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.Float32BufferAttribute(sd, 4));
    g.setAttribute('dir', new THREE.Float32BufferAttribute(dr, 2));
    const pts = new THREE.Points(g, riderM);
    pts.frustumCulled = false;
    pts.userData.noWire = true;
    city.add(pts);
  }
  // Spray at the foot of every cascade, riding with the city.
  {
    const pos: number[] = [], sd: number[] = [];
    for (const [deg, rr, y, w] of cascades) for (let i = 0; i < 26; i++) {
      const l = (r() - 0.5) * w * 0.9, q = rr + r() * 3, c = Math.cos(deg * D2R), sn = Math.sin(deg * D2R);
      pos.push(q * sn + l * c, y, q * c - l * sn);
      sd.push(r(), r(), r() * 0.35, 0.8 + r() * 1.0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.Float32BufferAttribute(sd, 4));
    const pts = new THREE.Points(g, sprayM);
    pts.frustumCulled = false;
    pts.userData.noWire = true;
    city.add(pts);
  }

  // The plan drawn in light at the start of the opening: rings and spokes on the ground.
  const planM = new THREE.ShaderMaterial({ vertexShader: WATER_VS, fragmentShader: PLAN_FS, uniforms: { uDraw: { value: 0 }, uFade: { value: 0 }, uR: { value: R * CITY.SCALE } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  {
    const rows: THREE.BufferGeometry[] = [];
    for (const rr of [92, 104, 234, 292, R - 40, R]) {
      const rs: Row[] = [];
      for (let a = 0; a <= 360; a += 2) { const [x, z] = pol(rr, a); rs.push({ c: new THREE.Vector3(x, 0, z), side: new THREE.Vector3(x, 0, z).normalize(), w: 1.6, s: a, f: 0 }); }
      rows.push(strip(rs, 2));
    }
    for (const deg of [...CANALS, 36, -36, 108, -108, 180]) {
      const rs: Row[] = [];
      for (let q = 0; q <= R; q += 8) { const [x, z] = pol(q, deg); rs.push({ c: new THREE.Vector3(x, 0, z), side: new THREE.Vector3(Math.cos(deg * D2R), 0, -Math.sin(deg * D2R)), w: 1.2, s: q, f: 0 }); }
      rows.push(strip(rs, 2));
    }
    const plan = new THREE.Mesh(mergeList(rows), planM);
    plan.position.y = -CITY.LIFT + 0.6;
    plan.frustumCulled = false;
    plan.userData.noWire = true;
    root.add(plan);
  }

  // Amber light from the water onto the terraces and the slab (no shadows: these are cheap fills).
  const glowLights: THREE.PointLight[] = [];
  for (const deg of CANALS) {
    const [x, z] = pol(LAND, deg);
    const L = new THREE.PointLight(0xffbf7a, deg === 0 ? 0.05 : 0.03, 0.3, 2);
    L.position.set(x * CITY.SCALE, -0.17, z * CITY.SCALE);
    glowLights.push(L);
  }

  return { root, city, rises, movers, water, falls: fallM, plan: planM, slab: slabM, pools, mists, crowns, spray: sprayM, glow: glowU, rooms, glowLights, tris };
}

function radial(stops: [number, number][] = [[0, 1], [0.35, 0.45], [1, 0]]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [at, a] of stops) gr.addColorStop(at, `rgba(255,255,255,${a})`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// Merge plain geometries that share only position, normal, uv and the water attributes.
function mergeList(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const keep = ['position', 'normal', 'uv', 'flow', 'lane', 'color'];
  const clean = list.map((g) => { const n = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(n.attributes)) if (!keep.includes(k)) n.deleteAttribute(k); return n; });
  const common = Object.keys(clean[0].attributes).filter((k) => clean.every((g) => g.getAttribute(k)));
  for (const g of clean) for (const k of Object.keys(g.attributes)) if (!common.includes(k)) g.deleteAttribute(k);
  const out = mergeGeometries(clean, false);
  if (!out) throw new Error('mergeList: geometries do not match');
  return out;
}


// A curved face of rooms: an arc of a cylinder about (0, 0, cz), facing in toward that centre or out from it.
function roomsArc(rad: number, cz: number, y0: number, y1: number, len: number, seg: number, o: { floor: number; bays: number; depth: number; seed: number; inward: boolean }): THREE.BufferGeometry {
  const floors = Math.max(1, Math.round((y1 - y0) / o.floor));
  const g = new THREE.CylinderGeometry(rad, rad, y1 - y0, seg, floors, true, Math.PI - len / 2, len);
  g.translate(0, (y0 + y1) / 2, cz);
  const p = g.getAttribute('position'), uv = g.getAttribute('uv');
  const cell = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, uv.getX(i) * o.bays, (p.getY(i) - y0) / o.floor);
    cell.set([(rad * len) / o.bays, o.floor, o.depth, o.seed], i * 4);
  }
  g.setAttribute('cell', new THREE.Float32BufferAttribute(cell, 4));
  if (o.inward) { g.scale(-1, 1, 1); g.computeVertexNormals(); }
  return g;
}

// One tree: kind 0 a broad lobed crown, 1 a tall columnar crown, 2 a layered conifer. Millimetres, base at 0.
function makeTree(kind: number, rnd: () => number): { leaf: THREE.BufferGeometry; bark: THREE.BufferGeometry } {
  const lobes: THREE.BufferGeometry[] = [];
  const bark: THREE.BufferGeometry[] = [];
  const lump = (rad: number, x: number, y: number, z: number, sy = 1, detail = 1) => {
    const g = new THREE.IcosahedronGeometry(rad, detail);
    const p = g.getAttribute('position'), ph = rnd() * 6.28;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const k = 1 + 0.22 * Math.sin(vx * 3.1 + ph) * Math.cos(vz * 2.7) + 0.12 * Math.sin(vy * 5.3 + vx * 1.7);
      p.setXYZ(i, vx * k, vy * k * sy, vz * k);
    }
    g.translate(x, y, z);
    lobes.push(g);
  };
  const limb = (a: THREE.Vector3, b: THREE.Vector3, r0: number) => bark.push(new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, r0, 5, false));
  if (kind === 0) {
    const H = 8 + rnd() * 2;
    limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, H, 0), 0.55);
    const n = 11 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 * 2.3 + rnd() * 0.8, rr = 1.4 + rnd() * 3.4, y = H + 0.5 + rnd() * 5;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (i % 2 === 0) limb(new THREE.Vector3(0, H - 2.5, 0), new THREE.Vector3(x * 0.7, y - 0.8, z * 0.7), 0.22);
      lump(1.5 + rnd() * 1.1, x, y, z, 0.8, 2);
    }
    lump(2.2, 0, H + 4.2, 0, 0.85, 2);
  } else if (kind === 1) {
    const H = 3 + rnd();
    limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, H + 4, 0), 0.45);
    for (let i = 0; i < 4; i++) lump(2.1 - i * 0.25, (rnd() - 0.5) * 0.8, H + 3 + i * 3.4, (rnd() - 0.5) * 0.8, 1.6, 1);
  } else {
    limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 16, 0), 0.4);
    for (let i = 0; i < 5; i++) {
      const c = new THREE.ConeGeometry(4.6 - i * 0.85, 3.6, 10, 2, true);
      const p = c.getAttribute('position');
      for (let j = 0; j < p.count; j++) { const vx = p.getX(j), vz = p.getZ(j), vy = p.getY(j); const k = vy < 0 ? 1 + 0.18 * Math.sin(Math.atan2(vz, vx) * 5 + i) : 1; p.setXYZ(j, vx * k, vy - (vy < 0 ? 0.6 * Math.abs(Math.sin(Math.atan2(vz, vx) * 5 + i)) : 0), vz * k); }
      c.translate(0, 5.5 + i * 2.4, 0);
      c.rotateY(rnd() * 3);
      lobes.push(c);
    }
  }
  // Weld the lobes so each is smooth shaded, not faceted.
  const welded = mergeList(lobes);
  welded.deleteAttribute('normal');
  welded.deleteAttribute('uv');
  const leaf = mergeVertices(welded, 1e-3);
  leaf.computeVertexNormals();
  // Darker underneath and inside, lighter on top, as a crown shades itself.
  leaf.computeBoundingBox();
  const bb = leaf.boundingBox!, p = leaf.getAttribute('position');
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - bb.min.y) / Math.max(1e-3, bb.max.y - bb.min.y);
    const out = Math.min(1, Math.hypot(p.getX(i), p.getZ(i)) / 4);
    const k = 0.45 + 0.4 * t + 0.25 * out;
    col.set([k, k, k], i * 3);
  }
  leaf.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return { leaf, bark: mergeList(bark) };
}

// A person about 8 mm tall: legs, a torso with shoulders, arms, a head. Pose 1 is mid stride.
function person(pose: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, shade = 1) => { g.rotateX(rx); g.translate(x, y, z); const n = g.getAttribute('position').count; g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(shade), 3)); parts.push(g); };
  const stride = pose ? 0.35 : 0.05;
  add(new THREE.CapsuleGeometry(0.42, 3.0, 2, 6), -0.5, 1.9, 0, stride, 0.3);
  add(new THREE.CapsuleGeometry(0.42, 3.0, 2, 6), 0.5, 1.9, 0, -stride, 0.3);
  const torso = new THREE.CapsuleGeometry(0.95, 2.0, 3, 8); torso.scale(1.15, 1, 0.75); add(torso, 0, 4.9, 0);
  add(new THREE.CapsuleGeometry(0.3, 2.4, 2, 5), -1.3, 4.6, 0, -stride * 0.8);
  add(new THREE.CapsuleGeometry(0.3, 2.4, 2, 5), 1.3, 4.6, 0, stride * 0.8);
  add(new THREE.SphereGeometry(0.85, 10, 8), 0, 7.4, 0, 0, 0.62);
  return mergeList(parts);
}

// A fall as a ribbon about its centre line: every row's centre twice (or more), each copy with its lane, the flow
// direction and the width, so the vertex shader can turn it to face the camera.
function fallStrip(rows: Row[], across: number): THREE.BufferGeometry {
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
  const W = across + 1;
  for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < across; i++) { const a = j * W + i; idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 4));
  g.setAttribute('lane', new THREE.Float32BufferAttribute(lane, 1));
  g.setAttribute('tang', new THREE.Float32BufferAttribute(tang, 3));
  g.setAttribute('wid', new THREE.Float32BufferAttribute(wid, 1));
  g.setIndex(idx);
  return g;
}
