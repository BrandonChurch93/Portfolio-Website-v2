import * as THREE from 'three';

// Surfaces worked out in the shader from a model's own coordinates (millimetres), so nothing repeats or stretches.
// Shared by every piece; a piece adds its own chunks through shade().

export const NOISE = /* glsl */ `
float wHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float wNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wHash(i), wHash(i + vec3(1,0,0)), f.x), mix(wHash(i + vec3(0,1,0)), wHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(wHash(i + vec3(0,0,1)), wHash(i + vec3(1,0,1)), f.x), mix(wHash(i + vec3(0,1,1)), wHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float wFbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * wNoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
`;

export interface Chunks {
  head?: string;
  vhead?: string;
  vert?: string;
  color?: string;
  rough?: string;
  metal?: string;
  normal?: string;
  emissive?: string;
}

// Injects chunks into a standard material. vObj and vObjN are the model-space position and normal; vAxX and vAxY are
// the model's x and y axes in view space, for perturbing normals on faces that lie in the model's xy plane.
export function shade<M extends THREE.MeshStandardMaterial>(m: M, key: string, c: Chunks): M {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms ?? {});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vObj;\nvarying vec3 vObjN;\nvarying vec3 vAxX;\nvarying vec3 vAxY;\n${c.vhead ?? ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvObj = position;\nvObjN = normal;\nvAxX = normalize(mat3(modelViewMatrix) * vec3(1.0, 0.0, 0.0));\nvAxY = normalize(mat3(modelViewMatrix) * vec3(0.0, 1.0, 0.0));\n${c.vert ?? ''}`);
    let f = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vObj;\nvarying vec3 vObjN;\nvarying vec3 vAxX;\nvarying vec3 vAxY;\n${NOISE}\n${c.head ?? ''}`);
    if (c.color) f = f.replace('#include <color_fragment>', `#include <color_fragment>\n${c.color}`);
    if (c.rough) f = f.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${c.rough}`);
    if (c.metal) f = f.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${c.metal}`);
    if (c.normal) f = f.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${c.normal}`);
    if (c.emissive) f = f.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${c.emissive}`);
    sh.fragmentShader = f;
  };
  m.customProgramCacheKey = () => key;
  return m;
}

export function withObj<M extends THREE.MeshStandardMaterial>(m: M, key: string, head: string, color: string, rough = '', normal = ''): M {
  return shade(m, key, { head, color, rough, normal });
}

// sRGB hex to linear numbers, for colours worked out inside shaders.
export function lin(hex: number): string {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
}

export interface MetalOptions {
  name: string;
  color: number;
  rough: number;
  // The direction the metal was brushed, in model axes, or none for cast or polished metal.
  brush?: 'x' | 'y' | 'z' | 'radial-z' | 'none';
  // Darkening and roughening by tarnish, 0 to 1.
  tarnish?: number;
  // A cast face: a soft, uneven tone.
  cast?: number;
  // Anisotropic highlights for brushed metal: strength, and the angle of the stretch from the uv u axis.
  aniso?: number;
  anisoRot?: number;
  extra?: Chunks;
}

// Metal for pieces: base colour from the sRGB swatch, brushing as fine lines of roughness and tone along one axis,
// tarnish gathering in blotches, an optional cast face. Each octave of the brushing fades out before its lines get
// finer than a pixel, so it never shimmers; the anisotropic highlight still carries the brushed look.
export function metal(o: MetalOptions): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ color: o.color, metalness: 1, roughness: o.rough });
  m.name = o.name;
  if (o.aniso) { m.anisotropy = o.aniso; m.anisotropyRotation = o.anisoRot ?? 0; }
  const q = o.brush === 'x' ? 'vec3(vObj.x * 0.05, vObj.y * 7.0, vObj.z * 7.0)'
    : o.brush === 'y' ? 'vec3(vObj.x * 7.0, vObj.y * 0.05, vObj.z * 7.0)'
    : o.brush === 'z' ? 'vec3(vObj.x * 7.0, vObj.y * 7.0, vObj.z * 0.05)'
    : o.brush === 'radial-z' ? 'vec3(length(vObj.xy) * 7.0, atan(vObj.y, vObj.x) * 0.6, vObj.z * 0.2)'
    : '';
  const tarn = (o.tarnish ?? 0).toFixed(3), cast = (o.cast ?? 0).toFixed(3);
  const e = o.extra ?? {};
  return shade(m, `metal-${o.name}`, {
    ...e,
    head: `${e.head ?? ''}
float mTarnish(){ return smoothstep(0.52, 0.78, wFbm(vObj * 0.045 + 3.0)) * ${tarn}; }
float mBrush(){ ${q ? `float px = length(fwidth(vObj)); float a1 = 1.0 - smoothstep(0.3, 0.7, 7.0 * px), a2 = 1.0 - smoothstep(0.3, 0.7, 18.9 * px); float a0 = 1.0 - smoothstep(0.3, 0.7, 1.6 * px); return 0.5 + (wNoise(${q} * 0.23) - 0.5) * 0.42 * a0 + (wNoise(${q}) - 0.5) * 0.5 * a1 + (wNoise(${q} * 2.7) - 0.5) * 0.35 * a2;` : 'return 0.5;'} }`,
    color: `
  { float tn = mTarnish(); float br = mBrush();
    diffuseColor.rgb *= (0.94 + 0.12 * br) * (1.0 - 0.38 * tn) * (1.0 - ${cast} * 0.35 * wFbm(vObj * 0.08));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.86, 0.7), tn * 0.5); }
  ${e.color ?? ''}`,
    rough: `
  roughnessFactor = clamp(roughnessFactor + 0.1 * (mBrush() - 0.5) + 0.2 * mTarnish() + ${cast} * 0.12 * (wFbm(vObj * 0.11) - 0.5), 0.04, 1.0);
  ${e.rough ?? ''}`,
  });
}

// A dielectric with a little tone variation: enamel, ceramic, rubber, stone.
export function dielectric(name: string, color: number, rough: number, o: { coat?: number; vary?: number; scale?: number; sheen?: number; extra?: Chunks } = {}): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: o.coat ?? 0, clearcoatRoughness: 0.18, sheen: o.sheen ?? 0, sheenRoughness: 0.5, sheenColor: new THREE.Color(color) });
  m.name = name;
  const v = (o.vary ?? 0.1).toFixed(3), s = (o.scale ?? 0.05).toFixed(4);
  const e = o.extra ?? {};
  return shade(m, `diel-${name}`, {
    ...e,
    color: `diffuseColor.rgb *= 1.0 - ${v} + 2.0 * ${v} * wFbm(vObj * ${s});\n${e.color ?? ''}`,
    rough: `roughnessFactor = clamp(roughnessFactor + 0.1 * (wNoise(vObj * ${s} * 9.0) - 0.5), 0.04, 1.0);\n${e.rough ?? ''}`,
  });
}

// A reflection layer for glass over a screen: it adds only what the glass reflects (the room, the lamp), so the
// screen underneath keeps its own light.
export function glassLayer(name: string, rough = 0.06): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ color: 0x050403, metalness: 0, roughness: rough, specularIntensity: 1, ior: 1.52, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  m.name = name;
  return m;
}

// Glass over a screen, drawn as light added on top: a soft reflection of a studio (brighter above, a strip to one
// side) by Fresnel, and the visitor's lamp as a small highlight whose peak is held below white, so the screen under it
// stays readable. uLamp is the lamp in world space, uLampK its strength 0 to 1.
export function screenGlass(name: string): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: { uLamp: { value: new THREE.Vector3() }, uLampK: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
uniform vec3 uLamp; uniform float uLampK;
varying vec3 vW; varying vec3 vN;
void main(){
  vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
  vec3 R = reflect(-V, N);
  float fr = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  float room = smoothstep(0.15, 0.85, R.y) * 0.5 + exp(-pow((R.x + 0.75) * 3.5, 2.0)) * 0.18 * smoothstep(-0.2, 0.4, R.y);
  vec3 L = normalize(uLamp - vW);
  float a = max(dot(R, L), 0.0);
  float spec = (pow(a, 3000.0) * 0.9 + pow(a, 300.0) * 0.05) * uLampK;
  vec3 col = vec3(1.0, 0.9, 0.78) * room * fr * 0.35 + vec3(1.0, 0.82, 0.6) * spec;
  gl_FragColor = vec4(col, 1.0);
}`,
  });
  m.name = name;
  return m;
}

// One coated surface of a lens element, drawn as the light it adds: the coating reflects a faint tint of the room by
// Fresnel (green, violet or amber, by the coating), and the lamp as a crisp highlight held below white. Several of these
// stacked at different curvatures give a lens its stack of moving reflections.
export function coatedGlass(name: string, tint: [number, number, number], strength = 1): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: { uLamp: { value: new THREE.Vector3() }, uLampK: { value: 1 }, uTint: { value: new THREE.Vector3(...tint) }, uK: { value: strength } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    vertexShader: 'varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */ `
uniform vec3 uLamp, uTint; uniform float uLampK, uK;
varying vec3 vW; varying vec3 vN;
void main(){
  vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
  if (dot(N, V) < 0.0) N = -N;
  vec3 R = reflect(-V, N);
  float nv = max(dot(N, V), 0.0);
  float fr = 0.03 + 0.97 * pow(1.0 - nv, 5.0);
  float room = smoothstep(0.1, 0.9, R.y) * 0.6 + exp(-pow((R.x + 0.7) * 3.0, 2.0)) * 0.25;
  vec3 coat = mix(uTint, vec3(1.0, 0.9, 0.75), pow(1.0 - nv, 2.0));
  vec3 L = normalize(uLamp - vW);
  float a = max(dot(R, L), 0.0);
  float spec = (pow(a, 700.0) * 0.9 + pow(a, 120.0) * 0.1) * uLampK;
  vec3 col = coat * room * (0.08 + fr) * 0.5 * uK + mix(vec3(1.0, 0.85, 0.65), uTint, 0.35) * spec * uK;
  gl_FragColor = vec4(col, 1.0);
}`,
  });
  m.name = name;
  return m;
}
