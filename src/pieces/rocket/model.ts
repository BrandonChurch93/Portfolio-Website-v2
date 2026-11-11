import * as THREE from 'three';
import { Builder, at, cyl, lathe, rbox, seeded, xf } from '../../world/build';
import { circle, rounded, screw, slab, type P2, type V } from '../../world/shape';
import { dielectric, glassLayer, metal, shade } from '../../world/surface';
import { site } from '../../content/site';
import { crownMesh, dropsAt, dropsMaterial, fallStrip, riders, waterMaterial, waterStrip, type WaterRow } from '../../world/lightwater';

const RW = site.pieces.rocket;

// The rocket on its pad, in millimetres (the root is scaled by 0.001). The pad's deck top is y = 0; the rocket stands
// on its clamps over the flame hole at the origin; the gantry stands beside it at +x; the pad rises on pillars out
// of a shallow pool of light-water whose surface is y = POOL.

export const RKT = { SCALE: 0.001, POOL: -104, POOL_R: 340, GANTRY_X: 172, TOP: 640 } as const;
const TOWER_FEET: [number, number][] = [[144, -28], [200, -28], [200, 28], [144, 28]];
// The flume that brings the page's stream to the pool: its direction from the centre (radians in x, z), its length
// over the apron, the water's speed along it (mm/s) and gravity for the pour (mm/s2, the scale the other pieces use).
export const FLUME = { A: 2.3, LEN: 1500, W: 22, VRUN: 240, G: 2600 } as const;
const D2R = Math.PI / 180;

export interface Swing { group: THREE.Group; rest: number; out: number }
export interface Clamp { group: THREE.Group; angle: number }
export interface Tied { obj: THREE.Object3D; y: number; base: number }

export interface RocketModel {
  root: THREE.Group;
  rocket: THREE.Group;
  stages: THREE.Group[];
  gantry: THREE.Group[];
  tied: Tied[];
  beaconLight: THREE.PointLight;
  arms: Swing[];
  clamps: Clamp[];
  sling: THREE.Group;
  cable: THREE.Mesh;
  plume: THREE.Mesh;
  plumeMat: THREE.ShaderMaterial;
  flash: THREE.Mesh;
  smoke: THREE.Points;
  smokeMat: THREE.ShaderMaterial;
  pool: THREE.MeshPhysicalMaterial;
  beacons: THREE.MeshBasicMaterial;
  portholes: THREE.MeshStandardMaterial;
  floods: THREE.SpotLight[];
  floodLens: THREE.MeshBasicMaterial;
  engineLight: THREE.PointLight;
  poolLight: THREE.RectAreaLight;
  water: THREE.ShaderMaterial[];
  drops: THREE.ShaderMaterial;
  ride: THREE.ShaderMaterial;
  flume: { far: THREE.Vector3; lip: THREE.Vector3; sLand: number; sEnd: number };
  inletLight: THREE.PointLight;
  centre: THREE.Vector3;
}

// The pool: a shallow sheet of light-water under the pad. Its surface is glossy water lit by the scene (the lamp's
// highlight and the shadows of the pad and the rocket fall on it); the light-water glows up through it. Rings spread
// from the pillars and cross, a caustic web drifts at two scales, the meniscus brightens at the rim, and the pillars
// and the pad's underside are mirrored in it as darker shapes, worked out from the camera. uSurge is the launch: the
// rings grow and run faster and the whole pool lights up. uFill is the entrance: light spreads out from the centre.
function poolMaterial(): THREE.MeshPhysicalMaterial {
  const R = RKT.POOL_R;
  const m = new THREE.MeshPhysicalMaterial({ color: 0x0b0806, roughness: 0.15, metalness: 0, specularIntensity: 1, ior: 1.33 });
  m.name = 'rocketPool';
  m.userData.uniforms = { uTime: { value: 0 }, uSurge: { value: 0 }, uGain: { value: 1 }, uFill: { value: 1 }, uCam: { value: new THREE.Vector3(0, 2000, 800) }, uInlet: { value: new THREE.Vector3(0, 0, 0) } };
  shade(m, 'rocket-pool', {
    head: /* glsl */ `
uniform float uTime, uSurge, uGain, uFill;
uniform vec3 uInlet; // where the flume pours in (x, y in the pool's plane) and how far the water has come (z, 0 to 1)
uniform vec3 uCam; // the camera in the pool's own plane (x, y) and its height above the water (z), millimetres
float ph(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ph(i), ph(i + vec2(1,0)), f.x), mix(ph(i + vec2(0,1)), ph(i + vec2(1,1)), f.x), f.y); }
float caustics(vec2 q, float t){
  float c1 = pn(q + vec2(t * 0.11, t * 0.07)) + 0.5 * pn(q * 2.1 + vec2(-t * 0.09, t * 0.12));
  float c2 = pn(q * 1.3 - vec2(t * 0.07, -t * 0.1) + 7.0) + 0.5 * pn(q * 2.6 + 3.0 + t * 0.08);
  return pow(1.0 - abs(c1 - c2), 22.0);
}
// How much of what the water mirrors here is a dark part of the pad: the pillars (vertical, 78 mm tall) and the
// deck's underside (78 mm up). A ray from the camera through this point, mirrored, travels on below the surface;
// where it would meet those parts it sees them instead of the room.
float mirrored(vec2 p){
  vec2 away = p - uCam.xy;
  float sub = 78.0 / max(uCam.z, 1.0);
  float hit = 0.0;
  vec2 q = p + away * sub;
  hit = max(hit, 1.0 - smoothstep(140.0, 158.0, length(q)));
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.785398 + 0.392699;
    vec2 c = vec2(cos(a), sin(a)) * 118.0;
    vec2 toC = c - p;
    vec2 dir = normalize(away + 1e-4);
    float along = dot(toC, dir);
    float across = length(toC - dir * along);
    float reach = length(away) * sub;
    hit = max(hit, (1.0 - smoothstep(10.0, 15.0, across)) * step(-14.0, along) * (1.0 - smoothstep(reach - 10.0, reach + 6.0, along)));
  }
  for (int j = 0; j < 4; j++) {
    vec2 c = vec2(j == 0 || j == 3 ? 144.0 : 200.0, j < 2 ? 28.0 : -28.0);
    vec2 toC = c - p;
    vec2 dir = normalize(away + 1e-4);
    float along = dot(toC, dir);
    float across = length(toC - dir * along);
    float reach = length(away) * 104.0 / max(uCam.z, 1.0);
    hit = max(hit, (1.0 - smoothstep(7.0, 11.0, across)) * step(-10.0, along) * (1.0 - smoothstep(reach - 10.0, reach + 6.0, along)));
  }
  return hit;
}`,
    normal: /* glsl */ `
  {
    vec2 wp = vObj.xy * 0.05; float wt = uTime * 0.7; float e = 0.35;
    float hx = pn(wp + vec2(e, 0.0) + wt) - pn(wp - vec2(e, 0.0) + wt) + 0.5 * (pn(wp * 2.3 + vec2(e, 0.0) - wt) - pn(wp * 2.3 - vec2(e, 0.0) - wt));
    float hy = pn(wp + vec2(0.0, e) + wt) - pn(wp - vec2(0.0, e) + wt) + 0.5 * (pn(wp * 2.3 + vec2(0.0, e) - wt) - pn(wp * 2.3 - vec2(0.0, e) - wt));
    normal = normalize(normal - (vAxX * hx + vAxY * hy) * (0.16 + 0.5 * uSurge));
  }`,
    emissive: /* glsl */ `
  {
    vec2 vP = vObj.xy;
    float r = length(vP);
    float t = uTime;
    float rings = 0.5 + 0.5 * sin(r * (0.07 - 0.02 * uSurge) - t * (1.4 + 4.0 * uSurge));
    rings = pow(rings, 6.0) * (0.07 + 0.93 * uSurge) * exp(-r * 0.004);
    float pr = 0.0;
    for (int k = 0; k < 12; k++) {
      vec2 c; float rad;
      if (k < 8) { float a = float(k) * 0.785398 + 0.392699; c = vec2(cos(a), sin(a)) * 118.0; rad = 13.0; }
      else { int j = k - 8; c = vec2(j == 0 || j == 3 ? 144.0 : 200.0, j < 2 ? 28.0 : -28.0); rad = 9.0; }
      float d = length(vP - c);
      pr += pow(0.5 + 0.5 * sin(d * 0.24 - t * 2.2 + float(k) * 1.7), 8.0) * exp(-(d - rad) * 0.025) * smoothstep(rad, rad + 4.0, d);
      pr += exp(-pow((d - rad - 1.5) / 2.2, 2.0)) * 1.6;
    }
    float patchy = smoothstep(0.25, 0.75, pn(vP * 0.008 + vec2(t * 0.01, 3.0)));
    float fine = caustics(vP * 0.075, t) * (0.35 + 0.65 * patchy);
    float broad = caustics(vP * 0.022 + 4.0, t * 0.6) * (1.0 - 0.5 * patchy);
    float glint = step(0.985, ph(floor(vP * 0.5) + floor(t * 3.0))) * fine;
    float rim = smoothstep(${R - 25}.0, ${R - 1}.0, r) * (1.0 - smoothstep(${R - 1}.0, ${R + 2}.0, r));
    float under = exp(-r * 0.0045);
    float body = (0.05 + 0.035 * pn(vP * 0.0135 + t * 0.03)) * (0.55 + 0.9 * under);
    float di = length(vP - uInlet.xy);
    float inlet = uInlet.z * (pow(0.5 + 0.5 * sin(di * 0.2 - t * 3.0), 6.0) * exp(-di * 0.012) + exp(-di * 0.05) * 0.8);
    float k = body + (fine * 0.26 + broad * 0.12) * (0.6 + 0.4 * under) + glint * 0.4 + pr * 0.3 + rings * 0.45 + rim * 0.3 + inlet * 0.5;
    float front = uFill * ${R + 30}.0;
    k *= mix(0.16, 1.0, smoothstep(front, front - 60.0, r)) + exp(-pow((r - front + 20.0) / 18.0, 2.0)) * 0.9 * step(uFill, 0.999);
    k *= (1.0 + 2.2 * uSurge) * uGain;
    k *= 1.0 - smoothstep(${R - 4}.0, ${R + 2}.0, r);
    k *= 1.0 - 0.55 * mirrored(vP);
    vec3 col = mix(vec3(1.0, 0.46, 0.1), vec3(1.0, 0.8, 0.48), clamp(fine * 0.5 + rings * 0.5 + glint, 0.0, 1.0));
    totalEmissiveRadiance = col * k * 0.6;
  }`,
  });
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    base.call(m, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight -= reflectedLight.indirectSpecular * 0.8 * mirrored(vObj.xy);\n#include <opaque_fragment>');
  };
  return m;
}

// The plume: a cone of light below the nozzles, a white-gold core, shock diamonds down its length, noise that
// flickers along it. uLen is its length (mm), uK its strength.
function plumeMaterial(): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uK: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 w = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-w.xyz); gl_Position = projectionMatrix * w; }',
    fragmentShader: /* glsl */ `
uniform float uTime, uK;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }
void main(){
  float y = 1.0 - vUv.y; // 0 at the nozzle, 1 at the tail
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float diamonds = 0.45 + 0.55 * pow(0.5 + 0.5 * cos(y * 30.0 - 0.6), 4.0) * smoothstep(0.75, 0.05, y);
  float flick = 0.6 + 0.6 * n(vec2(vUv.x * 9.0, y * 7.0 - uTime * 18.0)) * (0.6 + 0.4 * n(vec2(vUv.x * 23.0, y * 2.0 - uTime * 9.0)));
  float tear = smoothstep(0.0, 0.35, n(vec2(vUv.x * 7.0, y * 5.0 - uTime * 11.0)) + 0.55 - y * 0.95);
  float k = edge * diamonds * flick * tear * pow(1.0 - y, 1.4) * uK;
  vec3 col = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.9, 0.7), pow(1.0 - y, 4.0) * edge);
  gl_FragColor = vec4(col * k * 2.2, 1.0);
}`,
  });
  m.name = 'rocketPlume';
  return m;
}

// Ground smoke at launch: stateless billows, each from its seed and the launch time. They roll out from under the
// pad across the pool, rise, grow and thin. Lit warm by the exhaust while it burns.
function smokeMaterial(): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: { value: -1 }, uPx: { value: 1 }, uLit: { value: 0 } },
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
attribute vec4 seed; // angle, delay, speed, size
uniform float uT, uPx;
varying float vA; varying float vAge; varying vec2 vS;
void main(){
  vS = seed.xw;
  float age = uT - seed.y * 2.6;
  vAge = age;
  vec3 p = vec3(0.0, -10.0, 0.0);
  if (age > 0.0) {
    float travel = (300.0 + seed.z * 420.0) * (1.0 - exp(-age * 0.6));
    p = vec3(cos(seed.x) * travel, -70.0 + age * (6.0 + seed.z * 10.0) + seed.w * 26.0 + smoothstep(0.0, 300.0, travel) * 20.0, sin(seed.x) * travel);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float life = clamp(age / 6.5, 0.0, 1.0);
  vA = age > 0.0 ? smoothstep(0.0, 0.6, age) * pow(1.0 - life, 1.6) : 0.0;
  gl_PointSize = (30.0 + seed.w * 46.0) * (1.0 + age * 0.6) * uPx / -mv.z;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform float uLit;
varying float vA; varying float vAge; varying vec2 vS;
float sh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(sh(i), sh(i + vec2(1,0)), f.x), mix(sh(i + vec2(0,1)), sh(i + vec2(1,1)), f.x), f.y); }
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float spin = vAge * (0.3 + 0.3 * fract(vS.x)) * (fract(vS.y * 7.0) > 0.5 ? 1.0 : -1.0);
  vec2 cr = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * c;
  vec2 q = cr * 3.6 + vS * 7.0;
  float lump = sn(q) * 0.6 + sn(q * 2.1 + 3.0) * 0.3 + sn(q * 4.3 + 9.0) * 0.1;
  float d = dot(c, c) * 4.0 + (lump - 0.5) * 1.1;
  if (d > 1.0) discard;
  float a = smoothstep(1.0, 0.4, d) * vA * 0.5 * (0.6 + 0.8 * lump);
  float tone = 0.7 + 0.6 * fract(vS.x * 3.7 + vS.y * 1.3);
  float shade = 0.35 + 1.3 * clamp(-c.y * 1.8 + 0.4, 0.0, 1.0) * (0.4 + 0.6 * lump);
  vec3 smoke = vec3(0.072, 0.064, 0.058) * tone * shade + vec3(0.06, 0.028, 0.008) * clamp(c.y * 2.0 + 0.3, 0.0, 1.0);
  vec3 lit = vec3(1.0, 0.5, 0.18) * (uLit * 0.55 * exp(-vAge * 0.6) + 0.05) * clamp(c.y * 2.0 + 0.6, 0.0, 1.0);
  gl_FragColor = vec4(smoke + lit, a);
}`,
  });
  m.name = 'rocketSmoke';
  return m;
}

// Ivory enamel over riveted skin panels: seams between the panels (vertical down the stages, gores on the nose), a
// line of rivets either side of each ring seam, each panel a slightly different ivory, wear and grime toward the base.
export const DECAL = { a0: 22 * D2R, span: 80 * D2R, y0: 60, y1: 600 } as const;
function decalTexture(): THREE.CanvasTexture {
  const W = 256, H = 2816;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#fff';
  const yPx = (y: number) => H - ((y - DECAL.y0) / (DECAL.y1 - DECAL.y0)) * H;
  const font = (px: number) => `700 ${px}px "JetBrains Mono Variable", monospace`;
  // The name, stencilled down the first stage, one letter above another.
  g.font = font(64); g.textAlign = 'center'; g.textBaseline = 'middle';
  const name = RW.name.toUpperCase();
  for (let i = 0; i < name.length; i++) g.fillText(name[i], W * 0.5, yPx(292 - i * 15));
  // Stage numbers.
  g.font = font(80);
  g.fillText(RW.stages[0], W * 0.5, yPx(104));
  g.fillText(RW.stages[1], W * 0.5, yPx(405));
  // Stencil bridges: the gaps a real stencil leaves across each letter.
  g.globalCompositeOperation = 'destination-out';
  for (let y = 0; y < H; y += 26) g.fillRect(0, y, W, 2.5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

function enamel(): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.34, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  m.name = 'rocketEnamel';
  m.userData.uniforms = { uDecal: { value: decalTexture() } };
  return shade(m, 'rocket-enamel', {
    head: /* glsl */ `
uniform sampler2D uDecal;
float rktR(float y){
  if (y < 330.0) return 34.0;
  if (y < 480.0) return 30.0;
  float t = clamp((y - 480.0) / 124.0, 0.0, 1.0);
  return 30.0 * sqrt(max(0.0, 1.0 - t * t)) * (1.0 - 0.15 * t);
}
// x: signed distance across the nearest ring seam (mm), y: across the nearest long seam (mm), z: panel id, w: on the skin.
vec4 rktPanel(){
  float y = vObj.y, r = length(vObj.xz);
  float on = 1.0 - smoothstep(0.35, 0.7, abs(r - rktR(y)));
  on *= 1.0 - smoothstep(560.0, 590.0, y);
  float O = y < 330.0 ? 72.0 : (y < 480.0 ? 354.0 : 480.0);
  float P = y < 330.0 ? 64.0 : (y < 480.0 ? 42.0 : 40.0);
  float n = 4.0;
  float sy = mod(y - O + P * 0.5, P) - P * 0.5;
  float a = atan(vObj.z, vObj.x) / 6.2831853 * n + 0.18;
  float sx = (a - floor(a + 0.5)) * 6.2831853 / n * r;
  float id = floor(a) * 17.0 + floor((y - O) / P) * 5.0 + floor(O);
  return vec4(sy, sx, id, on);
}`,
    color: /* glsl */ `
  vec4 pnl = rktPanel();
  float pFw = max(fwidth(vObj.y), 1e-4);
  float dSeam = min(abs(pnl.x), abs(pnl.y));
  float seam = (1.0 - smoothstep(0.22, 0.22 + 1.2 * pFw, dSeam)) * pnl.w * mix(1.0, 0.4, smoothstep(0.2, 0.6, pFw));
  float halo = (1.0 - smoothstep(0.0, 2.2, dSeam)) * pnl.w;
  float arc = atan(vObj.z, vObj.x) * length(vObj.xz);
  vec2 rv = vec2(mod(arc, 4.6) - 2.3, abs(pnl.x) - 2.4);
  float rd = length(rv);
  float rivet = (1.0 - smoothstep(0.55, 0.55 + pFw, rd)) * pnl.w * (1.0 - smoothstep(0.35, 0.7, pFw));
  float rivRim = (smoothstep(0.35, 0.55, rd) - smoothstep(0.55, 0.8 + pFw, rd)) * pnl.w * (1.0 - smoothstep(0.35, 0.7, pFw));
  float tone = 0.965 + 0.07 * fract(sin(pnl.z * 12.9898) * 43758.5453);
  float grime = smoothstep(220.0, 40.0, vObj.y) * (0.5 + 0.5 * wFbm(vObj * 0.06));
  float streak = smoothstep(0.55, 0.85, wNoise(vec3(atan(vObj.z, vObj.x) * 9.0, vObj.y * 0.01, 2.0))) * smoothstep(300.0, 60.0, vObj.y);
  float seamGrime = halo * (0.35 + 0.65 * wFbm(vObj * 0.3));
  diffuseColor.rgb = vec3(0.78, 0.72, 0.62) * mix(1.0, tone, pnl.w) * (0.94 + 0.08 * wFbm(vObj * 0.04)) * (1.0 - 0.32 * grime - 0.18 * streak);
  diffuseColor.rgb *= (1.0 - 0.7 * seam) * (1.0 - 0.16 * seamGrime) * (1.0 - 0.35 * rivRim);
  // The fins: a rivet line along the root, a seam across with rivets either side, rivets inside the leading edge,
  // paint chipped back to primer along that edge.
  float fr = length(vObj.xz);
  vec3 fnN = normalize(vObjN);
  float finOn = (1.0 - smoothstep(0.2, 0.4, abs(dot(normalize(fnN.xz + 1e-5), normalize(vObj.xz + 1e-5))))) * step(36.0, fr) * (1.0 - step(0.6, abs(fnN.y))) * (1.0 - step(152.0, vObj.y));
  vec2 e0 = vec2(33.0, 148.0), ed = normalize(vec2(45.0, -52.0)), en = vec2(-ed.y, ed.x);
  vec2 fp = vec2(fr, vObj.y) - e0;
  float le = abs(dot(fp, en)), along = dot(fp, ed);
  float fRiv = min(min(length(vec2(mod(vObj.y, 4.6) - 2.3, fr - 38.5)), length(vec2(mod(vObj.y, 4.6) - 2.3, abs(fr - 57.0) - 2.2))), length(vec2(mod(along, 4.6) - 2.3, le - 4.2)));
  float fRim = (smoothstep(0.35, 0.55, fRiv) - smoothstep(0.55, 0.8 + pFw, fRiv)) * finOn * (1.0 - smoothstep(0.35, 0.7, pFw));
  float fSeam = (1.0 - smoothstep(0.22, 0.22 + 1.2 * pFw, abs(fr - 57.0))) * finOn * mix(1.0, 0.4, smoothstep(0.2, 0.6, pFw));
  float chip = smoothstep(0.52, 0.7, wFbm(vObj * 0.35)) * (1.0 - smoothstep(1.0, 3.5, le)) * finOn;
  diffuseColor.rgb *= (1.0 - 0.6 * fSeam) * (1.0 - 0.35 * fRim) * (1.0 - 0.12 * finOn * smoothstep(0.4, 0.8, wFbm(vObj * 0.08 + 5.0)));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.2, 0.11), chip * 0.85);
  // Stencils, worn where the paint is.
  {
    float ang = atan(vObj.z, vObj.x);
    vec2 duv = vec2((${DECAL.a0 + DECAL.span} - ang) / ${DECAL.span}, (vObj.y - ${DECAL.y0}.0) / ${DECAL.y1 - DECAL.y0}.0);
    float inside = step(0.0, duv.x) * step(duv.x, 1.0) * step(0.0, duv.y) * step(duv.y, 1.0);
    float ink = texture2D(uDecal, vec2(duv.x, duv.y)).r * inside * pnl.w;
    ink *= 1.0 - 0.6 * smoothstep(0.55, 0.8, wFbm(vObj * 0.5 + 9.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.042, 0.036), ink * 0.92);
  }
  // Soot streaks running down from the interstage vents.
  {
    float va = atan(vObj.z, vObj.x) / 6.2831853 * 16.0;
    float vent = floor(va + 0.5);
    float pick = fract(sin(vent * 91.7) * 4375.85);
    float len = 18.0 + 46.0 * fract(pick * 7.3);
    float wob = (wNoise(vec3(vObj.y * 0.08, vent, 2.0)) - 0.5) * 0.18;
    float near = 1.0 - smoothstep(0.03, 0.16, abs(va + wob - vent));
    float run = smoothstep(328.0 - len, 328.0, vObj.y) * (1.0 - step(330.0, vObj.y));
    float soot = near * run * step(0.45, pick) * (0.35 + 0.65 * wFbm(vec3(va * 5.0, vObj.y * 0.09, 1.0)));
    diffuseColor.rgb *= 1.0 - 0.32 * soot * pnl.w;
  }`,
    rough: 'roughnessFactor += 0.25 * smoothstep(220.0, 40.0, vObj.y) + 0.2 * seamGrime - 0.12 * rivet + 0.25 * chip;',
    normal: /* glsl */ `
  {
    float fade = pnl.w * (1.0 - smoothstep(0.4, 0.9, pFw));
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 tg = normalize(vec3(-vObj.z, 0.0, vObj.x) + 1e-5);
    float gy = 0.7 * pnl.x / 0.36 * exp(-pnl.x * pnl.x / 0.36);
    float gx = 0.7 * pnl.y / 0.36 * exp(-pnl.y * pnl.y / 0.36);
    float dome = rd < 0.55 ? 0.5 * rd / (0.3025 * sqrt(max(0.05, 1.0 - rd * rd / 0.3025))) : 0.0;
    vec2 rdir = rd > 1e-3 ? rv / rd : vec2(0.0);
    vec3 g = -(up * gy + tg * gx);
    g += (tg * rdir.x + up * rdir.y * sign(pnl.x)) * dome;
    normal = normalize(normal + mat3(viewMatrix) * g * 0.35 * fade);
  }`,
  });
}

// The making view's lines for a lathed hull: rings at its seams and meridians down it, from the real profile.
function hullWire(prof: P2[], rings: number[], meridians: number): THREE.BufferGeometry {
  const rAt = (y: number) => {
    for (let i = 1; i < prof.length; i++) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; if (y <= y1 + 1e-6) return r0 + (r1 - r0) * ((y - y0) / Math.max(1e-6, y1 - y0)); }
    return prof[prof.length - 1][0];
  };
  const pts: number[] = [];
  for (const y of rings) {
    const r = rAt(y) + 0.15;
    for (let k = 0; k < 96; k++) { const a0 = (k / 96) * Math.PI * 2, a1 = ((k + 1) / 96) * Math.PI * 2; pts.push(Math.cos(a0) * r, y, Math.sin(a0) * r, Math.cos(a1) * r, y, Math.sin(a1) * r); }
  }
  const y0 = prof[0][1], y1 = prof[prof.length - 1][1];
  for (let m = 0; m < meridians; m++) {
    const a = (m / meridians) * Math.PI * 2 + 0.09 * Math.PI;
    for (let i = 0; i < 40; i++) {
      const ya = y0 + ((y1 - y0) * i) / 40, yb = y0 + ((y1 - y0) * (i + 1)) / 40;
      const ra = rAt(ya) + 0.15, rb = rAt(yb) + 0.15;
      pts.push(Math.cos(a) * ra, ya, Math.sin(a) * ra, Math.cos(a) * rb, yb, Math.sin(a) * rb);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}
const wireHull = (meshes: THREE.Mesh[], hull: THREE.Material, geo: THREE.BufferGeometry) => {
  for (const mm of meshes) { if (mm.material === hull) mm.userData.wireGeo = geo; else mm.userData.wireK = 0.5; }
};

export function buildRocket(): RocketModel {
  const rnd = seeded(5150);
  const root = new THREE.Group();
  root.scale.setScalar(RKT.SCALE);

  const ivory = enamel();
  const brass = metal({ name: 'rktBrass', color: 0xd6a85e, rough: 0.28, brush: 'radial-z', tarnish: 0.3 });
  const bronze = metal({ name: 'rktBronze', color: 0x5a3f28, rough: 0.4, cast: 0.8, tarnish: 0.4 });
  const steel = metal({ name: 'rktSteel', color: 0x2d2a27, rough: 0.5, tarnish: 0.3 });
  const satin = metal({ name: 'rktBrassSatin', color: 0xc99a52, rough: 0.46, brush: 'y', tarnish: 0.45 });
  const bell = metal({ name: 'rktBell', color: 0x6b4a30, rough: 0.35, brush: 'z', tarnish: 0.5 });
  bell.side = THREE.DoubleSide;
  const stone = dielectric('rktStone', 0x3a322b, 0.62, { vary: 0.22, scale: 0.03 });
  const lattice = metal({ name: 'rktLattice', color: 0x6a5238, rough: 0.42, tarnish: 0.35, cast: 0.3 });
  const deckStone = dielectric('rktDeck', 0x3a322b, 0.66, { vary: 0.18, scale: 0.03, extra: {
    color: /* glsl */ `
  { vec2 g = vObj.xz / 46.0; vec2 fw = fwidth(g) + 1e-5;
    vec2 d = 0.5 - abs(fract(g + vec2(0.5, 0.0)) - 0.5);
    float seam = max(1.0 - smoothstep(0.0, 1.5 * fw.x, d.x - 0.012), 1.0 - smoothstep(0.0, 1.5 * fw.y, d.y - 0.012));
    float top = step(-0.5, vObj.y);
    float r = length(vObj.xz);
    float scorch = (1.0 - smoothstep(42.0, 96.0, r + (wFbm(vObj * 0.08) - 0.5) * 30.0)) * top;
    float tone = 0.9 + 0.2 * wHash(vec3(floor(g + vec2(0.5, 0.0)), 4.0));
    diffuseColor.rgb *= mix(1.0, tone * (1.0 - 0.5 * seam), top);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.035, 0.025), scorch * 0.75); }`,
  } });
  const coping = dielectric('rktCoping', 0x3a322b, 0.66, { vary: 0.2, scale: 0.03, extra: {
    color: /* glsl */ `
  { float ang = atan(vObj.z, vObj.x) / 6.2831853 * 48.0; float fw = fwidth(ang) + 1e-4;
    float joint = 1.0 - smoothstep(0.0, 1.5 * fw, 0.5 - abs(fract(ang) - 0.5) - 0.02);
    diffuseColor.rgb *= 1.0 - 0.55 * joint;
    diffuseColor.rgb *= 0.9 + 0.2 * wHash(vec3(floor(ang), 3.0, 1.0)); }`,
  } });
  const apron = dielectric('rktApron', 0x221c17, 0.8, { vary: 0.1, scale: 0.004, extra: {
    color: /* glsl */ `
  { vec2 g = vObj.xz / 520.0; vec2 fw = fwidth(g) + 1e-5;
    vec2 d = abs(fract(g) - 0.5);
    float jx = 1.0 - smoothstep(0.0, 1.5 * fw.x, 0.5 - d.x - 0.003);
    float jz = 1.0 - smoothstep(0.0, 1.5 * fw.y, 0.5 - d.y - 0.003);
    float slabTone = 0.86 + 0.28 * wHash(vec3(floor(g), 7.0));
    float stain = smoothstep(0.55, 0.85, wFbm(vObj * 0.004 + 2.0)) * 0.35;
    float scorch = exp(-length(vObj.xz) / 900.0) * 0.5 * smoothstep(0.3, 0.7, wFbm(vObj * 0.01));
    diffuseColor.rgb *= slabTone * (1.0 - 0.6 * max(jx, jz)) * (1.0 - stain) * (1.0 - scorch); }`,
  } });
  const ink = dielectric('rktInk', 0x0d0a08, 0.8, { vary: 0.05 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2a1c10, emissive: new THREE.Color(1, 0.7, 0.4), emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.2 });
  glass.name = 'rktPorthole';
  const portGlass = glassLayer('rktPortGlass', 0.05);
  const beacons = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.5, 0.15).multiplyScalar(2) });
  beacons.name = 'rktBeacon';
  const floodLens = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.86, 0.66).multiplyScalar(2.2) });
  floodLens.name = 'rktFloodLens';

  // ---- the pool, its basin and the ground around it ---------------------------------------------------------
  {
    const b = new Builder();
    const R = RKT.POOL_R;
    const fl = new THREE.PlaneGeometry(8000, 8000); fl.rotateX(-Math.PI / 2);
    b.add(fl, apron, at(0, RKT.POOL - 14, 0));
    b.add(lathe(([[R, RKT.POOL - 14], [R, RKT.POOL + 6], [R + 6, RKT.POOL + 10], [R + 50, RKT.POOL + 10], [R + 56, RKT.POOL + 4], [R + 60, RKT.POOL - 14]] as P2[]).reverse(), 192), coping);
    b.add(cyl(R, 2, 160), ink, at(0, RKT.POOL - 6, 0));
    // Brass drain grates set into the coping, and a ring of bolts holding the coping's inner lip.
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.3;
      b.add(rbox(26, 1.4, 12, 0.5), brass, xf({ p: [Math.cos(a) * (R + 28), RKT.POOL + 10.4, Math.sin(a) * (R + 28)], r: [0, -a, 0] }));
      for (let j = 0; j < 5; j++) b.add(rbox(1.2, 0.8, 9, 0.2), ink, xf({ p: [Math.cos(a) * (R + 28) - Math.sin(a) * (j - 2) * 4.4, RKT.POOL + 11.1, Math.sin(a) * (R + 28) + Math.cos(a) * (j - 2) * 4.4], r: [0, -a, 0] }));
    }
    for (const a of [2.5, 4.1]) {
      const len = 420, x0 = Math.cos(a) * (R + 60 + len / 2), z0 = Math.sin(a) * (R + 60 + len / 2);
      b.add(rbox(len, 1.2, 22, 0.4), ink, xf({ p: [x0, RKT.POOL - 13.6, z0], r: [0, -a, 0] }));
      for (let j = 0; j < 28; j++) {
        const t = R + 64 + j * 15;
        b.add(rbox(2.2, 1, 20, 0.3), steel, xf({ p: [Math.cos(a) * t, RKT.POOL - 13, Math.sin(a) * t], r: [0, -a, 0] }));
      }
    }
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + 0.2;
      b.add(new THREE.TorusGeometry(5, 1.2, 8, 20).rotateX(Math.PI / 2), steel, at(Math.cos(a) * (R + 130), RKT.POOL - 13, Math.sin(a) * (R + 130)));
      b.add(cyl(3, 1.6, 16), steel, at(Math.cos(a) * (R + 130), RKT.POOL - 13.2, Math.sin(a) * (R + 130)));
    }
    const cs = screw(1.8);
    for (let k = 0; k < 48; k++) { const a = ((k + 0.5) / 48) * Math.PI * 2; b.add(cs.head, steel, xf({ p: [Math.cos(a) * (R + 10), RKT.POOL + 10, Math.sin(a) * (R + 10)], r: [-Math.PI / 2, 0, a] })); }
    // The deflector under the flame hole, a cone in the pool.
    b.add(lathe(([[0, RKT.POOL + 40], [30, RKT.POOL + 16], [56, RKT.POOL]] as P2[]).reverse(), 64), bronze);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const vane = new THREE.Shape([new THREE.Vector2(4, 36), new THREE.Vector2(56, 0), new THREE.Vector2(62, 0), new THREE.Vector2(62, 4), new THREE.Vector2(8, 40)]);
      const vg = new THREE.ExtrudeGeometry(vane, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4, bevelSegments: 1 });
      vg.translate(0, 0, -0.8);
      b.add(vg, lattice, xf({ p: [0, RKT.POOL, 0], r: [0, -a, 0] }));
    }
    b.add(new THREE.TorusGeometry(57, 2, 10, 96).rotateX(Math.PI / 2), brass, at(0, RKT.POOL + 1.5, 0));
    for (const mm of b.build(root, 'basin')) { if (mm.material === apron || mm.material === coping || mm.material === steel || mm.material === ink) mm.userData.noWire = true; else mm.userData.wireK = 0.45; }
  }
  const pool = poolMaterial();
  {
    // The shader reads the pool's own plane coordinates (position.xy); the mesh lies it flat.
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(RKT.POOL_R + 4, 192), pool);
    mesh.receiveShadow = true;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = RKT.POOL;
    mesh.renderOrder = 2;
    mesh.name = 'pool';
    mesh.userData.noAO = true;
    root.add(mesh);
  }

  // ---- the flume: a stone trough on piers across the apron, a brass spout over the coping, the water along it -----
  const R0 = RKT.POOL_R;
  const fu = new THREE.Vector3(Math.cos(FLUME.A), 0, Math.sin(FLUME.A));
  const fv = new THREE.Vector3(-Math.sin(FLUME.A), 0, Math.cos(FLUME.A));
  const rLip = R0 - 8, rFar = R0 + 60 + FLUME.LEN;
  const floorY = RKT.POOL + 12, waterY = RKT.POOL + 21;
  {
    const b = new Builder();
    const len = rFar - rLip, mid = (rFar + rLip) / 2;
    const along = (r: number, y: number, side = 0) => [fu.x * r + fv.x * side, y, fu.z * r + fv.z * side] as [number, number, number];
    b.add(rbox(len, 4, FLUME.W + 4, 1), coping, xf({ p: along(mid, floorY - 2), r: [0, -FLUME.A, 0] }));
    for (const sd of [-1, 1]) b.add(rbox(len, 14, 5, 1.4), coping, xf({ p: along(mid, floorY + 5, sd * (FLUME.W / 2 + 4.5)), r: [0, -FLUME.A, 0] }));
    // Joints across the trough every block, brass ties over the top every third.
    for (let r = R0 + 60; r < rFar; r += 60) for (const sd of [-1, 1]) b.add(rbox(1.4, 14.6, 1, 0.2), ink, xf({ p: along(r, floorY + 5, sd * (FLUME.W / 2 + 7.1)), r: [0, -FLUME.A, 0] }));
    // Piers down to the apron.
    for (let r = R0 + 110; r < rFar; r += 140) b.add(rbox(16, floorY - 4 - (RKT.POOL - 14), 26, 1.5), coping, xf({ p: along(r, (floorY - 4 + RKT.POOL - 14) / 2), r: [0, -FLUME.A, 0] }));
    // The spout: a brass lip with cheeks reaching out over the water.
    b.add(rbox(16, 2, FLUME.W + 6, 0.6), brass, xf({ p: along(rLip + 4, floorY - 0.2), r: [0, -FLUME.A, 0] }));
    for (const sd of [-1, 1]) b.add(rbox(16, 10, 2, 0.5), brass, xf({ p: along(rLip + 4, floorY + 4, sd * (FLUME.W / 2 + 2)), r: [0, -FLUME.A, 0] }));
    for (const mm of b.build(root, 'flume')) mm.userData.wireK = 0.5;
  }
  const flumeRun = waterMaterial(0.95);
  const flumeFall = waterMaterial(0.7, true);
  let fs0 = 0, ff0 = 0;
  {
    const rows: WaterRow[] = [];
    for (let r = rFar; r >= rLip; r -= 8) {
      const d = rFar - r;
      rows.push({ c: new THREE.Vector3(fu.x * r, waterY, fu.z * r), side: fv.clone(), w: FLUME.W - 2, s: d, f: d / FLUME.VRUN, seed: 3 + d * 0.001 });
    }
    fs0 = rFar - rLip; ff0 = fs0 / FLUME.VRUN;
    const m = new THREE.Mesh(waterStrip(rows, 8), flumeRun);
    m.frustumCulled = false; m.userData.noWire = true; m.userData.noAO = true;
    root.add(m);
  }
  const lip = new THREE.Vector3(fu.x * rLip, waterY, fu.z * rLip);
  const vx = FLUME.VRUN * 0.7, tOut = Math.sqrt((2 * (waterY - RKT.POOL)) / FLUME.G);
  const landR = rLip - vx * tOut;
  {
    const rows: WaterRow[] = [];
    for (let j = 0; j <= 24; j++) {
      const t = (j / 24) * tOut, d = 0.5 * FLUME.G * t * t;
      rows.push({ c: new THREE.Vector3(fu.x * (rLip - vx * t), waterY - d, fu.z * (rLip - vx * t)), side: fv.clone(), w: (FLUME.W - 4) * Math.max(0.7, Math.sqrt(FLUME.VRUN / (FLUME.VRUN + FLUME.G * t))), s: fs0 + vx * t + d, f: ff0 + t, d, seed: 6 });
    }
    const m = new THREE.Mesh(fallStrip(rows), flumeFall);
    m.frustumCulled = false; m.userData.noWire = true; m.userData.noAO = true;
    root.add(m);
  }
  const sLand = fs0 + vx * tOut + (waterY - RKT.POOL);
  const land = new THREE.Vector3(fu.x * landR, RKT.POOL + 0.5, fu.z * landR);
  const crown = crownMesh(20, 7, 11, 9, sLand);
  (crown.material as THREE.ShaderMaterial).userData.gain = 0.42;
  crown.position.copy(land);
  crown.userData.noWire = true;
  root.add(crown);
  const drops = dropsMaterial(FLUME.G * 0.35);
  const dp = dropsAt([land.clone().add(new THREE.Vector3(0, 1, 0))], 90, 16, [1.2, 2.6], rnd);
  dp.material = drops;
  dp.userData.noWire = true;
  root.add(dp);
  const ride = riders(new THREE.Vector3(fu.x * (rFar - 20), waterY + 0.3, fu.z * (rFar - 20)), new THREE.Vector3(fu.x * (rLip + 10), waterY + 0.3, fu.z * (rLip + 10)), fv.clone(), FLUME.W - 6, 20, FLUME.VRUN, 60, rnd);
  ride.userData.noWire = true;
  root.add(ride);
  const inletLight = new THREE.PointLight(0xff9a40, 0, 0.16, 2);
  inletLight.position.set(fu.x * (rLip + 30) * RKT.SCALE, (waterY + 8) * RKT.SCALE, fu.z * (rLip + 30) * RKT.SCALE);
  pool.userData.uniforms.uInlet.value.set(land.x, -land.z, 0);

  // ---- the pad: an octagonal stone deck on eight pillars, brass trim, grating, the flame hole, the clamps --------
  const pad = new Builder();
  {
    const oct: V[] = Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; return [Math.cos(a) * 160, Math.sin(a) * 160, 6] as V; });
    const deck = slab(rounded(oct), [circle(0, 0, 40, 96)], -26, 0, 2, 3); deck.rotateX(-Math.PI / 2);
    pad.add(deck, deckStone);
    const trim = slab(rounded(oct.map(([x, y]) => [x * 1.012, y * 1.012, 7] as V)), [rounded(oct.map(([x, y]) => [x * 0.97, y * 0.97, 5] as V))], -3, 1.2, 0.6, 2); trim.rotateX(-Math.PI / 2);
    pad.add(trim, brass);
    pad.add(new THREE.TorusGeometry(41, 1.6, 12, 96).rotateX(Math.PI / 2), brass, at(0, 0.4, 0));
    // Grating: two fields of slots either side of the flame hole.
    for (const sz of [-1, 1]) for (let k = 0; k < 9; k++) pad.add(rbox(84, 0.8, 2.2, 0.3), ink, at(0, 0.2, sz * (62 + k * 7.4)));
    // Bolt ring.
    const sc = screw(2.2);
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; pad.add(sc.head, steel, xf({ p: [Math.cos(a) * 140, 0, Math.sin(a) * 140], r: [-Math.PI / 2, 0, a] })); }
    // Pillars down into the pool, each with a brass collar at the water line.
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * 118, z = Math.sin(a) * 118;
      pad.add(cyl(13, -26 - RKT.POOL + 14, 48), stone, at(x, (-26 + RKT.POOL - 14) / 2, z));
      pad.add(cyl(15, 5, 48), brass, at(x, RKT.POOL + 6, z));
      pad.add(cyl(15.5, 4, 48), brass, at(x, -29, z));
      pad.add(cyl(18, 3, 48), lattice, at(x, RKT.POOL + 9.5, z));
      for (let j = 0; j < 6; j++) { const b2 = (j / 6) * Math.PI * 2; pad.add(sc.head, steel, xf({ p: [x + Math.cos(b2) * 15.5, RKT.POOL + 11, z + Math.sin(b2) * 15.5], r: [-Math.PI / 2, 0, b2] })); }
      // A tie beam to the next pillar, half way down.
      const a2 = ((k + 1) / 8) * Math.PI * 2 + Math.PI / 8;
      const x2 = Math.cos(a2) * 118, z2 = Math.sin(a2) * 118;
      const len = Math.hypot(x2 - x, z2 - z) - 26;
      pad.add(rbox(len, 6, 5, 1), lattice, xf({ p: [(x + x2) / 2, -62, (z + z2) / 2], r: [0, -Math.atan2(z2 - z, x2 - x), 0] }));
    }
  }
  for (const [x, z] of TOWER_FEET) {
    const h = -RKT.POOL + 14;
    pad.add(rbox(16, h, 16, 1.5), stone, at(x, (RKT.POOL - 14) / 2, z));
    pad.add(rbox(20, 4, 20, 1), satin, at(x, -2, z));
    pad.add(rbox(19, 3, 19, 1), satin, at(x, RKT.POOL + 6, z));
    for (const [u, v] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) pad.add(new THREE.SphereGeometry(1.1, 8, 6), steel, at(x + u, 0.2, z + v));
  }
  for (const mm of pad.build(root, 'pad')) mm.userData.part = 'pad';

  // Clamps: four arms on the deck that hold the rocket's skirt and swing away at ignition.
  const clamps: Clamp[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const base = new Builder();
    const bx = Math.cos(a), bz = Math.sin(a), tx = -bz, tz = bx;
    base.add(rbox(26, 3, 30, 1), steel, xf({ p: [bx * 64, 1.5, bz * 64], r: [0, -a, 0] }));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) base.add(new THREE.SphereGeometry(1.4, 8, 6), brass, at(bx * (64 + sx * 10) + tx * sy * 12, 3, bz * (64 + sx * 10) + tz * sy * 12));
    for (const sy of [-1, 1]) base.add(rbox(14, 14, 3, 1), steel, xf({ p: [bx * 60 + tx * sy * 7.5, 9, bz * 60 + tz * sy * 7.5], r: [0, -a, 0] }));
    base.add(cyl(2.2, 20, 16).rotateX(Math.PI / 2).rotateY(-a), brass, at(bx * 58, 12, bz * 58));
    base.build(root, 'clampBase');
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * 58, 12, Math.sin(a) * 58);
    g.rotation.y = -a;
    const arm = new Builder();
    const reach = Math.hypot(27, 26);
    arm.add(rbox(reach + 6, 7, 9, 2), lattice, at(-13.5, 13, 0, [0, 0, Math.PI - Math.atan2(26, 27)]));
    arm.add(rbox(10, 12, 13, 2), steel, at(-27, 26, 0));
    arm.add(rbox(2.4, 9, 10, 0.6), satin, at(-33, 26, 0));
    for (const zz of [-4, 4]) arm.add(new THREE.SphereGeometry(1.2, 8, 6), brass, at(-27, 32.2, zz));
    arm.add(cyl(3.5, 14, 24), steel, xf({ p: [0, 0, 0], r: [Math.PI / 2, 0, 0] }));
    arm.build(g, 'clamp');
    root.add(g);
    clamps.push({ group: g, angle: a });
  }

  // ---- the gantry: a lattice tower built in sections, platforms, swing arms, a crane, beacons, floodlights --------
  const gantry: THREE.Group[] = [];
  const GX = RKT.GANTRY_X, HALF = 28, BAY = 40, SECTIONS = 16;
  const tied: Tied[] = [];
  const boltHead = new THREE.SphereGeometry(0.9, 6, 4);
  // A part fixed to the tower arrives once the tower is built past it (its top, rounded up to a whole section).
  const tieAt = (obj: THREE.Object3D, top: number, base = 0) => tied.push({ obj, y: Math.ceil(top / BAY - 1e-6) * BAY, base });
  for (let s = 0; s < SECTIONS; s++) {
    const g = new THREE.Group();
    g.position.set(GX, s * BAY, 0);
    const b = new Builder();
    for (const [x, z] of [[-HALF, -HALF], [HALF, -HALF], [HALF, HALF], [-HALF, HALF]]) b.add(rbox(5, BAY + 0.5, 5, 0.8), lattice, at(x, BAY / 2, z));
    for (const z of [-HALF, HALF]) b.add(rbox(HALF * 2, 3, 3, 0.6), lattice, at(0, BAY, z));
    for (const x of [-HALF, HALF]) b.add(rbox(3, 3, HALF * 2, 0.6), lattice, at(x, BAY, 0));
    // Diagonal braces in an X on every face.
    const diag = Math.hypot(HALF * 2, BAY) - 4;
    const ang = Math.atan2(BAY, HALF * 2);
    for (const z of [-HALF, HALF]) for (const sg of [-1, 1]) b.add(rbox(diag, 2.4, 2.4, 0.5), lattice, xf({ p: [0, BAY / 2, z], r: [0, 0, sg * ang] }));
    for (const x of [-HALF, HALF]) for (const sg of [-1, 1]) b.add(rbox(2.4, 2.4, diag, 0.5), lattice, xf({ p: [x, BAY / 2, 0], r: [sg * ang, 0, 0] }));
    // Bolted gusset plates at the joints.
    for (const [x, z] of [[-HALF, -HALF], [HALF, -HALF], [HALF, HALF], [-HALF, HALF]]) {
      const sx = Math.sign(x), sz = Math.sign(z);
      b.add(rbox(1.2, 13, 13, 0.4), bronze, at(x + sx * 3.1, BAY, z - sz * 3));
      b.add(rbox(13, 13, 1.2, 0.4), bronze, at(x - sx * 3, BAY, z + sz * 3.1));
      for (const [u, v] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]]) {
        b.add(boltHead, steel, at(x + sx * 3.9, BAY + u, z - sz * 3 + v));
        b.add(boltHead, steel, at(x - sx * 3 + v, BAY + u, z + sz * 3.9));
      }
    }
    for (const mm of b.build(g, `gantry${s}`)) mm.userData.wireK = 0.4;
    root.add(g);
    gantry.push(g);
  }
  // Platforms with rails at three levels, a crane on top.
  const LEVELS = [180, 352, 480];
  {
    const tie = (b: Builder, name: string, top: number) => { const g = new THREE.Group(); for (const mm of b.build(g, name)) mm.userData.wireK = 0.4; root.add(g); tieAt(g, top); };
    for (const y of LEVELS) {
      const b = new Builder();
      b.add(rbox(96, 3, 96, 1), steel, at(GX, y + 1.5, 0));
      for (let k = 0; k <= 6; k++) { b.add(rbox(2, 22, 2, 0.5), lattice, at(GX - 48 + k * 16, y + 12, 48)); b.add(rbox(2, 22, 2, 0.5), lattice, at(GX - 48 + k * 16, y + 12, -48)); }
      b.add(rbox(96, 2, 2, 0.5), satin, at(GX, y + 22, 48));
      b.add(rbox(96, 2, 2, 0.5), satin, at(GX, y + 22, -48));
      tie(b, 'platform', y + 22);
    }
    const b = new Builder();
    // The tower's own crane, parked: a mast, a jib along the back of the tower, a counterweight, a cable and hook.
    b.add(rbox(14, 40, 14, 2), steel, at(GX, RKT.TOP + 20, 0));
    b.add(rbox(10, 10, 230, 2), steel, at(GX, RKT.TOP + 40, -60));
    b.add(rbox(16, 16, 40, 2), bronze, at(GX, RKT.TOP + 40, 52));
    b.add(cyl(0.8, 70, 8), steel, at(GX, RKT.TOP, -165));
    b.add(new THREE.TorusGeometry(5, 1.5, 8, 24, Math.PI * 1.4), brass, at(GX, RKT.TOP - 38, -165, [0, Math.PI / 2, -0.6]));
    tie(b, 'crane', RKT.TOP);
    const lamps = new Builder();
    for (const [x, y, z] of [[GX + HALF, RKT.TOP + 8, HALF], [GX - HALF, RKT.TOP + 8, HALF], [GX, RKT.TOP + 46, -176]]) lamps.add(new THREE.SphereGeometry(3.4, 16, 8), beacons, at(x, y, z));
    tie(lamps, 'beacons', RKT.TOP);
  }
  // Swing arms: a truss from the tower to the rocket at each level, with an umbilical line.
  const arms: Swing[] = [];
  for (const y of [190, 340, 470]) {
    const g = new THREE.Group();
    g.position.set(GX - HALF, y, 0);
    const b = new Builder();
    const len = GX - HALF - 38;
    b.add(rbox(len, 3, 14, 1), lattice, at(-len / 2, 0, 0));
    b.add(rbox(len, 3, 14, 1), lattice, at(-len / 2, 12, 0));
    for (let k = 0; k <= 5; k++) b.add(rbox(2, 12, 2, 0.5), lattice, at(-k * (len / 5), 6, 7));
    b.add(cyl(2.4, len, 16), ink, xf({ p: [-len / 2, -4, -4], r: [0, 0, Math.PI / 2] }));
    b.add(rbox(10, 16, 18, 2), brass, at(-len - 2, 6, 0));
    for (const mm of b.build(g, 'arm')) mm.userData.wireK = 0.4;
    root.add(g);
    tieAt(g, y + 16, y);
    arms.push({ group: g, rest: 0, out: -80 * D2R });
  }
  // Floodlights on the platforms, aimed at the rocket: real lights with lit lenses.
  const floods: THREE.SpotLight[] = [];
  {
    for (const [y, z] of [[184, 44], [356, -44]]) {
      const b = new Builder();
      b.add(cyl(9, 12, 32), steel, xf({ p: [GX - 40, y + 14, z], r: [0, 0, Math.PI / 2 + 0.25] }));
      const lens = new THREE.CircleGeometry(7.4, 32); lens.rotateY(-Math.PI / 2);
      b.add(lens, floodLens, xf({ p: [GX - 46.2, y + 15.6, z], r: [0, 0, 0.25] }));
      const s = new THREE.SpotLight(0xffd8b0, 0, 0, 0.6, 0.9, 2);
      s.position.set((GX - 50) * RKT.SCALE, (y + 16) * RKT.SCALE, z * RKT.SCALE);
      s.target.position.set(0, (y + 60) * RKT.SCALE, 0);
      floods.push(s);
      const g = new THREE.Group();
      b.build(g, 'floods');
      root.add(g);
      tieAt(g, y + 24);
    }
  }

  // ---- the rocket, in three stages that are stacked during assembly -----------------------------------------
  const rocket = new THREE.Group();
  root.add(rocket);
  const stages: THREE.Group[] = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  for (const s of stages) rocket.add(s);
  {
    // Stage one: boattail, engine bells, the long body, fins, bands, hatches, rivets.
    const b = new Builder();
    b.add(lathe([[22, 32], [30, 44], [34, 60]] as P2[], 96), bronze);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + 0.13;
      b.add(rbox(2.2, 30.5, 1.6, 0.5), satin, xf({ p: [Math.cos(a) * 29.4, 46, Math.sin(a) * 29.4], r: [0, -a, -Math.atan2(12, 28)] }));
    }
    for (let k = 0; k < 36; k++) { const a = (k / 36) * Math.PI * 2; b.add(new THREE.SphereGeometry(0.75, 8, 6), steel, at(Math.cos(a) * 34.1, 57.5, Math.sin(a) * 34.1)); }
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const x = Math.cos(a) * 14, z = Math.sin(a) * 14;
      b.add(lathe([[13.5, 4], [11, 14], [7, 26], [5.2, 34], [6.5, 40]] as P2[], 64), bell, at(x, 0, z));
      for (let q = 0; q < 6; q++) b.add(new THREE.TorusGeometry(13.2 - q * 1.3, 0.4, 6, 48).rotateX(Math.PI / 2), bell, at(x, 6 + q * 4.2, z));
    }
    b.add(lathe([[34, 60], [34, 330]] as P2[], 128), ivory);
    b.add(cyl(33.8, 1, 96), ink, at(0, 329.4, 0));
    for (const y of [72, 200, 328]) b.add(new THREE.TorusGeometry(34.6, 1.6, 10, 128).rotateX(Math.PI / 2), brass, at(0, y, 0));
    for (const y of [76, 196, 324]) for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; b.add(new THREE.SphereGeometry(0.75, 8, 6), brass, at(Math.cos(a) * 34.2, y, Math.sin(a) * 34.2)); }
    // Hatches: framed panels with screws on the visible side.
    for (const [y, a] of [[120, 0.4], [260, -0.3], [150, 2.2]] as const) {
      const th = Math.PI / 2 - a;
      b.add(new THREE.CylinderGeometry(34.3, 34.3, 28.2, 16, 1, true, th - 9.2 / 34.3, 18.4 / 34.3), ink, at(0, y, 0));
      for (const dy of [-8, 8]) { const ah = a - 9.6 / 34.9; b.add(cyl(1.1, 6, 12), satin, at(Math.cos(ah) * 35.1, y + dy, Math.sin(ah) * 35.1)); }
      b.add(new THREE.CylinderGeometry(34.75, 34.75, 27, 16, 1, false, th - 8.5 / 34.75, 17 / 34.75), ivory, at(0, y, 0));
      b.add(rbox(1.6, 9, 2.2, 0.6), brass, xf({ p: [Math.cos(a) * 35.9, y, Math.sin(a) * 35.9], r: [0, -a, 0] }));
      const hs = screw(1.0);
      for (const [dy, da] of [[-11, -6.5], [-11, 6.5], [11, -6.5], [11, 6.5]]) { const aa = a + da / 34.75; b.add(hs.head, steel, xf({ p: [Math.cos(aa) * 34.95, y + dy, Math.sin(aa) * 34.95], r: [0, -aa + Math.PI / 2, 0] })); }
    }
    // Fins: swept, ivory, a brass leading edge.
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const fin = new THREE.Shape([new THREE.Vector2(0, 60), new THREE.Vector2(0, 148), new THREE.Vector2(44, 96), new THREE.Vector2(46, 52)]);
      const fg = new THREE.ExtrudeGeometry(fin, { depth: 2.4, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 2 });
      fg.translate(32, 0, -1.2);
      b.add(fg, ivory, xf({ r: [0, -a, 0] }));
      const edge = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(33, 148, 0), new THREE.Vector3(78, 96, 0)), 8, 1.6, 8);
      b.add(edge, brass, xf({ r: [0, -a, 0] }));
    }
    wireHull(b.build(stages[0], 'stage1'), ivory, hullWire([[34, 60], [34, 330]], [60, 72, 136, 200, 264, 328], 16));
  }
  {
    // Stage two: the interstage with vents, a slimmer body, a band.
    const b = new Builder();
    b.add(lathe([[34.4, 330], [30.4, 354]] as P2[], 128), satin);
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; b.add(rbox(1.2, 10, 4, 0.4), ink, xf({ p: [Math.cos(a) * 32.6, 342, Math.sin(a) * 32.6], r: [0, -a, -0.17] })); }
    b.add(lathe([[30, 354], [30, 480]] as P2[], 128), ivory);
    b.add(cyl(29.8, 1, 96), ink, at(0, 479.4, 0));
    b.add(cyl(34, 1, 96), ink, at(0, 330.6, 0));
    b.add(new THREE.TorusGeometry(30.6, 1.4, 10, 128).rotateX(Math.PI / 2), brass, at(0, 420, 0));
    for (let k = 0; k < 36; k++) { const a = (k / 36) * Math.PI * 2; b.add(new THREE.SphereGeometry(0.7, 8, 6), brass, at(Math.cos(a) * 30.2, 424, Math.sin(a) * 30.2)); }
    wireHull(b.build(stages[1], 'stage2'), ivory, hullWire([[30, 354], [30, 480]], [354, 396, 420, 438, 480], 16));
  }
  // The sling the stages are lowered on, from a crane above the frame: a long cable, a hook and a lifting eye.
  const sling = new THREE.Group();
  sling.name = 'sling';
  const wire = metal({ name: 'rktWire', color: 0x9a8a74, rough: 0.32, brush: 'y', tarnish: 0.2 });
  const cable = new THREE.Mesh(cyl(1.3, 1, 10).translate(0, 0.5, 0), wire);
  cable.castShadow = true;
  cable.position.y = 14;
  sling.add(cable);
  const hb = new Builder();
  hb.add(new THREE.TorusGeometry(5, 1.5, 8, 24, Math.PI * 1.4), brass, at(0, 9, 0, [0, 0, -0.6 - Math.PI / 2]));
  hb.add(rbox(6, 8, 6, 1.2), bronze, at(0, 16, 0));
  hb.add(new THREE.TorusGeometry(3.2, 1, 8, 20), steel, at(0, 3, 0));
  hb.build(sling, 'hook');
  sling.visible = false;
  root.add(sling);
  const portholes = glass;
  {
    // The nose: an ogive with three portholes, a brass collar and a tip.
    const b = new Builder();
    const prof: P2[] = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; prof.push([30 * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.15 * t), 480 + t * 124]); }
    b.add(lathe(prof, 128), ivory);
    b.add(new THREE.TorusGeometry(30.5, 1.5, 10, 128).rotateX(Math.PI / 2), brass, at(0, 481, 0));
    b.add(lathe([[3.4, 600], [1.8, 616], [0.6, 640]] as P2[], 32), brass);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.3, y = 512;
      const r = 30 * Math.sqrt(1 - ((y - 480) / 124) ** 2) * (1 - 0.15 * ((y - 480) / 124));
      const bez = new THREE.TorusGeometry(5.2, 1.1, 10, 32);
      b.add(bez, brass, xf({ p: [Math.cos(a) * (r + 3.4), y, Math.sin(a) * (r + 3.4)], r: [0, -a + Math.PI / 2, 0.28] }));
      const pose = { p: [Math.cos(a) * (r + 0.2), y, Math.sin(a) * (r + 0.2)] as [number, number, number], r: [0, -a + Math.PI / 2, 0.28] as [number, number, number] };
      b.add(new THREE.CylinderGeometry(4.4, 4.4, 3.2, 32, 1, true).rotateX(Math.PI / 2).translate(0, 0, 1.6), ink, xf(pose));
      b.add(new THREE.CylinderGeometry(5.6, 6.2, 3.2, 32, 1, true).rotateX(Math.PI / 2).translate(0, 0, 1.6), brass, xf(pose));
      b.add(new THREE.CircleGeometry(4.4, 32).translate(0, 0, 1.2), glass, xf(pose));
      b.add(new THREE.CircleGeometry(4.3, 32).translate(0, 0, 3.0), portGlass, xf(pose));
    }
    wireHull(b.build(stages[2], 'nose'), ivory, hullWire(prof, [480, 520, 560, 584, 598], 16));
  }

  // ---- launch: the plume, the flash on the pad, the smoke, the lights ---------------------------------------
  const plumeMat = plumeMaterial();
  const pg = new THREE.CylinderGeometry(16, 46, 1, 48, 1, true);
  pg.translate(0, -0.5, 0);
  const plume = new THREE.Mesh(pg, plumeMat);
  plume.name = 'plume';
  plume.userData.noAO = true;
  plume.renderOrder = 4;
  plume.position.y = 8;
  rocket.add(plume);
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgb(255,255,255)'); gr.addColorStop(0.25, 'rgb(150,150,150)'); gr.addColorStop(0.6, 'rgb(40,40,40)'); gr.addColorStop(1, 'rgb(0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const flash = new THREE.Mesh(new THREE.CircleGeometry(120, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  flash.position.y = 1.5;
  flash.name = 'flash';
  root.add(flash);
  const smokeMat = smokeMaterial();
  const N = 900;
  const seeds = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { seeds[i * 4] = rnd() * Math.PI * 2; seeds[i * 4 + 1] = rnd(); seeds[i * 4 + 2] = rnd(); seeds[i * 4 + 3] = rnd(); }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
  sg.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 4));
  const smoke = new THREE.Points(sg, smokeMat);
  smoke.frustumCulled = false;
  smoke.renderOrder = 5;
  smoke.name = 'smoke';
  root.add(smoke);
  const engineLight = new THREE.PointLight(0xff9a48, 0, 0, 2);
  engineLight.position.set(0, 30, 0);
  rocket.add(engineLight);
  const beaconLight = new THREE.PointLight(0xff8a30, 0, 0.12, 2);
  beaconLight.position.set(RKT.GANTRY_X * RKT.SCALE, (RKT.TOP + 14) * RKT.SCALE, 0.02);
  const poolLight = new THREE.RectAreaLight(0xff9a38, 0.5, RKT.POOL_R * 1.7 * RKT.SCALE, RKT.POOL_R * 1.7 * RKT.SCALE);
  poolLight.position.set(0, (RKT.POOL + 1) * RKT.SCALE, 0);
  poolLight.lookAt(0, 1, 0);

  const centre = new THREE.Vector3(0, 260, 0);
  return { water: [flumeRun, flumeFall, crown.material as THREE.ShaderMaterial], drops, ride: ride.material as THREE.ShaderMaterial, flume: { far: new THREE.Vector3(fu.x * rFar, waterY, fu.z * rFar), lip, sLand, sEnd: sLand + 40 }, inletLight, root, rocket, stages, gantry, tied, beaconLight, sling, cable, arms, clamps, plume, plumeMat, flash, smoke, smokeMat, pool, beacons, portholes, floods, floodLens, engineLight, poolLight, centre };
}
