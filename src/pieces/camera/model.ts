import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, pause, at, cyl, lathe, rbox, xf } from '../../world/build';
import { circle, rounded, rrect, screw, slab, type P2 } from '../../world/shape';
import { coatedGlass, dielectric, metal, shade } from '../../world/surface';
import { site } from '../../content/site';

// The camera, in millimetres (the root is scaled by 0.001). The body's own space: x across, y up, the lens axis along
// +z. It sits on a small tripod whose feet stand on the floor at y = FLOOR.

export const CAM = { SCALE: 0.001, FLOOR: -152, LENS: [16, -4, 18] as const, YAW: -26 } as const;
const CW = site.pieces.camera;
const D2R = Math.PI / 180;
const MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Menlo, monospace';
const SANS = '"Sora Variable", "Sora", system-ui, sans-serif';

// The lens, along its own +z from the mount face: rings and where the glass sits.
const LENS = { mount: 3.5, aperture: [4, 13] as const, dof: [13, 17] as const, focus: [17, 37] as const, front: [37, 54] as const, len: 54, rFront: 30, rGlass: 24.5, iris: 30 } as const;

export interface CameraModel {
  root: THREE.Group;
  body: THREE.Group;
  lens: THREE.Group;
  blades: THREE.Mesh[];
  glass: THREE.ShaderMaterial[];
  glow: THREE.MeshBasicMaterial;
  flash: THREE.MeshBasicMaterial;
  speedDial: THREE.Group;
  release: THREE.Group;
  lever: THREE.Group;
  centre: THREE.Vector3;
  lensFront: THREE.Vector3;
}

// Black enamel worn to brass where hands and straps rub: on edges and round corners, where the surface turns away
// from the faces of the box, in uneven patches.
function enamel(): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.22 });
  m.name = 'camEnamel';
  return shade(m, 'cam-enamel', {
    head: /* glsl */ `
float wearAt(){
  vec3 n = abs(normalize(vObjN));
  float bevel = smoothstep(0.22, 0.5, min(n.y, max(n.x, n.z)));
  float column = smoothstep(0.12, 0.34, 1.0 - max(n.x, n.z)) * (1.0 - n.y) * smoothstep(20.0, 36.0, abs(vObj.y));
  float edge = max(bevel, column);
  float field = wFbm(vObj * 0.11 + 7.0) + (wFbm(vObj * 0.75 + 3.0) - 0.5) * 0.45;
  float wpatch = smoothstep(0.46, 0.6, field);
  return clamp(edge * wpatch * 1.2, 0.0, 1.0);
}`,
    color: `float wear = wearAt();\n  diffuseColor.rgb = mix(vec3(0.0105, 0.0098, 0.0092) * (0.9 + 0.2 * wNoise(vObj * 0.4)), vec3(0.62, 0.42, 0.17), wear);`,
    rough: 'roughnessFactor = mix(roughnessFactor, 0.34, wear);',
    metal: 'metalnessFactor = mix(0.0, 1.0, wear);',
  });
}

// Pebbled leatherette.
function leatherette(): THREE.MeshPhysicalMaterial {
  const m = dielectric('camLeather', 0x15120f, 0.7, { vary: 0.12, scale: 0.4, sheen: 0.35, extra: {
    normal: /* glsl */ `
  { mat3 rot = mat3(0.8, 0.6, 0.0, -0.6, 0.8, 0.0, 0.0, 0.0, 1.0);
    vec3 q = rot * vObj * 2.3 + vec3(wFbm(vObj * 0.6), wFbm(vObj * 0.6 + 5.0), 0.0) * 1.4; float e = 0.22;
    #define PEB(p) (1.0 - abs(wNoise(p) * 2.0 - 1.0))
    vec3 g = vec3(PEB(q + vec3(e,0,0)) - PEB(q - vec3(e,0,0)), PEB(q + vec3(0,e,0)) - PEB(q - vec3(0,e,0)), 0.0);
    normal = normalize(normal + mat3(viewMatrix) * g * 0.55); }`,
  } });
  return m;
}

// What the viewfinder shows: a dim warm field with a thin bright frame.
function finderView(): THREE.MeshBasicMaterial {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#2a2018'); gr.addColorStop(1, '#14100c');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 96);
  for (let i = 0; i < 9; i++) { const x = 30 + ((i * 97) % 200), y = 20 + ((i * 53) % 56), r = 3 + (i % 3) * 2; const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(255,190,120,0.55)'); rg.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  const vg = g.createRadialGradient(128, 48, 20, 128, 48, 130); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.7)'); g.fillStyle = vg; g.fillRect(0, 0, 256, 96);
  g.strokeStyle = '#d8b88a'; g.lineWidth = 2; g.strokeRect(40, 18, 176, 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.5, 0.5, 0.5) });
  m.name = 'camFinder';
  return m;
}

// A band of engraved figures for a ring: the figures painted around a canvas strip that wraps the ring.
function band(labels: readonly string[], o: { fg: string; bg: string; arc: number; start: number; size: number; ticks?: boolean; font?: string; w?: number }): THREE.CanvasTexture {
  const W = o.w ?? 2048, H = 96;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = o.bg; g.fillRect(0, 0, W, H);
  g.fillStyle = o.fg; g.strokeStyle = o.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = o.font ?? `600 ${o.size}px ${MONO}`;
  labels.forEach((s, i) => {
    const u = (o.start + (i / Math.max(1, labels.length - 1)) * o.arc) % 1;
    g.fillText(s, u * W, H * 0.55);
    if (o.ticks) { g.lineWidth = 3; g.beginPath(); g.moveTo(u * W, 6); g.lineTo(u * W, 22); g.stroke(); }
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Text round the front ring of the lens.
function ringText(text: string): THREE.CanvasTexture {
  const S = 1024;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0d0b0a'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#d9cbb3'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 34px ${MONO}`;
  const r = S * 0.455, chars = [...text], step = 0.052;
  chars.forEach((ch, i) => {
    const a = -Math.PI / 2 - ((chars.length - 1) / 2) * step + i * step;
    g.save(); g.translate(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r); g.rotate(a + Math.PI / 2); g.fillText(ch, 0, 0); g.restore();
  });
  // A red dot index on the other side, and a fine circle.
  g.fillStyle = '#c96a2a'; g.beginPath(); g.arc(S / 2, S / 2 + r, 7, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// The top of a dial: figures round its face.
function dialFace(labels: readonly string[], fg: string, bg: string, from: number, to: number, size = 64): THREE.CanvasTexture {
  const S = 1024;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  g.fillStyle = fg; g.strokeStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 ${size}px ${MONO}`;
  labels.forEach((s, i) => {
    const a = from + ((to - from) * i) / Math.max(1, labels.length - 1);
    g.save(); g.translate(S / 2 + Math.cos(a) * S * 0.36, S / 2 + Math.sin(a) * S * 0.36); g.rotate(a + Math.PI / 2); g.fillText(s, 0, 0); g.restore();
  });
  g.lineWidth = 3; g.beginPath(); g.arc(S / 2, S / 2, S * 0.27, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const tube = (r0: number, r1: number, z0: number, z1: number, seg = 96) => {
  // A ring between two radii along z, with its outer and inner walls and both faces.
  const g = lathe([[r1, z0], [r0, z0], [r0, z1], [r1, z1], [r1, z0]].map(([r, z]) => [r, z] as P2).reverse(), seg);
  g.rotateX(Math.PI / 2);
  return toCreasedNormals(g, (40 * Math.PI) / 180);
};

export async function buildCamera(): Promise<CameraModel> {
  const root = new THREE.Group();
  root.scale.setScalar(CAM.SCALE);
  const body = new THREE.Group();
  body.rotation.y = CAM.YAW * D2R;
  root.add(body);

  await pause();
  // ---- materials ------------------------------------------------------------------------------------
  const paint = enamel();
  const leather = leatherette();
  const chrome = metal({ name: 'camChrome', color: 0xc2bdb4, rough: 0.27, brush: 'radial-z' });
  const chromeX = metal({ name: 'camChromeX', color: 0xc4bfb6, rough: 0.26, brush: 'x' });
  const anod = metal({ name: 'camAnod', color: 0x2a2724, rough: 0.36, brush: 'radial-z' });
  const brass = metal({ name: 'camBrass', color: 0xd2a35a, rough: 0.3, brush: 'radial-z', tarnish: 0.3 });
  const rubber = dielectric('camRubber', 0x161311, 0.82, { vary: 0.1, scale: 0.6 });
  const ink = dielectric('camInk', 0x0b0908, 0.85, { vary: 0.04 });
  const matte = dielectric('camMatte', 0x0e0c0b, 0.62, { vary: 0.08, scale: 0.3, sheen: 0.4 });
  const darkGlass = new THREE.MeshPhysicalMaterial({ color: 0x0b0d0e, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.5, envMapIntensity: 2.5 }); darkGlass.name = 'camWindow';
  const portGlass = new THREE.MeshPhysicalMaterial({ color: 0x1c2a33, roughness: 0.05, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.5 }); portGlass.name = 'camPort';
  // Behind the finder glass: the dim scene it shows, with a bright-line frame.
  const finder = finderView();
  const floor = dielectric('camFloor', 0x1b140e, 0.9, { vary: 0.035, scale: 0.002 });
  const steel = metal({ name: 'camSteel', color: 0x9a958e, rough: 0.3, brush: 'radial-z' });

  await pause();
  // ---- the body -----------------------------------------------------------------------------------------
  const b = new Builder();
  await pause();
  {
    // Lower body and top plate: rounded in plan, extruded up; rotateX maps the plan's y to -z.
    const plan = (w: number, d: number, r: number) => rounded(rrect(0, 0, w, d, r));
    const lower = slab(plan(136, 34, 9), [], -40, 29, 1.6); lower.rotateX(-Math.PI / 2);
    b.add(lower, paint);
    const top = slab(plan(136, 34.6, 9.2), [], 28.6, 41.5, 2.2, 4); top.rotateX(-Math.PI / 2);
    b.add(top, paint);
    const bottom = slab(plan(134, 33, 8.6), [], -42.5, -39.4, 1.1); bottom.rotateX(-Math.PI / 2);
    b.add(bottom, paint);
    // A seam under the top plate.
    const seam = slab(plan(135.2, 33.2, 8.6), [], 28.2, 29.4, 0); seam.rotateX(-Math.PI / 2);
    b.add(seam, ink);
    // Leatherette on the front (cut round the mount) and the back.
    const [lx, ly] = CAM.LENS;
    b.add(slab(rounded(rrect(0, -6, 116, 60, 3)), [circle(lx, ly, 27.5)], 16.9, 17.6, 0.3, 2), leather);
    b.add(slab(rounded(rrect(0, -6, 116, 60, 3)), [], -17.6, -16.9, 0.3, 2), leather);
    // The mount: a chrome flange and its locking ring, screws round it.
    b.add(tube(25.5, 31, 17.2, 19.6), chrome, at(lx, ly, 0));
    b.add(tube(22, 25.5, 17.6, 19.2), ink, at(lx, ly, 0));
    const sc = screw(1.1);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; b.add(sc.head, steel, at(lx + Math.cos(a) * 28.6, ly + Math.sin(a) * 28.6, 19.6)); b.add(sc.slot, ink, at(lx + Math.cos(a) * 28.6, ly + Math.sin(a) * 28.6, 19.6, [0, 0, a])); }
    // Viewfinder window in a chrome frame, a small light window, the lens release, the self timer and a flash port.
    b.add(slab(rounded(rrect(-44, 35, 22, 9, 1.8)), [rounded(rrect(-44, 35, 17.5, 5.4, 1))], 17.6, 20.6, 0.5, 2), chromeX);
    b.add(rbox(17.6, 5.6, 0.4, 0.4), darkGlass, at(-44, 35, 19.7));
    b.add(rbox(18, 6, 0.4, 0.2), finder, at(-44, 35, 17.42));
    b.add(tube(2.4, 3.6, 17.6, 18.9, 48), chrome, at(-22, 35, 0));
    b.add(cyl(2.4, 0.6, 32), portGlass, xf({ p: [-22, 35, 18.2], r: [Math.PI / 2, 0, 0] }));
    b.add(slab(rounded(rrect(-44, 35, 17.6, 5.6, 1)), [rounded(rrect(-44, 35, 15.2, 3.8, 0.8))], 17.42, 20.2, 0), ink);
    b.add(cyl(4.6, 3.2, 48), chrome, xf({ p: [48, -14, 18.6], r: [Math.PI / 2, 0, 0] }));
    b.add(cyl(3.4, 1.0, 48), chrome, xf({ p: [48, -14, 20.6], r: [Math.PI / 2, 0, 0] }));
    b.add(rbox(4, 13, 2.4, 1), chromeX, at(-40, 8, 18.4, [0, 0, 0.35]));
    b.add(cyl(2.2, 1.8, 32), chrome, xf({ p: [-40, 8, 18.2], r: [Math.PI / 2, 0, 0] }));
    b.add(cyl(2.6, 3, 32), chrome, xf({ p: [-56, -24, 18.4], r: [Math.PI / 2, 0, 0] }));
    b.add(cyl(1.2, 3.2, 24), ink, xf({ p: [-56, -24, 18.8], r: [Math.PI / 2, 0, 0] }));
    // Strap lugs with split rings on both ends.
    for (const sx of [-1, 1]) {
      b.add(rbox(4, 8, 6, 1.4), chrome, at(sx * 68.6, 22, 0));
      const ring = new THREE.TorusGeometry(4.6, 0.7, 10, 40); ring.rotateY(Math.PI / 2);
      b.add(ring, steel, at(sx * 71.4, 22, 0, [0.5, 0, 0]));
    }
    // Top: an accessory shoe, the frame counter, two screws.
    b.add(rbox(20, 1.6, 19, 0.6), chromeX, at(-6, 42.2, -0.5));
    b.add(rbox(20, 1.4, 2.4, 0.5), chromeX, at(-6, 43.4, 8));
    b.add(rbox(20, 1.4, 2.4, 0.5), chromeX, at(-6, 43.4, -9));
    for (const sx of [-1, 1]) { b.add(sc.head, steel, xf({ p: [-6 + sx * 7, 43.0, -0.5], r: [-Math.PI / 2, 0, 0] })); b.add(sc.slot, ink, xf({ p: [-6 + sx * 7, 43.0, -0.5], r: [-Math.PI / 2, 0, sx] })); }
    b.add(cyl(4.2, 1.2, 48), chrome, at(16, 42, 9));
    b.add(cyl(3.0, 0.4, 32), darkGlass, at(16, 42.8, 9));
    // Back: an eyepiece and a door latch.
    b.add(rbox(16, 10, 5, 2), anod, at(-44, 35, -19.8));
    b.add(rbox(12, 6, 1, 1), darkGlass, at(-44, 35, -22.4));
    b.add(rbox(6, 14, 2, 1), chrome, at(62, -10, -18.4));
    // Bottom: the tripod socket plate.
    b.add(cyl(10, 1.6, 48), chrome, at(0, -43.4, 0));
    b.build(body, 'body');
  }

  await pause();
  // ---- top controls: the shutter speed dial, the release, the advance lever, the rewind knob -------------------
  const speedDial = new THREE.Group(); speedDial.position.set(34, 41.5, -2); body.add(speedDial);
  await pause();
  {
    const d = new Builder();
    d.add(cyl(11, 5.4, 96), chrome, at(0, 2.7, 0));
    for (let k = 0; k < 60; k++) { const a = (k / 60) * Math.PI * 2; d.add(rbox(1.0, 4.2, 0.9, 0.3), chrome, at(Math.cos(a) * 11, 2.7, Math.sin(a) * 11, [0, -a, 0])); }
    d.build(speedDial, 'speedDial');
    const face = new THREE.Mesh(new THREE.CircleGeometry(10.2, 96), new THREE.MeshPhysicalMaterial({ map: dialFace(CW.speeds, '#1c1915', '#c9c3b9', -Math.PI * 0.95, Math.PI * 0.75, 70), metalness: 0.85, roughness: 0.28 }));
    face.rotation.x = -Math.PI / 2; face.position.y = 5.45; face.name = 'speedFace';
    speedDial.add(face);
    const cs = screw(2.2), cb = new Builder();
    cb.add(cs.head, chrome, xf({ p: [0, 5.5, 0], r: [-Math.PI / 2, 0, 0] }));
    cb.add(cs.slot, ink, xf({ p: [0, 5.5, 0], r: [-Math.PI / 2, 0, 0.4] }));
    cb.build(speedDial, 'speedScrew');
  }
  const release = new THREE.Group(); release.position.set(54, 41.5, 4); body.add(release);
  await pause();
  {
    const r = new Builder();
    r.add(cyl(4.4, 2.6, 64), chrome, at(0, 1.3, 0));
    for (let k = 0; k < 4; k++) r.add(new THREE.TorusGeometry(4.45, 0.25, 6, 64).rotateX(Math.PI / 2), chrome, at(0, 0.4 + k * 0.6, 0));
    r.add(cyl(2.6, 2.2, 48), chrome, at(0, 3.6, 0));
    const cup = lathe([[0, 0.4], [1.4, 0.3], [2.2, 0.05], [2.6, 0]].reverse() as P2[], 48);
    r.add(cup, chrome, at(0, 4.7, 0));
    r.build(release, 'release');
  }
  const lever = new THREE.Group(); lever.position.set(54, 41.5, 4); body.add(lever);
  await pause();
  {
    const l = new Builder();
    const arm = new THREE.Shape(); arm.moveTo(-3, -3); arm.quadraticCurveTo(10, -6, 24, -2); arm.lineTo(25, 2.4); arm.quadraticCurveTo(10, 0, -3, 3); arm.closePath();
    const ag = new THREE.ExtrudeGeometry(arm, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2, curveSegments: 16 });
    ag.rotateX(-Math.PI / 2);
    l.add(ag, paint, xf({ p: [0, 6.9, 0], r: [0, 2.25, 0] }));
    l.add(rbox(6, 3.2, 5.6, 1.4), ink, xf({ p: [Math.cos(2.25) * 24.5, 7.5, -Math.sin(2.25) * 24.5], r: [0, 2.25, 0] }));
    l.add(cyl(3.4, 1.0, 48), chrome, at(0, 7.3, 0));
    l.add(cyl(1.4, 0.6, 24), ink, at(0, 7.9, 0));
    l.build(lever, 'lever');
  }
  await pause();
  {
    const k = new Builder();
    k.add(cyl(9, 6, 96), chrome, at(-46, 44.5, -2));
    for (let q = 0; q < 54; q++) { const a = (q / 54) * Math.PI * 2; k.add(rbox(0.9, 4.6, 0.8, 0.3), chrome, at(-46 + Math.cos(a) * 9, 44.5, -2 + Math.sin(a) * 9, [0, -a, 0])); }
    k.add(rbox(14, 1.2, 3.2, 0.6), chromeX, at(-41, 48, -2));
    k.add(cyl(12.4, 0.8, 96), chrome, at(-46, 41.9, -2));
    k.add(cyl(1.6, 4, 24), ink, at(-35, 49.6, -2));
    k.build(body, 'rewind');
    const iso = new THREE.Mesh(new THREE.RingGeometry(9.4, 12.2, 96), new THREE.MeshPhysicalMaterial({ map: dialFace(CW.isos, '#1c1915', '#c3bdb2', -Math.PI * 0.85, Math.PI * 0.35, 54), metalness: 0.85, roughness: 0.3 }));
    iso.rotation.x = -Math.PI / 2; iso.position.set(-46, 42.32, -2); iso.name = 'isoFace';
    body.add(iso);
  }

  await pause();
  // ---- the lens ------------------------------------------------------------------------------------------
  const lens = new THREE.Group();
  lens.position.set(...CAM.LENS);
  lens.position.z = 19.6;
  body.add(lens);
  const blades: THREE.Mesh[] = [];
  const glass: THREE.ShaderMaterial[] = [];
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!; const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, '#ffffff'); r.addColorStop(0.35, '#b8b8b8'); r.addColorStop(1, '#000000'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.62, 0.3), map: glowTex, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  glow.name = 'camGlow';
  const flash = new THREE.MeshBasicMaterial({ color: 0x000000, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  flash.name = 'camFlash';
  await pause();
  {
    const L = new Builder();
    const [a0, a1] = LENS.aperture, [d0, d1] = LENS.dof, [f0, f1] = LENS.focus, [n0, n1] = LENS.front;
    L.add(tube(23, 26.5, 0, LENS.mount), chrome);
    L.add(tube(23, 27, LENS.mount, a0), anod);
    // Aperture ring: ridged, its figures on a band.
    L.add(tube(23, 27.6, a0, a1), anod);
    for (let k = 0; k < 72; k++) { const a = (k / 72) * Math.PI * 2; if (Math.abs(((a / Math.PI) % 2) - 1.5) < 0.22) continue; L.add(rbox(1.1, 1.2, 4.4, 0.4), anod, xf({ p: [Math.cos(a) * 27.8, Math.sin(a) * 27.8, a0 + 2.4], r: [0, 0, a] })); }
    L.add(tube(23, 27.2, d0, d1), anod);
    L.add(tube(23, 29.6, f0, f0 + 4), chrome);
    // Focus grip: rubber ribs round the barrel.
    L.add(tube(23, 29.4, f0 + 4, f1), rubber);
    for (let k = 0; k < 64; k++) { const a = (k / 64) * Math.PI * 2; L.add(rbox(1.6, 1.4, f1 - f0 - 6, 0.6), rubber, xf({ p: [Math.cos(a) * 29.8, Math.sin(a) * 29.8, (f0 + 4 + f1) / 2], r: [0, 0, a] })); }
    L.add(tube(24, 30.6, n0, n1 - 1.2), anod);
    L.add(new THREE.TorusGeometry(30.62, 0.32, 8, 192), chrome, at(0, 0, n0 + 1.2));
    L.add(new THREE.TorusGeometry(30.62, 0.32, 8, 192), chrome, at(0, 0, n1 - 2.2));
    for (let k = 0; k < 7; k++) L.add(new THREE.TorusGeometry(30.6, 0.12, 6, 192), anod, at(0, 0, n0 + 3.4 + k * 1.3));
    L.add(tube(25, 30.6, n1 - 1.2, n1), anod);
    // Filter thread inside the front.
    for (let k = 0; k < 5; k++) L.add(new THREE.TorusGeometry(25.3, 0.32, 6, 96), anod, at(0, 0, n1 - 1.4 - k * 0.9));
    // Inside: matte baffles stepping in toward the iris, so the glass has depth to show.
    for (const [r, z] of [[24.6, 50], [22.8, 46], [21.0, 42], [19.2, 38], [17.4, 35], [16.2, 32.5]] as const) L.add(tube(r - 1.4, r + 0.6, z - 0.8, z), matte);
    L.add(tube(15.6, 25, 22, 31.5), matte);
    // The iris housing.
    L.add(tube(15, 17, LENS.iris - 1, LENS.iris + 1), anod);
    for (const mesh of L.build(lens, 'lens')) if (mesh.material === matte || mesh.material === anod) mesh.userData.noAO = true;
    // Engraved bands: f-numbers on the aperture ring, the depth of field scale, distances on the focus ring.
    const bandMesh = (r: number, z0: number, z1: number, tex: THREE.Texture, metalness = 0.6, rough = 0.4, name = 'band') => {
      const g = new THREE.CylinderGeometry(r, r, z1 - z0, 192, 1, true);
      g.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ map: tex, metalness, roughness: rough }));
      m.position.z = (z0 + z1) / 2;
      m.rotation.z = Math.PI / 2;
      m.name = name;
      lens.add(m);
      return m;
    };
    bandMesh(27.62, a0 + 5, a1 - 0.4, band(CW.apertures, { fg: '#e6dccb', bg: '#141210', arc: 0.42, start: 0.04, size: 46 }), 0.3, 0.45, 'apertureBand');
    bandMesh(27.22, d0 + 0.2, d1 - 0.2, band(['16', '8', '4', '', '4', '8', '16'], { fg: '#d0c4b0', bg: '#141210', arc: 0.2, start: 0.15, size: 34, ticks: true }), 0.3, 0.45, 'dofBand');
    bandMesh(29.62, f0 + 0.3, f0 + 3.7, band([...CW.distances, CW.unit], { fg: '#141210', bg: '#c3beb5', arc: 0.6, start: 0.02, size: 40 }), 0.9, 0.3, 'focusBand');
    // The front ring and its text.
    const front = new THREE.Mesh(new THREE.RingGeometry(25, 30.6, 192, 1), new THREE.MeshPhysicalMaterial({ map: ringText(CW.lens), metalness: 0.4, roughness: 0.42 }));
    front.position.z = n1 + 0.02;
    front.name = 'lensFace';
    lens.add(front);
    // The glass: three elements, each with two coated surfaces at their own curvature and depth.
    const cap = (R: number, r: number, z: number, convex: boolean, tint: [number, number, number], k: number) => {
      const th = Math.asin(Math.min(0.999, r / Math.abs(R)));
      const g = new THREE.SphereGeometry(Math.abs(R), 96, 24, 0, Math.PI * 2, 0, th);
      g.rotateX(convex ? Math.PI / 2 : -Math.PI / 2);
      const sag = Math.abs(R) * (1 - Math.cos(th));
      g.translate(0, 0, convex ? z - Math.abs(R) + sag : z + Math.abs(R) - sag);
      const m = coatedGlass('camCoat', tint, k);
      glass.push(m);
      const mesh = new THREE.Mesh(g, m);
      mesh.renderOrder = 3;
      mesh.name = 'element';
      lens.add(mesh);
    };
    cap(58, LENS.rGlass, 48, true, [0.35, 0.95, 0.45], 1.0);
    cap(140, LENS.rGlass - 0.6, 46.5, false, [0.85, 0.35, 0.9], 0.8);
    cap(40, 21, 39, true, [0.9, 0.55, 0.2], 0.7);
    cap(70, 20, 38, false, [0.4, 0.75, 1.0], 0.55);
    cap(30, 15.5, 32, true, [0.35, 0.95, 0.45], 0.55);
    const L2 = new Builder();
    // The iris: nine blades, each a plate whose inner edge is one side of the opening.
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-16, 0); bladeShape.lineTo(16, 0); bladeShape.quadraticCurveTo(14, 9, 0, 13); bladeShape.quadraticCurveTo(-14, 9, -16, 0);
    const bg = new THREE.ShapeGeometry(bladeShape, 12);
    const bm = new THREE.MeshPhysicalMaterial({ color: 0x3a3438, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide });
    bm.name = 'camBlade';
    // Each blade's inner edge is machined bright, so the blades draw their own crossing lines.
    const edgeG = new THREE.BoxGeometry(31, 0.2, 0.1);
    const em = new THREE.MeshPhysicalMaterial({ color: 0x6e655d, metalness: 1, roughness: 0.36 });
    em.name = 'camBladeEdge';
    for (let k = 0; k < 9; k++) {
      const m = new THREE.Mesh(bg, bm);
      m.userData.noAO = true;
      const edge = new THREE.Mesh(edgeG, em);
      edge.position.set(0, 0.12, 0.12);
      edge.userData.noAO = true;
      m.add(edge);
      m.userData.angle = (k / 9) * Math.PI * 2;
      m.userData.z = LENS.iris + (k % 3) * 0.18;
      m.name = 'blade';
      blades.push(m);
      lens.add(m);
    }
    // Behind the iris: the light that comes through the lens.
    L2.add(new THREE.TorusGeometry(15.4, 0.45, 10, 96), chrome, at(0, 0, LENS.iris + 1.2));
    L2.add(new THREE.TorusGeometry(19.4, 0.35, 10, 96), chrome, at(0, 0, 38.6));
    for (const mesh of L2.build(lens, 'lensInner')) mesh.userData.noAO = true;
    const gl = new THREE.Mesh(new THREE.CircleGeometry(14, 64), glow);
    gl.position.z = LENS.iris - 3;
    gl.name = 'glow';
    lens.add(gl);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(22, 64), flash);
    fl.position.z = 42;
    fl.name = 'flash';
    lens.add(fl);
    const back = new THREE.Mesh(new THREE.CircleGeometry(16, 48), ink);
    back.position.z = LENS.iris - 6;
    lens.add(back);
  }

  await pause();
  // ---- the tripod: a ball head, a hub, three legs with locks and feet, on the floor ---------------------------
  {
    const t = new Builder();
    const base = new THREE.Group(); base.position.y = -43; root.add(base);
    t.add(cyl(13, 5, 64), anod, at(0, -3, 0));
    t.add(cyl(14.5, 1.2, 64), rubber, at(0, -0.4, 0));
    t.add(cyl(5, 8, 32), chrome, at(0, -9, 0));
    t.add(new THREE.SphereGeometry(13, 64, 32), chrome, at(0, -20, 0));
    t.add(lathe([[16, -30], [15.5, -24], [11, -18.5], [9, -18.5]] as P2[], 64), anod);
    t.add(cyl(16, 10, 64), anod, at(0, -35, 0));
    for (const y of [-31.5, -38.5]) t.add(new THREE.TorusGeometry(16.02, 0.3, 8, 96).rotateX(Math.PI / 2), chrome, at(0, y, 0));
    const hs = screw(1.0);
    for (let q = 0; q < 3; q++) { const a = (q / 3) * Math.PI * 2 + 1.2; const p = new THREE.Vector3(Math.cos(a) * 16.05, -35, Math.sin(a) * 16.05); const r = new THREE.Euler(0, -a + Math.PI / 2, 0); t.add(hs.head, steel, xf({ p: [p.x, p.y, p.z], r: [r.x, r.y, r.z] })); t.add(hs.slot, ink, xf({ p: [p.x, p.y, p.z], r: [r.x, r.y, r.z] })); }
    t.add(cyl(3, 9, 24), brass, xf({ p: [-17, -44, 0], r: [0, 0, Math.PI / 2] }));
    t.add(cyl(5, 4, 32), brass, xf({ p: [-22, -44, 0], r: [0, 0, Math.PI / 2] }));
    t.add(cyl(4, 12, 32), anod, xf({ p: [21, -26, 0], r: [0, 0, Math.PI / 2] }));
    t.add(cyl(7, 7, 48), brass, xf({ p: [28, -26, 0], r: [0, 0, Math.PI / 2] }));
    for (let q = 0; q < 24; q++) { const a = (q / 24) * Math.PI * 2; t.add(rbox(4.2, 0.8, 0.8, 0.25), brass, xf({ p: [28, -26 + Math.cos(a) * 7, Math.sin(a) * 7], r: [a, 0, 0] })); }
    // Legs: each from the hub down and out to its foot.
    const hubY = -40, footY = CAM.FLOOR + 43, spread = 92;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + Math.PI / 6;
      const top = new THREE.Vector3(Math.cos(a) * 12, hubY, Math.sin(a) * 12);
      const foot = new THREE.Vector3(Math.cos(a) * spread, footY + 4, Math.sin(a) * spread);
      const dir = foot.clone().sub(top), len = dir.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      const along = (f: number) => top.clone().addScaledVector(dir, f);
      const place = (g: THREE.BufferGeometry, mat: THREE.Material, f: number) => t.add(g, mat, new THREE.Matrix4().compose(along(f), q, new THREE.Vector3(1, 1, 1)));
      place(cyl(4.6, len * 0.52, 32), anod, 0.26);
      place(cyl(3.6, len * 0.5, 32), anod, 0.74);
      place(cyl(5.6, 7, 32), brass, 0.5);
      place(cyl(5.4, len * 0.18, 32), rubber, 0.22);
      for (let r = 0; r < 9; r++) place(new THREE.TorusGeometry(5.4, 0.45, 8, 32).rotateX(Math.PI / 2), rubber, 0.14 + r * 0.019);
      place(cyl(6.2, 1.2, 32), brass, 0.5);
      place(cyl(4.4, 8, 24), anod, 0.04);
      t.add(cyl(5.2, 8, 32, 4), rubber, at(foot.x, footY + 4, foot.z));
    }
    t.build(base, 'tripod');
    // A seamless paper sweep, as a product is shot on: the floor curves up into the wall behind, with no horizon.
    const sweep = (() => {
      const prof: THREE.Vector2[] = [];
      const R = 420, back = -260;
      for (let i = 0; i <= 12; i++) prof.push(new THREE.Vector2(2400 - (i / 12) * (2400 - back), 0));
      for (let i = 1; i <= 32; i++) { const a = (i / 32) * (Math.PI / 2); prof.push(new THREE.Vector2(back - Math.sin(a) * R, R - Math.cos(a) * R)); }
      for (let i = 1; i <= 10; i++) prof.push(new THREE.Vector2(back - R, R + (i / 10) * 4000));
      const nx = 32, pos: number[] = [], idx: number[] = [];
      for (let i = 0; i <= nx; i++) for (const p of prof) pos.push(-8000 + (i / nx) * 16000, p.y, p.x);
      const n = prof.length;
      for (let i = 0; i < nx; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b = (i + 1) * n + j; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    })();
    const fb = new Builder();
    fb.add(sweep, floor, at(0, CAM.FLOOR, 0));
    for (const m of fb.build(root, 'floor')) m.userData.noWire = true;
  }

  root.updateMatrixWorld(true);
  const centre = new THREE.Vector3(0, -20, 0);
  const lensFront = new THREE.Vector3(0, 0, LENS.front[1]);
  lens.localToWorld(lensFront);
  root.worldToLocal(lensFront);
  return { root, body, lens, blades, glass, glow, flash, speedDial, release, lever, centre, lensFront };
}

export const IRIS = { open: 9.5, closed: 4.2 } as const;

// Sets the iris to an opening of radius a (mm): each blade's inner edge lies a from the axis.
export function setIris(blades: THREE.Mesh[], a: number): void {
  for (const m of blades) {
    const t = m.userData.angle as number;
    m.position.set(Math.cos(t) * a, Math.sin(t) * a, m.userData.z as number);
    m.rotation.set(0, 0, t - Math.PI / 2);
  }
}
