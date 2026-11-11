import * as THREE from 'three';

// Light the city's water and street lamps throw onto what is near them, worked out in the shader from the city's
// own layout: the five canals and the moat light their walls, beds, bridges, paving and trees by distance from the
// water and height above it; each promenade lamp lights a pool of paving and lawn round its foot. No extra lights,
// so it costs the same at any number of lamps.

export interface CityLightLayout {
  scale: number;
  radius: number;
  levels: [number, number, number, number];
  steps: [number, number, number];
  canals: number[];
  canalWidth: (main: boolean) => number;
  moat: { r: number; w: number };
  lamps: { r: number; y: number; every: number; offset: number };
}

export function cityLightUniforms() {
  return { uCityY: { value: 0 }, uWaterOn: { value: 1 }, uLampsOn: { value: 1 } };
}

export function cityLight<M extends THREE.MeshStandardMaterial>(m: M, u: ReturnType<typeof cityLightUniforms>, L: CityLightLayout, gain = 1): M {
  const [l0, l1, l2, l3] = L.levels;
  const [s3, s2, s1] = L.steps;
  const canals = L.canals.map((d) => `vec2(${Math.sin((d * Math.PI) / 180).toFixed(6)}, ${Math.cos((d * Math.PI) / 180).toFixed(6)})`).join(', ');
  const head = /* glsl */ `
varying vec3 vCityPos;
uniform float uCityY, uWaterOn, uLampsOn;
const vec2 CANAL_DIR[${L.canals.length}] = vec2[](${canals});
float cityLevel(float r){ return r < ${s3.toFixed(1)} ? ${l3.toFixed(1)} : (r < ${s2.toFixed(1)} ? ${l2.toFixed(1)} : (r < ${s1.toFixed(1)} ? ${l1.toFixed(1)} : ${l0.toFixed(1)})); }
vec3 cityLightAt(vec3 p){
  float water = 0.0;
  float r = length(p.xz);
  for (int i = 0; i < ${L.canals.length}; i++){
    vec2 d = CANAL_DIR[i];
    float along = dot(p.xz, d);
    if (along < 88.0 || along > ${(L.radius + 6).toFixed(1)}) continue;
    float hw = i == 0 ? ${(L.canalWidth(true) / 2).toFixed(1)} : ${(L.canalWidth(false) / 2).toFixed(1)};
    float across = max(0.0, abs(d.x * p.z - d.y * p.x) - hw);
    float dy = p.y - cityLevel(along);
    if (dy < -1.5) continue;
    water += exp(-across / 6.0) * exp(-max(dy, 0.0) / 9.0);
  }
  float mdy = p.y - ${l3.toFixed(1)};
  if (mdy > -1.5) water += exp(-max(0.0, abs(r - ${L.moat.r.toFixed(1)}) - ${(L.moat.w / 2).toFixed(1)}) / 6.0) * exp(-max(mdy, 0.0) / 9.0);
  float a = degrees(atan(p.x, p.z));
  float k = floor((a - ${L.lamps.offset.toFixed(1)}) / ${L.lamps.every.toFixed(1)} + 0.5) * ${L.lamps.every.toFixed(1)} + ${L.lamps.offset.toFixed(1)};
  vec3 lp = vec3(sin(radians(k)), 0.0, cos(radians(k))) * ${L.lamps.r.toFixed(1)};
  lp.y = ${L.lamps.y.toFixed(1)};
  float ld = length(p - lp);
  float lamp = min(1.2, pow(10.5 / max(ld, 1.0), 3.0)) * step(p.y, ${L.lamps.y.toFixed(1)});
  return vec3(1.0, 0.56, 0.2) * water * uWaterOn * 1.5 + vec3(1.0, 0.72, 0.42) * lamp * uLampsOn * 4.0;
}`;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, rr) => {
    prev?.call(m, sh, rr);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCityPos;\nuniform float uCityY;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvec4 cityW = modelMatrix * vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\ncityW = modelMatrix * instanceMatrix * vec4(transformed, 1.0);\n#endif\nvCityPos = vec3(cityW.x, cityW.y - uCityY, cityW.z) / ${L.scale.toFixed(6)};`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${head}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * cityLightAt(vCityPos) * ${gain.toFixed(3)};`);
  };
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${key()}|citylight${gain}`;
  return m;
}

// Surface life for planted things, in city millimetres (needs cityLight on the same material first): clumps of
// leaves with their own facing and gaps between them, or lawn with patches, mown bands and fine blades.
export function organic<M extends THREE.MeshStandardMaterial>(m: M, kind: 'leaves' | 'lawn' | 'paving'): M {
  const noise = /* glsl */ `
float oHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float oNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(oHash(i), oHash(i + vec3(1,0,0)), f.x), mix(oHash(i + vec3(0,1,0)), oHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(oHash(i + vec3(0,0,1)), oHash(i + vec3(1,0,1)), f.x), mix(oHash(i + vec3(0,1,1)), oHash(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
  const leaves = /* glsl */ `
  vec3 lp = vCityPos * 1.7;
  float n1 = oNoise(lp), n2 = oNoise(lp * 2.7 + 11.0);
  float clump = smoothstep(0.25, 0.75, n1 * 0.65 + n2 * 0.35);
  diffuseColor.rgb *= 0.55 + 0.6 * clump;
  diffuseColor.rgb *= 0.92 + 0.16 * oNoise(vCityPos * 0.12);`;
  const leavesN = /* glsl */ `
  { vec3 q = vCityPos * 1.7; vec3 g = vec3(oNoise(q + vec3(0.5,0,0)) - oNoise(q - vec3(0.5,0,0)), oNoise(q + vec3(0,0.5,0)) - oNoise(q - vec3(0,0.5,0)), oNoise(q + vec3(0,0,0.5)) - oNoise(q - vec3(0,0,0.5)));
    normal = normalize(normal + mat3(viewMatrix) * g * 1.6); }`;
  const lawn = /* glsl */ `
  vec3 gp = vCityPos;
  float pch = oNoise(gp * 0.035) * 0.6 + oNoise(gp * 0.11 + 7.0) * 0.4;
  float band = 0.5 + 0.5 * sin(atan(gp.x, gp.z) * 90.0);
  float blades = oNoise(vec3(gp.x * 2.4, 0.0, gp.z * 2.4));
  diffuseColor.rgb *= 0.6 + 0.65 * pch;
  diffuseColor.rgb *= 0.94 + 0.08 * band;
  diffuseColor.rgb *= 0.86 + 0.28 * blades;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.05, 0.7), smoothstep(0.62, 0.8, oNoise(gp * 0.05 + 3.0)) * 0.6);`;
  const paving = /* glsl */ `
  vec3 pp = vCityPos;
  diffuseColor.rgb *= 0.8 + 0.32 * oNoise(pp * 0.018);
  diffuseColor.rgb *= 0.93 + 0.12 * oNoise(pp * 0.22 + 5.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.86, 0.84, 0.8), smoothstep(0.6, 0.85, oNoise(pp * 0.07 + 2.0)));`;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, rr) => {
    prev?.call(m, sh, rr);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
${noise}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
${kind === 'leaves' ? leaves : kind === 'lawn' ? lawn : paving}`);
    if (kind === 'leaves') sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
${leavesN}`);
  };
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${key()}|organic-${kind}`;
  return m;
}
