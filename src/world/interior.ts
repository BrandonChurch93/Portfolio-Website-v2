import * as THREE from 'three';

// Interior mapped glass (van Dongen 2008): every window cell of a facade ray traces a room box behind the glass, so
// each window shows a real room in perspective (back wall, floor, ceiling, side walls) that shifts as the view moves.
// The geometry carries uv (bays across, floors up) and a cell attribute (bay width, floor height, room depth, seed)
// in model units. The glass on top is an ordinary physically based surface, so it still reflects the studio.

export interface InteriorOptions {
  // Model units to world units (the city is built in millimetres).
  scale: number;
  // 0 cool white rooms, 1 warm amber rooms.
  warmth?: number;
  // How many rooms have their lights on, 0 to 1.
  lit?: number;
  gain?: number;
  seed?: number;
}

const FRAG_HEAD = /* glsl */ `
varying vec4 vCell;
varying vec3 vWPos;
varying vec3 vWNrm;
uniform float uScale, uWarmth, uLit, uGain, uSeed, uOn;
float ihash(vec2 p){ p = fract(p * vec2(234.34, 435.345) + uSeed * 0.137); p += dot(p, p + 34.23); return fract(p.x * p.y); }
vec3 roomLight(float k){
  // Mostly warm incandescent, some neutral, a few cool.
  vec3 warm = vec3(1.0, 0.64, 0.36), neutral = vec3(1.0, 0.8, 0.6), cool = vec3(0.78, 0.86, 1.0);
  return k < 0.62 ? warm : (k < 0.9 ? neutral : cool);
}
// A silhouette on a plane in the middle of the room, in room coordinates (x across, y up, both 0 to 1).
float figure(vec2 q, float kind, float at){
  if (kind < 0.3){
    // A person standing.
    float body = step(abs(q.x - at), 0.055) * step(q.y, 0.56) * step(0.0, q.y);
    float head = step(length((q - vec2(at, 0.64)) * vec2(1.0, 1.15)), 0.05);
    return max(body, head);
  } else if (kind < 0.55){
    // A plant in a pot.
    float pot = step(abs(q.x - at), 0.05) * step(q.y, 0.14);
    float leaves = step(length((q - vec2(at, 0.3)) * vec2(1.0, 0.8)), 0.13);
    return max(pot, leaves);
  } else if (kind < 0.8){
    // A sofa or a long desk.
    return step(abs(q.x - at), 0.26) * step(q.y, 0.22 + 0.06 * step(abs(q.x - at), 0.2));
  }
  // A shelf unit.
  return step(abs(q.x - at), 0.12) * step(q.y, 0.7) * (1.0 - 0.6 * step(0.5, fract(q.y * 6.0)) * step(abs(q.x - at), 0.1));
}
vec3 interior(vec2 uv){
  vec3 N = normalize(vWNrm);
  vec3 q0 = dFdx(vWPos), q1 = dFdy(vWPos);
  vec2 s0 = dFdx(uv), s1 = dFdy(uv);
  vec3 q1p = cross(q1, N), q0p = cross(N, q0);
  vec3 T = q1p * s0.x + q0p * s1.x, B = q1p * s0.y + q0p * s1.y;
  float det = max(dot(T, T), dot(B, B));
  if (det <= 0.0) return vec3(0.0);
  float sc = inversesqrt(det); T *= sc; B *= sc;
  vec3 V = normalize(vWPos - cameraPosition);
  float fy = floor(uv.y);
  // A room spans one to three bays, chosen per floor, so lit windows come in runs, not a checkerboard.
  float span = 1.0 + floor(ihash(vec2(fy, 3.1 + vCell.w)) * 2.999);
  float bx = floor(uv.x / span);
  vec2 rid = vec2(bx, fy) + vCell.w * 17.0;
  vec2 p = vec2(fract(uv.x / span), fract(uv.y));
  vec3 d = vec3(dot(V, T) / (vCell.x * span * uScale), dot(V, B) / (vCell.y * uScale), dot(V, N) / (vCell.z * uScale));
  if (d.z > -1e-4) return vec3(0.0);
  vec3 o = vec3(p, 0.0);
  float tx = ((d.x > 0.0 ? 1.0 : 0.0) - o.x) / d.x;
  float ty = ((d.y > 0.0 ? 1.0 : 0.0) - o.y) / d.y;
  float tz = -1.0 / d.z;
  float t = min(min(tx, ty), tz);
  vec3 h = o + d * t;
  float r1 = ihash(rid), r2 = ihash(rid + 7.3), r3 = ihash(rid + 13.1), r4 = ihash(rid + 29.7), r5 = ihash(rid + 41.9);
  // Whole floors tend to be lit or dark together.
  float floorBusy = ihash(vec2(fy * 1.7, vCell.w + 5.0));
  float on = step(r1, uLit * (0.45 + 0.9 * floorBusy)) * uOn;
  // Four kinds of room: a home lit by a floor lamp, an office under rows of panels, a dim room, a bright lobby.
  float kind = ihash(rid + 53.3);
  bool home = kind < 0.45, office = kind >= 0.45 && kind < 0.72, dim = kind >= 0.72 && kind < 0.86;
  vec3 L = home ? vec3(1.0, 0.6, 0.32) : (office ? roomLight(fract(r2 + uWarmth * 0.37 + (1.0 - uWarmth) * 0.3) * 0.95 + 0.05) : vec3(1.0, 0.7, 0.42));
  float wallPick = fract(r3 * 7.13);
  vec3 wallC = wallPick < 0.4 ? vec3(0.74, 0.67, 0.56) : (wallPick < 0.6 ? vec3(0.56, 0.5, 0.44) : (wallPick < 0.75 ? vec3(0.55, 0.32, 0.22) : (wallPick < 0.88 ? vec3(0.44, 0.45, 0.38) : vec3(0.26, 0.18, 0.12))));
  vec3 floorC = mix(vec3(0.28, 0.19, 0.12), vec3(0.46, 0.34, 0.22), r4);
  vec3 alb;
  float panel = 0.0;
  if (t == tz){
    alb = wallC;
    if (home){
      float sofa = step(h.y, 0.2 + 0.05 * step(abs(h.x - 0.45), 0.25)) * step(abs(h.x - (0.3 + 0.4 * r3)), 0.24);
      alb = mix(alb, mix(vec3(0.42, 0.24, 0.14), vec3(0.2, 0.16, 0.12), r5), sofa);
      float art = step(0.42, h.y) * step(h.y, 0.68) * step(abs(h.x - (0.3 + 0.4 * r2)), 0.1);
      alb = mix(alb, mix(vec3(0.6, 0.38, 0.2), vec3(0.85, 0.7, 0.45), r5), art * step(0.35, r4));
    } else if (office){
      float desks = step(h.y, 0.26) * step(0.18, h.y) * (1.0 - step(0.85, fract(h.x * 3.0)));
      alb = mix(alb, vec3(0.34, 0.3, 0.26), desks);
      float shelf = step(0.3, h.y) * step(h.y, 0.75) * step(0.8, h.x) * (0.7 + 0.3 * step(0.5, fract(h.y * 10.0)));
      alb = mix(alb, vec3(0.3, 0.22, 0.15), shelf);
    } else {
      float low = step(h.y, 0.24) * step(0.12 + 0.3 * r3, h.x) * step(h.x, 0.6 + 0.3 * r4);
      alb = mix(alb, vec3(0.2, 0.15, 0.11), low * 0.8);
    }
  } else if (t == ty){
    if (d.y < 0.0){
      alb = floorC * (0.85 + 0.15 * step(0.5, fract(h.z * 7.0)));
      float rug = step(abs(h.x - 0.5), 0.28) * step(abs(h.z + 0.55), 0.22) * step(0.4, r3) * (home ? 1.0 : 0.0);
      alb = mix(alb, mix(vec3(0.45, 0.24, 0.14), vec3(0.32, 0.3, 0.24), r5), rug);
    } else {
      alb = vec3(0.7, 0.66, 0.6);
      if (office) panel = smoothstep(0.08, 0.05, abs(fract(h.x * 2.0) - 0.5) - 0.3) * smoothstep(0.06, 0.03, abs(fract(h.z * 2.0) - 0.5) - 0.2);
      else if (!dim) panel = smoothstep(0.14, 0.1, length(vec2(h.x - 0.5, h.z + 0.5)));
    }
  } else {
    alb = wallC * 0.9;
    // Curtains drawn to the sides in homes.
    if (home) alb = mix(alb, vec3(0.5, 0.36, 0.24), step(h.z, -0.0) * step(-0.12, h.z) * 0.8);
  }
  // Where the light comes from: a floor lamp in a back corner for homes, the ceiling for the rest.
  vec3 Lp = home ? vec3(0.12 + 0.76 * step(0.5, r5), 0.55, -0.85) : vec3(0.5, 0.97, -0.5);
  float dist = length((h - Lp) * vec3(1.0, 1.2, 1.0));
  float E = (home ? 0.08 : 0.2) + (home ? 1.6 : 1.15) / (1.0 + (home ? 9.0 : 6.0) * dist * dist);
  if (dim) E *= 0.3;
  if (kind >= 0.86) E *= 1.5;
  float lampShade = home ? smoothstep(0.07, 0.04, length((h.xy - Lp.xy) * vec2(1.0, 0.8))) * step(abs(h.z - Lp.z), 0.2) : 0.0;
  vec3 lit = alb * L * E + L * panel * 2.4 + L * lampShade * 2.0;
  vec3 dark = alb * vec3(0.055, 0.045, 0.036) + vec3(0.003, 0.0025, 0.002);
  vec3 c = mix(dark, lit, on);
  // Something standing in the middle of the room, against the light behind it.
  float zm = -(0.32 + 0.3 * r4);
  float tm = zm / d.z;
  if (tm > 0.0 && tm < t){
    vec3 m = o + d * tm;
    float f = figure(m.xy, r5, 0.2 + 0.6 * r3) * step(0.25, r2);
    c = mix(c, mix(dark, alb * L * 0.12, on), f);
  }
  // Blinds part way down in some rooms.
  float blind = step(0.74, r4) * step(1.0 - (0.25 + 0.5 * r2), p.y);
  c = mix(c, mix(dark, L * 0.4, on) * (0.65 + 0.35 * step(0.5, fract(p.y * 16.0))), blind);
  // Mullions between bays and a transom between floors.
  vec2 cellP = vec2(fract(uv.x), p.y);
  float frame = smoothstep(0.04, 0.025, min(min(cellP.x, 1.0 - cellP.x), min(cellP.y, 1.0 - cellP.y)));
  // At grazing angles the glass reflects and the room fades.
  float fres = pow(1.0 - abs(dot(V, N)), 4.0);
  return c * uGain * (1.0 - frame) * (1.0 - 0.85 * fres);
}
`;

export function interiorMaterial(o: InteriorOptions): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0x0b0a09, metalness: 0.1, roughness: 0.24, envMapIntensity: 1.1 });
  m.name = 'interior';
  const uniforms = {
    uScale: { value: o.scale },
    uWarmth: { value: o.warmth ?? 0.6 },
    uLit: { value: o.lit ?? 0.72 },
    uGain: { value: o.gain ?? 1.6 },
    uSeed: { value: o.seed ?? 0 },
    uOn: { value: 1 },
  };
  m.userData.uniforms = uniforms;
  m.defines = { ...(m.defines ?? {}), USE_UV: '' };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 cell;\nvarying vec4 vCell;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCell = cell;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += interior(vUv);');
  };
  m.customProgramCacheKey = () => 'interior-v3';
  return m;
}
