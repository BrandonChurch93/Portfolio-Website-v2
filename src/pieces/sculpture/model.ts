import * as THREE from 'three';
import { Builder, pause, at, cyl, rbox, xf } from '../../world/build';
import { circle, screw, slab } from '../../world/shape';
import { dielectric, metal, shade } from '../../world/surface';
import { site } from '../../content/site';

// The sculpture, in millimetres (the root is scaled by 0.001): a bronze ribbon knotted three times through itself,
// turning slowly on a turntable that tops a gallery pedestal. A plane splits it: on one side it is finished bronze, on
// the other it is its own grid of lines, the lines the surface was built from. The cut glows where the plane passes.

export const SCULPT = { SCALE: 0.001, CENTRE: 250, PEDESTAL: 0, FLOOR: -330 } as const;
const SW = site.pieces.sculpture;
const SANS = '"Sora Variable", "Sora", system-ui, sans-serif';
const MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Menlo, monospace';
// The ribbon: a (2, 3) torus knot, its section a flattened ellipse that twists as it goes, fluted along its length.
const KNOT = { R: 104, r: 44, p: 2, q: 3, a: 25, b: 8, twist: 3, segs: 900, around: 72, flutes: 7, lines: [150, 12] as const } as const;

export interface SculptureModel {
  root: THREE.Group;
  turn: THREE.Group;
  form: THREE.Mesh;
  uniforms: { uPlaneP: { value: THREE.Vector3 }; uPlaneN: { value: THREE.Vector3 }; uDraw: { value: number }; uFill: { value: number }; uGlow: { value: number }; uAll: { value: number }; uSolid: { value: number }; uFrom: { value: number } };
  glow: THREE.PointLight;
  centre: THREE.Vector3;
}

function knotPoint(t: number, out = new THREE.Vector3()): THREE.Vector3 {
  const { R, r, p, q } = KNOT;
  const a = t * Math.PI * 2;
  const c = Math.cos(q * a);
  return out.set((R + r * c) * Math.cos(p * a), r * Math.sin(q * a) * 1.1, (R + r * c) * Math.sin(p * a));
}

// The ribbon as a grid of rows along the knot and columns around its section; uv is (along, around).
function ribbon(): THREE.BufferGeometry {
  const { segs, around, a, b, twist, flutes } = KNOT;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) pts.push(knotPoint(i / segs));
  const curve = new THREE.CatmullRomCurve3(pts, true);
  const frames = curve.computeFrenetFrames(segs, true);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const P = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    const N = frames.normals[i % segs], B = frames.binormals[i % segs];
    const phi = t * Math.PI * 2 * twist;
    // The section breathes a little along the knot, so the form has rhythm.
    const breathe = 1 + 0.18 * Math.sin(t * Math.PI * 2 * 3 + 0.6);
    for (let j = 0; j <= around; j++) {
      const s = j / around, th = s * Math.PI * 2;
      const flute = 1 - 0.07 * Math.max(0, Math.cos(th * flutes * 2)) * Math.abs(Math.sin(th));
      const x = Math.cos(th) * a * breathe * flute, y = Math.sin(th) * b * (2 - breathe) * flute;
      const cx = x * Math.cos(phi) - y * Math.sin(phi), cy = x * Math.sin(phi) + y * Math.cos(phi);
      pos.push(P.x + N.x * cx + B.x * cy, P.y + N.y * cx + B.y * cy, P.z + N.z * cx + B.z * cy);
      uv.push(t, s);
    }
  }
  const row = around + 1;
  for (let i = 0; i < segs; i++) for (let j = 0; j < around; j++) {
    const k = i * row + j;
    idx.push(k, k + 1, k + row, k + 1, k + row + 1, k + row);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// The split, worked out per fragment against a plane in world space: bronze on one side, the surface's own lines on
// the other, a hot seam where the plane cuts. uDraw draws the lines along the knot (0 to 1), uFill brings the surface
// in, uAll shows every line (the making view).
const SPLIT_HEAD = /* glsl */ `
uniform vec3 uPlaneP, uPlaneN; uniform float uDraw, uFill, uGlow, uAll, uSolid, uFrom;
varying vec3 vWP; varying vec2 vPU;
float gridLine(vec2 uv){
  vec2 g = uv * vec2(${KNOT.lines[0]}.0, ${KNOT.lines[1]}.0);
  vec2 w = fwidth(g);
  vec2 d = abs(fract(g - 0.5) - 0.5) / max(w, vec2(1e-4));
  return 1.0 - min(min(d.x, d.y) / 1.2, 1.0);
}
float drawn(vec2 uv){ float a = fract(uv.x - uFrom + 1.0), b = fract(uFrom - uv.x + 1.0); return step(min(a, b), uDraw * 0.51); }
// In world metres.
float splitSide(){ return dot(vWP - uPlaneP, uPlaneN) + (1.0 - uFill) * 0.6 - uSolid * 2.0; }`;

function bronze(uniforms: SculptureModel['uniforms']): THREE.MeshPhysicalMaterial {
  const m = metal({ name: 'sculptBronze', color: 0xc08a4c, rough: 0.15, tarnish: 0.2, extra: {
    vhead: 'varying vec3 vWP; varying vec2 vPU;',
    vert: 'vWP = (modelMatrix * vec4(position, 1.0)).xyz; vPU = uv;',
    head: SPLIT_HEAD,
    color: /* glsl */ `
  float side = splitSide();
  float line = gridLine(vPU) * drawn(vPU);
  if (side > 0.0 && line < 0.08) discard;
  float wire = side > 0.0 ? 1.0 : 0.0;
  // Lines on the far side of the ribbon are dimmer, so the near mesh reads in front of the far one.
  float lineK = gl_FrontFacing ? 1.0 : 0.3;
  // Seen through the cut, the inside of the ribbon reads as its section: dark worked bronze, faintly warm.
  float cap = (1.0 - wire) * (gl_FrontFacing ? 0.0 : 1.0);
  float seam = (1.0 - smoothstep(0.0, 0.004, abs(side))) * (1.0 - wire) * (1.0 - cap);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.015, 0.01), wire);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.19, 0.09), cap);`,
    metal: 'metalnessFactor = mix(metalnessFactor, 0.0, wire);',
    rough: 'roughnessFactor = mix(mix(roughnessFactor, 0.9, wire), 0.42, cap);',
    normal: /* glsl */ `
  { vec3 q = vObj * 0.33; float e = 0.35;
    vec3 g = vec3(wNoise(q + vec3(e,0,0)) - wNoise(q - vec3(e,0,0)), wNoise(q + vec3(0,e,0)) - wNoise(q - vec3(0,e,0)), wNoise(q + vec3(0,0,e)) - wNoise(q - vec3(0,0,e)));
    normal = normalize(normal + mat3(viewMatrix) * g * 0.06 * (1.0 - wire) * (1.0 - cap)); }`,
    emissive: 'totalEmissiveRadiance += vec3(1.0, 0.6, 0.25) * (wire * line * lineK * 1.4 + seam * 0.8 + cap * 0.04 + uAll * line * 0.8 * (1.0 - wire)) * uGlow;',
  } });
  m.side = THREE.DoubleSide;
  m.userData.uniforms = uniforms;
  return m;
}

// The shadow follows the split: the lines cast thin shadows, the bronze casts a full one.
function splitDepth(uniforms: SculptureModel['uniforms']): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec2 vPU;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz; vPU = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${SPLIT_HEAD}`)
      .replace('void main() {', 'void main() {\n  if (splitSide() > 0.0 && gridLine(vPU) * drawn(vPU) < 0.08) discard;');
  };
  m.customProgramCacheKey = () => 'sculpt-depth';
  return m;
}

// The plaque: the title engraved and filled, a rule, the number.
function plaqueTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 1536; c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `500 112px ${SANS}`; (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '6px';
  g.fillText(SW.title, c.width / 2, 200);
  g.fillRect(c.width / 2 - 220, 292, 440, 5);
  g.font = `600 70px ${MONO}`; (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '14px';
  g.fillText(`${SW.number.toUpperCase()} · ${SW.line.toUpperCase()}`, c.width / 2, 390);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  return t;
}

// Degree marks round the turntable's rim.
function dialTex(): THREE.CanvasTexture {
  const S = 2048, c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  for (let k = 0; k < 360; k += 2) {
    const a = (k / 360) * Math.PI * 2, long = k % 30 === 0, mid = k % 10 === 0;
    const r1 = S * 0.49, r0 = S * (long ? 0.455 : mid ? 0.465 : 0.473);
    g.lineWidth = long ? 6 : 3;
    g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0); g.lineTo(S / 2 + Math.cos(a) * r1, S / 2 + Math.sin(a) * r1); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  return t;
}

export async function buildSculpture(): Promise<SculptureModel> {
  const root = new THREE.Group();
  root.scale.setScalar(SCULPT.SCALE);
  const uniforms = { uPlaneP: { value: new THREE.Vector3(0, SCULPT.CENTRE * SCULPT.SCALE, 0) }, uPlaneN: { value: new THREE.Vector3(1, 0, 0) }, uDraw: { value: 1.01 }, uFill: { value: 1 }, uGlow: { value: 1 }, uAll: { value: 0 }, uSolid: { value: 0 }, uFrom: { value: 0 } };

  const stone = dielectric('sculptStone', 0x241d18, 0.5, { vary: 0.1, scale: 0.07, coat: 0.3 });
  const patina = metal({ name: 'sculptPatina', color: 0x7a5534, rough: 0.42, cast: 0.8, tarnish: 0.6 });
  const steel = metal({ name: 'sculptSteel', color: 0xb9b3aa, rough: 0.22, brush: 'radial-z' });
  const brass = metal({ name: 'sculptBrass', color: 0xd4a65e, rough: 0.28, brush: 'x', tarnish: 0.3 });
  const ink = dielectric('sculptInk', 0x0d0a08, 0.8, { vary: 0.04 });
  const felt = dielectric('sculptFelt', 0x120e0b, 0.95, { vary: 0.15, scale: 0.9, sheen: 0.5 });
  const floor = dielectric('sculptFloor', 0x14100d, 0.7, { vary: 0.02, scale: 0.002, coat: 0.1 });

  await pause();
  // ---- the pedestal: a stone drum on a plinth, a shadow gap, a patinated top ring, a brass plaque ---------------
  const ped = new Builder();
  await pause();
  {
    const H = SCULPT.PEDESTAL - SCULPT.FLOOR;
    ped.add(cyl(150, 46, 128), stone, at(0, SCULPT.FLOOR + 23, 0));
    ped.add(cyl(156, 6, 128), patina, at(0, SCULPT.FLOOR + 49, 0));
    ped.add(cyl(128, H - 110, 128), stone, at(0, SCULPT.FLOOR + 52 + (H - 110) / 2, 0));
    ped.add(cyl(124, 10, 128), ink, at(0, SCULPT.PEDESTAL - 53, 0));
    ped.add(cyl(134, 46, 128), stone, at(0, SCULPT.PEDESTAL - 25, 0));
    ped.add(new THREE.TorusGeometry(134, 2.2, 12, 160).rotateX(Math.PI / 2), patina, at(0, SCULPT.PEDESTAL - 2, 0));
    ped.add(new THREE.TorusGeometry(128.4, 1.2, 10, 160).rotateX(Math.PI / 2), brass, at(0, SCULPT.PEDESTAL - 46, 0));
    // The plaque on the front of the drum, held by two screws.
    const pa = 152 / 130.5, py = SCULPT.PEDESTAL - 96;
    // The plate stands a little off the drum on its screws, so its edges catch the light and throw a shadow.
    ped.add(new THREE.CylinderGeometry(132.4, 132.4, 58, 48, 1, true, -pa / 2, pa), brass, at(0, py, 0));
    for (const yy of [-29, 29]) ped.add(new THREE.RingGeometry(129.2, 132.4, 48, 1, Math.PI / 2 - pa / 2, pa).rotateX(Math.PI / 2).scale(1, 1, -1), brass, at(0, py + yy, 0));
    for (const s of [-1, 1]) { const th = (s * pa) / 2; ped.add(rbox(1.2, 58, 3.6, 0.4), brass, at(Math.sin(th) * 130.6, py, Math.cos(th) * 130.6, [0, th, 0])); }
    for (let k = 0; k < 64; k++) { const th = (k / 64) * Math.PI * 2; ped.add(rbox(2.2, 120, 1.6, 0.6), ink, at(Math.sin(th) * 127.9, SCULPT.FLOOR + 122, Math.cos(th) * 127.9, [0, th, 0])); }
    const sc = screw(2.1);
    for (const sx of [-1, 1]) { const th = sx * 0.5; ped.add(sc.head, steel, xf({ p: [Math.sin(th) * 132.4, py, Math.cos(th) * 132.4], r: [0, th, 0] })); ped.add(sc.slot, ink, xf({ p: [Math.sin(th) * 132.4, py, Math.cos(th) * 132.4], r: [0, th, sx * 0.5] })); }
    // The turntable: a patinated disc with a felt top and a bearing collar under the rod.
    ped.add(cyl(92, 10, 128), patina, at(0, SCULPT.PEDESTAL + 5, 0));
    ped.add(cyl(88, 1.4, 128), felt, at(0, SCULPT.PEDESTAL + 10.7, 0));
    for (const r of [44, 62]) ped.add(new THREE.TorusGeometry(r, 0.7, 8, 128).rotateX(Math.PI / 2), brass, at(0, SCULPT.PEDESTAL + 11.4, 0));
    ped.add(cyl(26, 14, 64), steel, at(0, SCULPT.PEDESTAL + 18, 0));
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ped.add(sc.head, steel, xf({ p: [Math.cos(a) * 19, SCULPT.PEDESTAL + 25.1, Math.sin(a) * 19], r: [-Math.PI / 2, 0, a] })); }
    const fl = new THREE.PlaneGeometry(8000, 8000); fl.rotateX(-Math.PI / 2);
    ped.add(fl, floor, at(0, SCULPT.FLOOR, 0));
  }
  for (const m of ped.build(root, 'pedestal')) if (m.material === floor) m.userData.noWire = true;
  const plaque = new THREE.Mesh(new THREE.CylinderGeometry(132.5, 132.5, 44, 48, 1, true, -0.5, 1.0), new THREE.MeshPhysicalMaterial({ color: 0x120c08, roughness: 0.5, alphaMap: plaqueTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  plaque.position.set(0, SCULPT.PEDESTAL - 96, 0);
  plaque.name = 'plaque';
  root.add(plaque);
  const dial = new THREE.Mesh(new THREE.RingGeometry(78, 92, 192), new THREE.MeshPhysicalMaterial({ color: 0xd9b27a, metalness: 1, roughness: 0.3, alphaMap: dialTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  dial.rotation.x = -Math.PI / 2;
  dial.position.y = SCULPT.PEDESTAL + 10.05;
  dial.name = 'dial';

  await pause();
  // ---- the turning part: the turntable's dial, the rod, the form ------------------------------------------------
  const turn = new THREE.Group();
  root.add(turn);
  turn.add(dial);
  const geo = ribbon();
  const tilt = new THREE.Matrix4().makeRotationX(0.32);
  let best = Infinity, contact = new THREE.Vector3(0, -60, 0), u0 = 0;
  { const p = geo.getAttribute('position'), uvA = geo.getAttribute('uv'), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(tilt); if (v.y > -10) continue; const d = v.x * v.x + v.z * v.z; if (d < best) { best = d; contact = v.clone(); u0 = uvA.getX(i); } } }
  uniforms.uFrom.value = u0;
  const top = SCULPT.CENTRE + contact.y;
  const rod = new Builder();
  rod.add(cyl(5, top - 25, 48), steel, at(0, SCULPT.PEDESTAL + 25 + (top - 25) / 2, 0));
  for (const y of [SCULPT.PEDESTAL + 40, top - 40]) rod.add(cyl(8, 6, 48), brass, at(0, y, 0));
  // A brass cup where the rod takes the ribbon.
  rod.add(cyl(9, 10, 48, 12), brass, at(0, top - 8, 0));
  rod.build(turn, 'rod');
  const form = new THREE.Mesh(geo, bronze(uniforms));
  form.position.set(-contact.x, SCULPT.CENTRE, -contact.z);
  form.rotation.x = 0.32;
  form.castShadow = true;
  form.receiveShadow = true;
  form.customDepthMaterial = splitDepth(uniforms);
  form.name = 'form';
  form.userData.noAO = true;
  form.userData.noWire = true;
  turn.add(form);
  // The lit lines throw a little warm light on what is below them.
  const glow = new THREE.PointLight(0xff9a38, 0, 0.6, 2);
  glow.position.set(0, SCULPT.CENTRE * SCULPT.SCALE, 0);

  const centre = new THREE.Vector3(0, SCULPT.CENTRE - 60, 0);
  return { root, turn, form, uniforms, glow, centre };
}
