import * as THREE from 'three';

// Surfaces worked out in the shader from the model's own millimetre coordinates, so nothing repeats or stretches.

const NOISE = /* glsl */ `
float wHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float wNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wHash(i), wHash(i + vec3(1,0,0)), f.x), mix(wHash(i + vec3(0,1,0)), wHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(wHash(i + vec3(0,0,1)), wHash(i + vec3(1,0,1)), f.x), mix(wHash(i + vec3(0,1,1)), wHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float wFbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * wNoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
`;

function withObj<M extends THREE.MeshStandardMaterial>(m: M, key: string, head: string, color: string, rough = '', normal = ''): M {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms ?? {});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nvarying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;\nvObjN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vObj;\nvarying vec3 vObjN;\n${NOISE}\n${head}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${color}`);
    if (rough) sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${rough}`);
    if (normal) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${normal}`);
  };
  m.customProgramCacheKey = () => key;
  return m;
}

// Walnut. The top is three boards glued along their length; each board is cut from its own log, so the growth rings
// are arcs of a log's cross section met at an angle, warped by the tree's wobble, with pores along the grain, the odd
// ray fleck, and sapwood paler at one board's edge. Where the water runs the wood darkens and turns glossy.
export function walnut(boardW: number, frontZ: number): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.28 });
  m.name = 'walnut';
  m.userData.uniforms = { uWetX: { value: -1e4 }, uWetX0: { value: -1e4 }, uFrontZ: { value: frontZ } };
  return withObj(m, 'walnut-v2', /* glsl */ `
uniform float uWetX, uWetX0, uFrontZ;
float wetAt(vec3 p){
  float along = smoothstep(uWetX0 - 4.0, uWetX0 + 8.0, p.x) * (1.0 - smoothstep(uWetX - 6.0, uWetX + 6.0, p.x));
  float front = smoothstep(uFrontZ - 46.0, uFrontZ - 8.0, p.z) * step(-46.0, p.y);
  float edge = step(uFrontZ - 1.0, p.z) * step(-16.0, p.y);
  float drip = 0.65 + 0.35 * wNoise(vec3(p.x * 0.05, 0.0, p.z * 0.08));
  return clamp(along * max(front * drip, edge), 0.0, 1.0);
}
vec3 walnutAt(vec3 p){
  float board = floor((p.z + ${(boardW * 1.5).toFixed(1)}) / ${boardW.toFixed(1)});
  float bs = wHash(vec3(board, 3.1, 7.7));
  // The log's centre lies below and to one side of the board.
  // The log lies just under the board and a little askew to it, so its rings meet the surface in arches (the
  // cathedral figure of flat sawn wood), not in parallel lines.
  vec2 c = vec2(-70.0 - bs * 120.0, (board - 1.0) * ${boardW.toFixed(1)} + (bs - 0.5) * 120.0);
  float skew = (0.035 + 0.05 * bs) * (bs > 0.5 ? 1.0 : -1.0);
  vec2 q = vec2(p.y + p.x * skew * 0.8, p.z + p.x * skew * 0.35) - c;
  float wob = wFbm(vec3(p.x * 0.0028, bs * 9.0, 0.0)) * 22.0 + wFbm(p * 0.012) * 3.0;
  float r = length(q) + wob + p.x * (bs - 0.5) * 0.02;
  float spacing = 3.4 + 1.8 * wNoise(vec3(r * 0.01, bs * 5.0, 0.0));
  float ring = fract(r / spacing);
  float late = smoothstep(0.55, 0.92, ring) * (1.0 - smoothstep(0.92, 1.0, ring));
  float pores = smoothstep(0.62, 0.9, wNoise(vec3(p.x * 0.06, p.y * 1.6, p.z * 1.6)));
  float figure = wFbm(vec3(p.x * 0.004, p.z * 0.02, bs * 3.0));
  vec3 early = mix(vec3(0.062, 0.03, 0.016), vec3(0.1, 0.05, 0.026), figure);
  vec3 lateC = vec3(0.018, 0.008, 0.004);
  vec3 col = mix(early, lateC, late * 0.85);
  col *= 1.0 - pores * 0.35;
  float ray = smoothstep(0.86, 0.95, wNoise(vec3(p.x * 0.09, r * 0.6, bs * 13.0))) * 0.18;
  col += ray * vec3(0.09, 0.05, 0.026);
  float sap = smoothstep(${(boardW * 0.42).toFixed(1)}, ${(boardW * 0.5).toFixed(1)}, abs(p.z - (board - 1.0) * ${boardW.toFixed(1)})) * step(0.6, bs);
  col = mix(col, vec3(0.2, 0.12, 0.07), sap * 0.5);
  return col;
}`, /* glsl */ `
  float wet = wetAt(vObj);
  diffuseColor.rgb = walnutAt(vObj) * (1.0 - 0.45 * wet);`, /* glsl */ `
  roughnessFactor = mix(roughnessFactor + 0.08 * wNoise(vObj * 0.6), 0.1, wetAt(vObj));`);
}

// Leather: a fine pebble grain in the surface, a little uneven in tone, slightly worn where hands rest.
export function leather(): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.72, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x5a4636) });
  m.name = 'leather';
  return withObj(m, 'leather-v1', '', /* glsl */ `
  float tone = wFbm(vObj * 0.01);
  float wear = smoothstep(0.55, 0.75, wFbm(vec3(vObj.x * 0.006, 0.0, vObj.z * 0.012) + 4.0));
  diffuseColor.rgb = mix(vec3(0.022, 0.016, 0.012), vec3(0.036, 0.026, 0.019), tone) + wear * vec3(0.012, 0.008, 0.005);`,
  /* glsl */ `
  roughnessFactor = roughnessFactor - 0.12 * smoothstep(0.55, 0.75, wFbm(vec3(vObj.x * 0.006, 0.0, vObj.z * 0.012) + 4.0));`,
  /* glsl */ `
  { vec3 q = vObj * 1.1; float e = 0.35;
    vec3 g = vec3(wNoise(q + vec3(e,0,0)) - wNoise(q - vec3(e,0,0)), 0.0, wNoise(q + vec3(0,0,e)) - wNoise(q - vec3(0,0,e)));
    normal = normalize(normal + mat3(viewMatrix) * g * 0.45); }`);
}

// Plaster: a warm dark wall with soft trowel marks.
export function plaster(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  m.name = 'plaster';
  return withObj(m, 'plaster-v1', '', /* glsl */ `
  float t = wFbm(vObj * 0.004) * 0.6 + wFbm(vObj * 0.03) * 0.4;
  diffuseColor.rgb = mix(vec3(0.012, 0.0095, 0.008), vec3(0.024, 0.018, 0.014), t);`);
}

// Brushed aluminium in a dark anodised finish: fine lines along x.
export function anodised(color: number, name: string): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ color, metalness: 0.85, roughness: 0.38 });
  m.name = name;
  return withObj(m, `anod-${name}`, '', /* glsl */ `
  diffuseColor.rgb *= 0.92 + 0.16 * wNoise(vec3(vObj.x * 0.08, vObj.y * 6.0, vObj.z * 6.0));`,
  /* glsl */ `
  roughnessFactor += 0.08 * (wNoise(vec3(vObj.x * 0.05, vObj.y * 9.0, vObj.z * 9.0)) - 0.5);`);
}
