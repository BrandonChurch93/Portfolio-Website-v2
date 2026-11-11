// The hero city: a floating round city of the future around one central spire, built in millimetres.
// Park level is y = 0 in the city's own space. Terraces step up toward the spire. Light-water runs from a moat at the
// spire down five canals, over the rim, onto the slab and along the slab's grid.
import * as THREE from 'three';
import { PartBuilder, cyl, rbox, torus, at, xf } from '../src/world/kit/geometry';
import { seeded } from '../src/world/kit/rng';

export const NOVA = { haze: 0, waterK: 1.35, R: 456, LIFT: 200, SEAT: 50, T: 10, BE: 5.6, TEXT_AT: 4.5 };
const TAU = Math.PI * 2, D2R = Math.PI / 180;
const L0 = 0, L1 = 16, L2 = 32, L3 = 50, R0 = NOVA.R;
const pol = (r: number, deg: number): [number, number] => [r * Math.sin(deg * D2R), r * Math.cos(deg * D2R)];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sm = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const P = (o: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(o);
/** A turned shape round the y axis, from [radius, y] points listed bottom, outside, top. */
const lathe = (pts: [number, number][], seg = 40) => new THREE.LatheGeometry(pts.map(([q, y]) => new THREE.Vector2(q, y)), seg);

function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// ---- shapes ------------------------------------------------------------------------------------------------------
type Sec = { y: number; rx: number; rz: number; n?: number; ox?: number; oz?: number; rot?: number };
function secPoint(s: Sec, k: number, grow: number): [number, number] {
  const a = k * TAU, e = 2 / (s.n ?? 2), c = Math.cos(a), sn = Math.sin(a);
  const x = (s.rx + grow) * Math.sign(c) * Math.abs(c) ** e, z = (s.rz + grow) * Math.sign(sn) * Math.abs(sn) ** e, r = s.rot ?? 0;
  return [x * Math.cos(r) - z * Math.sin(r) + (s.ox ?? 0), x * Math.sin(r) + z * Math.cos(r) + (s.oz ?? 0)];
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function interp(secs: Sec[], y: number): Sec {
  let j = 0; while (j < secs.length - 2 && secs[j + 1]!.y < y) j++;
  const a = secs[j]!, b = secs[j + 1]!, t = clamp01((y - a.y) / (b.y - a.y || 1));
  return { y, rx: mix(a.rx, b.rx, t), rz: mix(a.rz, b.rz, t), n: mix(a.n ?? 2, b.n ?? 2, t), ox: mix(a.ox ?? 0, b.ox ?? 0, t), oz: mix(a.oz ?? 0, b.oz ?? 0, t), rot: mix(a.rot ?? 0, b.rot ?? 0, t) };
}
function densify(secs: Sec[], step: number): Sec[] {
  const out: Sec[] = [], y0 = secs[0]!.y, y1 = secs[secs.length - 1]!.y, n = Math.max(1, Math.ceil((y1 - y0) / step));
  for (let i = 0; i <= n; i++) out.push(interp(secs, y0 + ((y1 - y0) * i) / n));
  return out;
}
/** A skin stretched over a stack of cross sections. */
function loft(secs: Sec[], seg: number, o: { grow?: number; cap?: boolean; capB?: boolean; uRep?: number; vMM?: number } = {}): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], g = o.grow ?? 0, y0 = secs[0]!.y, W = seg + 1;
  for (const s of secs) for (let i = 0; i <= seg; i++) { const [x, z] = secPoint(s, i / seg, g); pos.push(x, s.y, z); uv.push((i / seg) * (o.uRep ?? 1), (s.y - y0) / (o.vMM ?? 1)); }
  for (let j = 0; j < secs.length - 1; j++) for (let i = 0; i < seg; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
  const cap = (s: Sec, up: boolean) => {
    const c0 = pos.length / 3; pos.push(s.ox ?? 0, s.y, s.oz ?? 0); uv.push(0, 0);
    for (let i = 0; i <= seg; i++) { const [x, z] = secPoint(s, i / seg, g); pos.push(x, s.y, z); uv.push(0, 0); }
    for (let i = 0; i < seg; i++) up ? idx.push(c0, c0 + 2 + i, c0 + 1 + i) : idx.push(c0, c0 + 1 + i, c0 + 2 + i);
  };
  if (o.cap) cap(secs[secs.length - 1]!, true);
  if (o.capB) cap(secs[0]!, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  geo.computeVertexNormals();
  const nrm = geo.getAttribute('normal');
  for (let j = 0; j < secs.length; j++) { const a = j * W, b = a + seg, x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b), l = Math.hypot(x, y, z) || 1; nrm.setXYZ(a, x / l, y / l, z / l); nrm.setXYZ(b, x / l, y / l, z / l); }
  return geo;
}
/** A flat fin running up a skin at one place round it. */
function fin(secs: Sec[], k: number, depth: number, width: number, grow0 = 0.1): THREE.BufferGeometry {
  const pts: number[][] = [];
  for (const s of secs) {
    const [x, z] = secPoint(s, k, grow0), [x2, z2] = secPoint(s, k, grow0 + depth);
    const dx = x2 - x, dz = z2 - z, l = Math.hypot(dx, dz) || 1, tx = (-dz / l) * width * 0.5, tz = (dx / l) * width * 0.5;
    pts.push([x - tx, z - tz, x + tx, z + tz, x2 + tx, z2 + tz, x2 - tx, z2 - tz, s.y]);
  }
  const pos: number[] = [];
  const quad = (a: number[], b: number[], i: number, j: number) => { const ya = a[8]!, yb = b[8]!; pos.push(a[i]!, ya, a[i + 1]!, a[j]!, ya, a[j + 1]!, b[i]!, yb, b[i + 1]!, a[j]!, ya, a[j + 1]!, b[j]!, yb, b[j + 1]!, b[i]!, yb, b[i + 1]!); };
  for (let j = 0; j < pts.length - 1; j++) { const a = pts[j]!, b = pts[j + 1]!; quad(a, b, 0, 6); quad(a, b, 6, 4); quad(a, b, 4, 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  return geo;
}
/** A thin plate standing in the radial plane, between an inner and an outer edge given as [r, y] pairs. */
function blade(inner: [number, number][], outer: [number, number][], t: number): THREE.BufferGeometry {
  const pos: number[] = [], h = t / 2;
  const tri = (a: number[], b: number[], c: number[]) => pos.push(...a, ...b, ...c);
  for (let i = 0; i < inner.length - 1; i++) {
    const a = inner[i]!, b = outer[i]!, c = inner[i + 1]!, d = outer[i + 1]!;
    for (const z of [h, -h]) { tri([a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z]); tri([b[0], b[1], z], [d[0], d[1], z], [c[0], c[1], z]); }
    tri([b[0], b[1], h], [b[0], b[1], -h], [d[0], d[1], h]); tri([b[0], b[1], -h], [d[0], d[1], -h], [d[0], d[1], h]);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  return geo;
}
/** A flat piece of a ring. u runs along the arc in mm, v across it (in mm, or 0 to 1). */
function ringStrip(r0: number, r1: number, y: number, a0 = 0, a1 = 360, vNorm = false): THREE.BufferGeometry {
  const span = (a1 - a0) * D2R, n = Math.max(3, Math.ceil((Math.abs(span) * Math.max(r0, r1)) / 6)), pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [], rm = (r0 + r1) / 2;
  for (let i = 0; i <= n; i++) { const a = a0 * D2R + (span * i) / n, s = Math.sin(a), c = Math.cos(a); pos.push(r0 * s, y, r0 * c, r1 * s, y, r1 * c); uv.push(a * rm, 0, a * rm, vNorm ? 1 : r1 - r0); nor.push(0, 1, 0, 0, 1, 0); }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setIndex(idx);
  return geo;
}
/** A piece of a round wall facing outward. */
function wall(r: number, y0: number, y1: number, a0 = 0, a1 = 360): THREE.BufferGeometry {
  const span = (a1 - a0) * D2R, n = Math.max(3, Math.ceil((Math.abs(span) * r) / 6)), pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 * D2R + (span * i) / n, s = Math.sin(a), c = Math.cos(a); pos.push(r * s, y0, r * c, r * s, y1, r * c); uv.push(a * r, 0, a * r, y1 - y0); }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

// ---- pictures painted for the model ------------------------------------------------------------------------------
/** Lit rooms behind glass: 16 bays by 24 floors. Whole floors share a mood, so it never reads as a checkerboard. */
function roomsTex(seed: number, warmth = 0.5): THREE.CanvasTexture {
  const r = seeded(seed), CW = 24, CH = 40, COLS = 16, ROWS = 24;
  const tones: [number, number, number][] = [[255, 238, 208], [255, 214, 160], [255, 186, 118], [246, 240, 228]];
  return tex(CW * COLS, CH * ROWS, (g) => {
    g.fillStyle = '#050403'; g.fillRect(0, 0, CW * COLS, CH * ROWS);
    for (let j = 0; j < ROWS; j++) {
      const q = r(), mood = q < 0.13 ? 0 : q < 0.6 ? 1 : 2, fb = 0.5 + r() * 0.5, ft = tones[r() < warmth ? 1 + Math.floor(r() * 2) : r() < 0.8 ? 0 : 3]!;
      for (let i = 0; i < COLS; i++) {
        let lit = mood === 0 ? r() < 0.07 : mood === 1 ? r() > 0.1 : r() < 0.52, b = fb, t = ft;
        if (mood !== 1) { b = 0.3 + r() * 0.7; t = tones[Math.floor(r() * 4)]!; } else b = fb * (0.88 + r() * 0.2);
        if (!lit) { if (r() < 0.35) { g.fillStyle = 'rgba(255,200,140,0.045)'; g.fillRect(i * CW + 1, j * CH + 2, CW - 2, CH - 4); } continue; }
        const x = i * CW + 1, y = j * CH + 2, w = CW - 2, h = CH - 4;
        const gr = g.createLinearGradient(0, y, 0, y + h), c = (k: number) => `rgb(${Math.round(t[0] * b * k)},${Math.round(t[1] * b * k)},${Math.round(t[2] * b * k)})`;
        gr.addColorStop(0, c(1)); gr.addColorStop(0.2, c(0.86)); gr.addColorStop(0.62, c(0.58)); gr.addColorStop(1, c(0.3));
        g.fillStyle = gr; g.fillRect(x, y, w, h);
        if (b > 0.55) { g.fillStyle = c(1.25); g.fillRect(x + 2, y + 1, w - 4, 2); }
        const blind = r();
        if (blind < 0.16) { g.fillStyle = c(0.5); g.fillRect(x, y, w, h * (0.3 + r() * 0.5)); }
        if (r() < 0.3) { g.fillStyle = 'rgba(8,6,5,0.6)'; g.fillRect(x + Math.floor(r() * (w - 8)), y + h - 9 - Math.floor(r() * 6), 6 + Math.floor(r() * 6), 14); }
        if (r() < 0.2) { g.fillStyle = 'rgba(8,6,5,0.85)'; g.fillRect(x + w - 1, y, 2, h); }
      }
    }
  });
}
function paving(a: string, b: string, line: string): THREE.CanvasTexture {
  const r = seeded(41);
  return tex(256, 256, (g) => {
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { g.fillStyle = r() < 0.5 ? a : b; g.globalAlpha = 0.8 + r() * 0.2; g.fillRect(i * 32 + (j % 2) * 16, j * 32, 32, 32); if (j % 2 && i === 7) g.fillRect(0, j * 32, 16, 32); }
    g.globalAlpha = 1; g.strokeStyle = line; g.lineWidth = 1.5;
    for (let j = 0; j <= 8; j++) { g.beginPath(); g.moveTo(0, j * 32); g.lineTo(256, j * 32); g.stroke(); for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32 + (j % 2) * 16, j * 32); g.lineTo(i * 32 + (j % 2) * 16, j * 32 + 32); g.stroke(); } }
  });
}
function roadTex(): THREE.CanvasTexture {
  return tex(256, 512, (g) => {
    g.fillStyle = '#231b15'; g.fillRect(0, 0, 256, 512);
    const r = seeded(9); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,230,200,${0.02 + r() * 0.03})`; g.fillRect(r() * 256, r() * 512, 2, 2); }
    g.fillStyle = '#e9b266'; g.fillRect(0, 251, 256, 3); g.fillRect(0, 258, 256, 3);
    g.fillStyle = '#d9c9ae'; for (const y of [128, 384]) g.fillRect(0, y - 2, 128, 4);
    g.fillStyle = '#c59a57'; g.fillRect(0, 12, 256, 4); g.fillRect(0, 496, 256, 4);
  });
}
function lawnTex(): THREE.CanvasTexture {
  const r = seeded(77);
  return tex(512, 512, (g) => {
    g.fillStyle = '#5e4420'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) { const x = r() * 512, y = r() * 512, s = 6 + r() * 22; g.fillStyle = [`rgba(190,146,66,0.12)`, `rgba(60,42,18,0.16)`, `rgba(214,178,104,0.08)`][Math.floor(r() * 3)]!; g.beginPath(); g.ellipse(x, y, s, s * (0.5 + r() * 0.5), r() * 3, 0, TAU); g.fill(); }
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(255,214,130,${0.05 + r() * 0.1})`; g.fillRect(r() * 512, r() * 512, 1, 2 + r() * 2); }
  });
}
function softDot(): THREE.CanvasTexture {
  const t = tex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, '#9b9b9b'); gr.addColorStop(0.6, '#2a2a2a'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

type Ctx = { scene: THREE.Scene; G: THREE.Group; noAO: THREE.Object3D[] };
type Rise = { g: THREE.Object3D; h: number; t0: number; d: number; lit: THREE.MeshStandardMaterial[]; lightAt: number };
type Water = { geo: THREE.BufferGeometry; s: Float32Array; lane: Float32Array; env: Float32Array; kind: 'canal' | 'fall'; k: number };

export function buildNova(ctx: Ctx) {
  const r = seeded(20261110);
  const world = new THREE.Group(); ctx.G.add(world);
  const city = new THREE.Group(); city.position.y = NOVA.LIFT; world.add(city);
  const pb = new PartBuilder('nova');
  city.add(pb.root);
  const rises: Rise[] = [], movers: THREE.Object3D[] = [], glows: THREE.Object3D[] = [], bulbs: THREE.Material[] = [], waters: Water[] = [];
  const AMBER = new THREE.Color(0xff9a38);

  // ---- materials: ivory, brass, bronze, dark glass, gold park --------------------------------------------------------
  const ivory = P({ color: 0xe9e0d1, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
  const ivoryStone = P({ color: 0xcfc3b0, roughness: 0.7 });
  const brass = P({ color: 0xd0a45a, metalness: 1, roughness: 0.26, side: THREE.DoubleSide });
  const bronze = P({ color: 0x8a5c33, metalness: 1, roughness: 0.4, side: THREE.DoubleSide });
  const mull = P({ color: 0x30241a, metalness: 0.9, roughness: 0.42, side: THREE.DoubleSide });
  const glass = P({ color: 0x000000, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 3.2 });
  const plazaM = P({ color: 0xffffff, map: paving('#d9cbb4', '#cdbfa6', '#a8997f'), roughness: 0.62 });
  const terraceM = P({ color: 0xffffff, map: paving('#b79f7d', '#ad9572', '#8a7557'), roughness: 0.66 });
  const promM = P({ color: 0xffffff, map: paving('#c9b592', '#bfa983', '#94805f'), roughness: 0.6 });
  for (const m of [plazaM, terraceM, promM]) m.map!.repeat.set(1 / 28, 1 / 28);
  const roadM = P({ color: 0xffffff, map: roadTex(), roughness: 0.55 }); roadM.map!.repeat.set(1 / 26, 1);
  const lawnM = P({ color: 0xffffff, map: lawnTex(), roughness: 0.92 }); lawnM.map!.repeat.set(1 / 150, 1 / 150);
  const leaf = [P({ color: 0xc79a45, roughness: 0.74 }), P({ color: 0x8e5a24, roughness: 0.8 }), P({ color: 0xdcc27e, roughness: 0.72 }), P({ color: 0x6b4219, roughness: 0.82 }), P({ color: 0xb07a34, roughness: 0.76 })];
  const trunkM = P({ color: 0x3a2a1c, roughness: 0.8 });
  const bulbM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(4.5) }); bulbs.push(bulbM);
  const beaconM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a3a).multiplyScalar(7) }); bulbs.push(beaconM);
  const warmGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc988).multiplyScalar(2.4) }); bulbs.push(warmGlow);
  const rooms = (seed: number, warmth = 0.5, k = 1.75) => { const m = new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 0.7, emissive: 0xffffff, emissiveMap: roomsTex(seed, warmth), emissiveIntensity: k * 1.5 }); m.userData.k = k * 1.5; return m; };
  const dot = softDot();

  const riser = (name: string, h: number, t0: number, d = 1.0): Rise => { const g = pb.group(name); const o: Rise = { g, h, t0, d, lit: [], lightAt: t0 + d + 0.05 }; rises.push(o); return o; };
  const A = (geo: THREE.BufferGeometry, m: THREE.Material, mtx: THREE.Matrix4 | undefined, to: THREE.Object3D, uv: 'box' | 'keep' = 'box', shadow = true) => pb.add(geo, m, mtx, { to, uv, shadow });

  /** A curtain wall over a stack of sections: lit rooms set back, glass over them, fine dark mullions, then belts and ribs. */
  const facade = (R: Rise, M: THREE.Matrix4, secsIn: Sec[], o: { floor?: number; bays: number; frame: THREE.Material; rooms: THREE.MeshStandardMaterial; belt?: number; ribs?: number; ribDepth?: number; seg?: number; plate?: number; finEvery?: number; finDepth?: number }) => {
    const secs = densify(secsIn, 12), seg = o.seg ?? 48, floor = o.floor ?? 12, yA = secs[0]!.y, yB = secs[secs.length - 1]!.y, floors = Math.max(1, Math.round((yB - yA) / floor)), belt = o.belt ?? 4;
    A(loft(secs, seg, { grow: -1.7, cap: true, uRep: o.bays / 16, vMM: floor * 24 }), o.rooms, M, R.g, 'keep');
    A(loft(secs, seg, { cap: true }), glass, M, R.g, 'keep', false);
    for (let f = 0; f <= floors; f++) {
      const y = yA + ((yB - yA) * f) / floors, s = interp(secs, y), big = f === 0 || f === floors || f % belt === 0;
      if (big) A(loft([{ ...s, y: y - 1.3 }, { ...s, y: y + 1.3 }], seg, { grow: o.plate ?? 1.5, cap: true, capB: true }), o.frame, M, R.g);
      else A(loft([{ ...s, y: y - 0.32 }, { ...s, y: y + 0.32 }], seg, { grow: 0.45 }), mull, M, R.g);
    }
    for (let k = 0; k < o.bays; k++) A(fin(secs, k / o.bays, 0.8, 0.5), mull, M, R.g);
    const K = o.ribs ?? Math.round(o.bays / 8);
    for (let k = 0; k < K; k++) A(fin(secs, (k + 0.5) / K, o.ribDepth ?? 2.6, 1.3), o.frame, M, R.g);
    if (!R.lit.includes(o.rooms)) R.lit.push(o.rooms);
  };
  const tree = (to: THREE.Object3D, x: number, y: number, z: number, s = 1) => {
    const m = leaf[Math.floor(r() * leaf.length)]!;
    if (r() < 0.3) { const h = (17 + r() * 9) * s; A(cyl(0.6 * s, 4 * s, 'y', 6), trunkM, at(x, y + 2 * s, z), to); A(new THREE.IcosahedronGeometry(1, 2), m, xf({ p: [x, y + 3 * s + h / 2, z], s: [2.7 * s, h / 2, 2.7 * s] }), to, 'keep'); return; }
    const h = (7 + r() * 5) * s;
    A(cyl(0.7 * s, h, 'y', 6), trunkM, at(x, y + h / 2, z), to);
    const n = 4 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) { const q = (3.4 + r() * 2.2) * s, a = r() * TAU, d = i ? (2.2 + r() * 2.6) * s : 0; A(new THREE.IcosahedronGeometry(1, 1), r() < 0.7 ? m : leaf[Math.floor(r() * leaf.length)]!, xf({ p: [x + Math.cos(a) * d, y + h + q * 0.3 + r() * 3.4 * s, z + Math.sin(a) * d], r: [r() * 3, r() * 3, r() * 3], s: [q, q * (0.78 + r() * 0.2), q] }), to, 'keep'); }
  };
  const lampPost = (to: THREE.Object3D, x: number, y: number, z: number, h = 15) => { A(cyl(0.45, h, 'y', 6), bronze, at(x, y + h / 2, z), to); A(new THREE.SphereGeometry(1.25, 10, 8), bulbM, at(x, y + h + 0.9, z), to, 'keep', false); };
  const person = (to: THREE.Object3D, x: number, y: number, z: number, m: THREE.Material, sit = false) => { A(new THREE.CapsuleGeometry(1.45, sit ? 3 : 6, 3, 8), m, at(x, y + (sit ? 3 : 4.5), z), to, 'keep'); A(new THREE.SphereGeometry(1.5, 10, 8), m, at(x, y + (sit ? 7.4 : 10.3), z), to, 'keep'); };
  const cloth = [P({ color: 0xefe6d6, roughness: 0.7 }), P({ color: 0xc9a56c, roughness: 0.7 }), P({ color: 0x6d4a2c, roughness: 0.7 }), P({ color: 0x2b211a, roughness: 0.7 }), P({ color: 0xd98a3c, roughness: 0.7 })];

  const park = riser('park', 40, 0.9, 1.0).g, folk = riser('folk', 14, 3.3, 0.5).g;
  const warmHall = (k: number) => { const m = new THREE.MeshStandardMaterial({ color: 0x140d08, roughness: 0.8, emissive: 0xffc27a, emissiveIntensity: k }); m.userData.k = k; return m; };

  // ---- the disc and its terraces -----------------------------------------------------------------------------------
  const base = pb.group('base');
  A(ringStrip(0, 104, L3), plazaM, undefined, base, 'keep');
  A(ringStrip(102, 234, L2), terraceM, undefined, base, 'keep');
  A(ringStrip(232, 292, L1, 0, 360, true), roadM, undefined, base, 'keep');
  A(ringStrip(290, R0 - 40, L0), lawnM, undefined, base, 'box');
  A(ringStrip(R0 - 42, R0 - 8, L0 + 0.3), promM, undefined, base, 'keep');
  for (const [rr, y0, y1] of [[102, L2, L3], [232, L1, L2], [292, L0, L1]] as [number, number, number][]) { A(wall(rr, y0, y1 + 0.2), ivoryStone, undefined, base); A(ringStrip(rr - 2.2, rr + 0.6, y1 + 0.5), ivory, undefined, base); }
  A(lathe([[0, -50], [R0 - 4, -50], [R0 + 2.5, -44], [R0 + 2.5, -15], [R0 + 0.5, -14], [R0 + 0.5, -11], [R0 + 2.5, -10], [R0 + 2.5, 1.5], [R0 + 1, 3.4], [R0 - 8, 3.4], [R0 - 8, 0.3]], 160), bronze, undefined, base);
  A(ringStrip(R0 - 8.5, R0 + 2, 3.6), brass, undefined, base);
  { const seam = new THREE.Mesh(wall(R0 + 1.2, -13.6, -11.4), new THREE.MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(3.2) })); city.add(seam); glows.push(seam); bulbs.push(seam.material as THREE.Material); }
  for (let a = 0; a < 360; a += 3) { const [x, z] = pol(R0 + 3, a); A(rbox(1.2, a % 15 === 0 ? 16 : 8, 0.8, 0.2), brass, xf({ p: [x, -30, z], r: [0, a * D2R, 0] }), base); }
  // rails along the terrace edges and the rim
  for (const [rr, y] of [[R0 - 11, L0 + 0.3], [290, L1], [230, L2], [100, L3]] as [number, number][]) { A(torus(rr, 0.35, 6, 200), brass, xf({ p: [0, y + 5.2, 0], r: [Math.PI / 2, 0, 0] }), base, 'keep'); for (let a = 0; a < 360; a += 360 / Math.round(rr / 2.2)) { const [x, z] = pol(rr, a); A(cyl(0.3, 5.2, 'y', 5), brass, at(x, y + 2.6, z), base); } }

  // ---- light-water ------------------------------------------------------------------------------------------------
  const waterMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const fallMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const strip = (rows: { c: THREE.Vector3; side: THREE.Vector3; w: number; s: number; env: number }[], across: number, kind: 'canal' | 'fall', k: number, parent: THREE.Object3D) => {
    const pos: number[] = [], sA: number[] = [], lA: number[] = [], eA: number[] = [], idx: number[] = [];
    rows.forEach((row) => { for (let i = 0; i <= across; i++) { const f = i / across - 0.5; pos.push(row.c.x + row.side.x * row.w * f, row.c.y + row.side.y * row.w * f, row.c.z + row.side.z * row.w * f); sA.push(row.s); lA.push(i); eA.push(row.env); } });
    const W = across + 1; for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < across; i++) { const a = j * W + i; idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, kind === 'fall' ? fallMat : waterMat); mesh.frustumCulled = false; parent.add(mesh); glows.push(mesh); if (kind === 'fall') ctx.noAO.push(mesh);
    waters.push({ geo, s: new Float32Array(sA), lane: new Float32Array(lA), env: new Float32Array(eA), kind, k });
    if (kind === 'canal') {
      const p2: number[] = [], s2: number[] = [], l2: number[] = [], e2: number[] = [], i2: number[] = [];
      rows.forEach((row) => { for (let i = 0; i <= 2; i++) { const f = (i - 1) * 2.1; p2.push(row.c.x + row.side.x * row.w * f, row.c.y + 0.9 + row.side.y * row.w * f, row.c.z + row.side.z * row.w * f); s2.push(row.s); l2.push(i * 3); e2.push(i === 1 ? row.env * 0.42 : 0); } });
      for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < 2; i++) { const a = j * 3 + i; i2.push(a, a + 3, a + 1, a + 1, a + 3, a + 4); }
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3)); g2.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(p2.length), 3)); g2.setIndex(i2);
      const spill = new THREE.Mesh(g2, fallMat); spill.frustumCulled = false; parent.add(spill); glows.push(spill); ctx.noAO.push(spill);
      waters.push({ geo: g2, s: new Float32Array(s2), lane: new Float32Array(l2), env: new Float32Array(e2), kind: 'canal', k });
    }
    return mesh;
  };
  const CANALS = [0, 72, -72, 144, -144];
  const impacts: [number, number][] = [];
  CANALS.forEach((deg, ci) => {
    const grp = new THREE.Group(); grp.rotation.y = deg * D2R; city.add(grp);
    const main = ci === 0, w = main ? 20 : 13, X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
    const rows: { c: THREE.Vector3; side: THREE.Vector3; w: number; s: number; env: number }[] = [];
    let s = 0;
    const run = (r0: number, r1: number, y: number) => { for (let q = r0; q <= r1 + 0.01; q += 5) { rows.push({ c: new THREE.Vector3(0, y + 0.7, q), side: X, w, s: s + (q - r0), env: 1 }); } s += r1 - r0; };
    const drop = (rr: number, y0: number, y1: number) => { for (let i = 1; i <= 4; i++) { rows.push({ c: new THREE.Vector3(0, mix(y0, y1, i / 4) + 0.7, rr + 0.9 + i * 0.25), side: X, w, s: s + (i * (y0 - y1)) / 4, env: 1.5 }); } s += y0 - y1; };
    run(90, 102, L3); drop(102, L3, L2); run(104, 229, L2);
    strip(rows, 4, 'canal', ci, grp);
    const rows2: typeof rows = []; s += 62;
    const run2 = (r0: number, r1: number, y: number) => { for (let q = r0; q <= r1 + 0.01; q += 5) rows2.push({ c: new THREE.Vector3(0, y + 0.7, q), side: X, w, s: s + (q - r0), env: 1 }); s += r1 - r0; };
    rows2.push({ c: new THREE.Vector3(0, L1 - 5, 292.4), side: X, w, s, env: 1.5 }); rows2.push({ c: new THREE.Vector3(0, L0 + 0.7, 294), side: X, w, s: s + 11, env: 1.5 }); s += 11;
    run2(295, R0 + 3, L0);
    strip(rows2, 4, 'canal', ci, grp);
    // the fall off the rim, two sheets
    for (const layer of [0, 1, 2]) {
      const fr: typeof rows = [];
      for (let j = 0; j <= 30; j++) { const d = (j / 30) * (NOVA.LIFT - 1), tau = Math.sqrt(d / NOVA.LIFT); fr.push({ c: new THREE.Vector3(0, 0.6 - d, R0 + 5 + (main ? 30 : 20) * tau + layer * 2.5), side: X, w: (w - 2 + layer * 6) * (1 + 0.4 * tau), s: s + tau * 170 + layer * 37, env: [1.5, 0.8, 0.35][layer]! * (1 - 0.66 * tau) }); }
      strip(fr, 8, 'fall', ci, grp);
    }
    // channel walls, a walk on each side, trees, lamps, steps
    const M = xf({ r: [0, deg * D2R, 0] });
    for (const sx of [-1, 1]) {
      for (const [r0, r1, y] of [[90, 102, L3], [104, 230, L2], [294, R0 + 2, L0]] as [number, number, number][]) A(rbox(1.6, 2.2, r1 - r0, 0.3), ivory, xf({ p: [sx * (w / 2 + 0.8), y + 1.1, (r0 + r1) / 2] }).premultiply(M), base);
      A(rbox(main ? 16 : 9, 0.5, R0 - 336, 0.1), promM, xf({ p: [sx * (w / 2 + (main ? 11 : 7)), L0 + 0.25, (294 + R0 - 42) / 2] }).premultiply(M), base);
      A(rbox(9, 0.5, 120, 0.1), plazaM, xf({ p: [sx * (w / 2 + 7), L2 + 0.25, 166] }).premultiply(M), base);
      for (let q = 306; q < R0 - 50; q += main ? 17 : 24) { const v = new THREE.Vector3(sx * (w / 2 + (main ? 24 : 16)), 0, q).applyMatrix4(M); tree(park, v.x, L0, v.z, main ? 1.05 : 0.9); if (main) { const v2 = new THREE.Vector3(sx * (w / 2 + 40), 0, q + 8).applyMatrix4(M); tree(park, v2.x, L0, v2.z, 1.2); } }
      for (let q = 300; q < R0 - 40; q += 30) { const v = new THREE.Vector3(sx * (w / 2 + 3.5), 0, q).applyMatrix4(M); lampPost(base, v.x, L0, v.z, 11); }
      for (let q = 118; q < 220; q += 26) { const v = new THREE.Vector3(sx * (w / 2 + 13), 0, q).applyMatrix4(M); tree(park, v.x, L2, v.z, 0.8); }
      // steps beside the cascades
      for (const [rr, y0, y1] of [[102, L2, L3], [292, L0, L1]] as [number, number, number][]) for (let i = 0; i < 6; i++) A(rbox(11, (y1 - y0) * (1 - i / 6), 2.4, 0.1), ivoryStone, xf({ p: [sx * (w / 2 + 8), y0 + ((y1 - y0) * (1 - i / 6)) / 2, rr + 1.2 + i * 2.4] }).premultiply(M), base);
    }
    // the spout at the rim
    A(rbox(w + 7, 3, 10, 0.6), ivory, xf({ p: [0, -1.2, R0 + 1] }).premultiply(M), base);
    for (const sx of [-1, 1]) A(rbox(2.4, 7, 12, 0.6), brass, xf({ p: [sx * (w / 2 + 2.4), 1.4, R0 + 1] }).premultiply(M), base);
    // bridges where the boulevard and the walks cross
    const [ix, iz] = pol(NOVA.R + (main ? 34 : 25), deg); impacts.push([ix, iz]);
  });
  // the moat round the spire
  { const rows: { c: THREE.Vector3; side: THREE.Vector3; w: number; s: number; env: number }[] = []; for (let a = 0; a <= 360; a += 2.5) { const [x, z] = pol(84, a); rows.push({ c: new THREE.Vector3(x, L3 + 0.7, z), side: new THREE.Vector3(Math.sin(a * D2R), 0, Math.cos(a * D2R)), w: 12, s: -8 + 4 * Math.cos(a * D2R * 5), env: 1.1 }); } strip(rows, 2, 'canal', 9, city); }
  A(ringStrip(76.5, 78, L3 + 2), ivory, undefined, base); A(wall(78, L3, L3 + 2), ivory, undefined, base); A(ringStrip(90, 91.5, L3 + 2), ivory, undefined, base); A(wall(91.5, L3, L3 + 2), ivory, undefined, base);

  // ---- the spire ---------------------------------------------------------------------------------------------------
  {
    const R = riser('spire', 440, 2.2, 1.7), y0 = L3, shaft = (y: number) => 22 - 9 * sm(0, 300, y) - 2.5 * sm(250, 320, y);
    const secs: Sec[] = []; for (let y = 0; y <= 312; y += 12) secs.push({ y: y0 + y, rx: shaft(y), rz: shaft(y) });
    facade(R, new THREE.Matrix4(), secs, { floor: 12, bays: 32, finEvery: 2, frame: brass, rooms: rooms(11, 0.35, 2.7), ribDepth: 2.8, plate: 1.4, seg: 64, belt: 5 });
    // five swept blades hold it, standing between the canals
    for (const deg of [36, -36, 108, -108, 180]) {
      const inner: [number, number][] = [], outer: [number, number][] = [];
      for (let i = 0; i <= 26; i++) { const t = i / 26, y = t * 236, ro = (1 - t) * (1 - t) * 71 + 2 * (1 - t) * t * 25 + t * t * (shaft(236) + 1); inner.push([Math.max(shaft(y) + 0.4, ro - 5.5 * (1 - 0.5 * t)), y0 + y]); outer.push([ro + 2.2 * (1 - t), y0 + y]); }
      A(blade(inner, outer, 2.6), ivory, xf({ r: [0, (deg - 90) * D2R, 0] }), R.g);
      const edge: [number, number][] = outer.map(([q, y]) => [q + 0.5, y]);
      A(blade(outer, edge, 3.2), brass, xf({ r: [0, (deg - 90) * D2R, 0] }), R.g);
    }
    // a low glass rotunda at its foot
    const rot = rooms(12, 0.7, 2.4); facade(R, new THREE.Matrix4(), [{ y: y0, rx: 44, rz: 44 }, { y: y0 + 20, rx: 41, rz: 41 }], { floor: 10, bays: 48, finEvery: 2, frame: ivory, rooms: rot, plate: 2.6, seg: 72 });
    A(lathe([[41, y0 + 20], [47, y0 + 21], [47, y0 + 22.5], [30, y0 + 27], [22, y0 + 27]], 72), ivory, undefined, R.g);
    // the lantern: a lens of glass near the top, with a ring deck under it
    const lens: Sec[] = []; for (let i = 0; i <= 10; i++) { const t = i / 10, q = 11 + 23 * Math.sin(Math.PI * (0.08 + 0.84 * t)) ** 0.8; lens.push({ y: y0 + 312 + t * 36, rx: q, rz: q }); }
    const lensM = rooms(13, 0.2, 3.0); facade(R, new THREE.Matrix4(), lens, { floor: 9, bays: 48, finEvery: 3, frame: brass, rooms: lensM, plate: 0.7, finDepth: 1.4, seg: 64 });
    A(lathe([[14, y0 + 308], [36, y0 + 311], [38, y0 + 312.5], [36, y0 + 314], [14, y0 + 313]], 64), ivory, undefined, R.g);
    A(lathe([[30, y0 + 346], [33, y0 + 348], [12, y0 + 356], [8, y0 + 356]], 64), ivory, undefined, R.g);
    A(torus(60, 1.5, 8, 120), brass, xf({ p: [0, y0 + 286, 0], r: [Math.PI / 2, 0, 0] }), R.g, 'keep');
    A(torus(60, 0.6, 6, 120), warmGlow, xf({ p: [0, y0 + 284.2, 0], r: [Math.PI / 2, 0, 0] }), R.g, 'keep', false);
    for (let a = 0; a < 360; a += 72) { const [x, z] = pol(37, a + 36); A(cyl(0.7, 46, 'x', 6), brass, xf({ p: [x, y0 + 286, z], r: [0, (a + 36 - 90) * D2R, 0] }), R.g); }
    // the needle
    A(lathe([[8, y0 + 356], [5.2, y0 + 372], [3.4, y0 + 392], [1.5, y0 + 420], [0.5, y0 + 438], [0, y0 + 438]], 24), ivory, undefined, R.g);
    for (const [y, q] of [[358, 9.2], [374, 6.2], [394, 4.4]] as [number, number][]) A(torus(q, 0.9, 8, 40), brass, xf({ p: [0, y0 + y, 0], r: [Math.PI / 2, 0, 0] }), R.g, 'keep');
    A(new THREE.SphereGeometry(2.1, 12, 10), beaconM, at(0, y0 + 440, 0), R.g, 'keep', false);
    R.lightAt = 4.0;
  }

  // ---- five towers round it ----------------------------------------------------------------------------------------
  const podium = (R: Rise, M: THREE.Matrix4, rx: number, rz: number, n: number, seed: number) => {
    facade(R, M, [{ y: L2, rx, rz, n }, { y: L2 + 14, rx, rz, n }], { floor: 14, bays: 32, finEvery: 2, frame: ivory, rooms: rooms(seed, 0.8, 2.6), plate: 3.4, finDepth: 1.2 });
  };
  { // the Sail: front right
    const R = riser('sail', 250, 1.5, 1.15), [x, z] = pol(166, 36), M = xf({ p: [x, 0, z], r: [0, 36 * D2R, 0] });
    const secs: Sec[] = []; for (let i = 0; i <= 18; i++) { const t = i / 18, top = sm(0.7, 1, t), k = (0.84 + 0.16 * Math.sin(Math.PI * Math.min(t / 0.75, 1))) * (1 - 0.72 * top); secs.push({ y: L2 + 14 + t * 216, rx: 33 * k, rz: 16 * (1 - 0.5 * top), ox: 20 * top * top, n: 2.3 }); }
    podium(R, M, 38, 21, 2.6, 21); facade(R, M, secs, { bays: 32, frame: ivory, rooms: rooms(22, 0.45), finDepth: 2.4 });
    A(fin(densify(secs, 12), 0, 5, 1.6), brass, M, R.g); A(fin(densify(secs, 12), 0.5, 5, 1.6), brass, M, R.g);
  }
  { // the Stack: front left, four drums with gardens between
    const R = riser('stack', 230, 1.35, 1.1), [x, z] = pol(166, -36), M = xf({ p: [x, 0, z] });
    podium(R, M, 36, 36, 2, 31);
    let y = L2 + 14; const rad = [30, 27, 24, 20], hh = [48, 48, 36, 36];
    rad.forEach((q, i) => {
      facade(R, M, [{ y, rx: q, rz: q }, { y: y + hh[i]!, rx: q - 1.5, rz: q - 1.5 }], { bays: 32, frame: i % 2 ? brass : ivory, rooms: rooms(32 + i, 0.5), finDepth: 2 });
      y += hh[i]!;
      A(lathe([[q - 1.5, y], [q + 5, y + 0.6], [q + 5, y + 2.2], [10, y + 2.2]], 48), ivory, M, R.g);
      if (i < 3) { A(cyl(9, 9, 'y', 20), ivoryStone, at(x, y + 6.5, z), R.g); for (let a = 0; a < 360; a += 30) { const [tx, tz] = pol(q - 1, a + i * 11); tree(R.g, x + tx, y + 2.2, z + tz, 0.42); } y += 11; }
    });
    A(torus(15, 1.1, 8, 48), brass, xf({ p: [x, y + 6, z], r: [Math.PI / 2, 0, 0] }), R.g, 'keep'); for (let a = 0; a < 360; a += 60) { const [tx, tz] = pol(15, a); A(cyl(0.6, 6, 'y', 6), brass, at(x + tx, y + 3, z + tz), R.g); }
    A(cyl(0.5, 26, 'y', 6), brass, at(x, y + 13, z), R.g); A(new THREE.SphereGeometry(1.5, 10, 8), beaconM, at(x, y + 27, z), R.g, 'keep', false);
  }
  { // the Blade: right, a squared tower that twists as it climbs
    const R = riser('blade', 340, 1.7, 1.2), [x, z] = pol(168, 108), M = xf({ p: [x, 0, z], r: [0, 108 * D2R, 0] });
    const secs: Sec[] = []; for (let i = 0; i <= 26; i++) { const t = i / 26; secs.push({ y: L2 + 14 + t * 312, rx: 25 - 9 * t, rz: 25 - 9 * t, n: 3.6, rot: t * 1.35 }); }
    podium(R, M, 33, 33, 3.4, 41); facade(R, M, secs, { bays: 32, frame: bronze, rooms: rooms(42, 0.6), finDepth: 2.6, finEvery: 4 });
    for (const k of [0.125, 0.375, 0.625, 0.875]) A(fin(densify(secs, 12), k, 3.6, 2.2), brass, M, R.g);
    A(lathe([[14, L2 + 326], [9, L2 + 334], [0, L2 + 336]], 4), brass, xf({ p: [x, 0, z], r: [0, 108 * D2R + 1.35 + Math.PI / 4, 0] }), R.g);
  }
  { // the Gate: left, two legs that lean together and join
    const R = riser('gate', 300, 1.6, 1.2), [x, z] = pol(168, -108), M = xf({ p: [x, 0, z], r: [0, -0.22, 0] });
    for (const sx of [-1, 1]) { const secs: Sec[] = []; for (let i = 0; i <= 16; i++) { const t = i / 16; secs.push({ y: L2 + 14 + t * 216, rx: 13 - 1.5 * t, rz: 19 - 2 * t, ox: sx * (31 - 17 * t * t) }); } facade(R, M, secs, { bays: 16, frame: ivory, rooms: rooms(51 + sx, 0.5), finDepth: 2 }); }
    podium(R, M, 50, 24, 3, 53);
    const top: Sec[] = [{ y: L2 + 222, rx: 30, rz: 18, n: 3 }, { y: L2 + 270, rx: 32, rz: 17, n: 3 }, { y: L2 + 282, rx: 27, rz: 13, n: 2.4 }];
    facade(R, M, top, { bays: 32, frame: brass, rooms: rooms(54, 0.3, 2.3), finDepth: 2.2 });
    A(rbox(40, 8, 9, 2), ivory, xf({ p: [0, L2 + 118, 0] }).premultiply(M), R.g); A(rbox(36, 3.2, 9.6, 0.4), warmGlow, xf({ p: [0, L2 + 118, 0] }).premultiply(M), R.g, 'keep', false);
  }
  { // the Twins: behind the spire, two slim towers and a bridge
    const R = riser('twins', 290, 1.45, 1.15);
    for (const [deg, h, seed] of [[162, 264, 61], [-163, 232, 62]] as [number, number, number][]) {
      const [x, z] = pol(172, deg), M = xf({ p: [x, 0, z] });
      const secs: Sec[] = []; for (let i = 0; i <= 12; i++) { const t = i / 12; secs.push({ y: L2 + t * h, rx: 15 - 4 * t, rz: 15 - 4 * t }); }
      facade(R, M, secs, { bays: 16, finEvery: 1, frame: ivory, rooms: rooms(seed, 0.4), finDepth: 2.2 });
      A(lathe([[11, L2 + h], [13, L2 + h + 1.5], [4, L2 + h + 12], [0.6, L2 + h + 34], [0, L2 + h + 34]], 32), brass, M, R.g);
    }
  }

  { const R = riser('bridges', 300, 2.9, 0.9);
    const span = (a: [number, number, number], b: [number, number, number]) => { const A3 = new THREE.Vector3(...a), B3 = new THREE.Vector3(...b), mid = A3.clone().add(B3).multiplyScalar(0.5), len = A3.distanceTo(B3), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), B3.clone().sub(A3).normalize()), m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
      A(cyl(2.3, len, 'x', 12), ivory, m, R.g); A(rbox(len - 6, 1.3, 4.9, 0.3), warmGlow, m, R.g, 'keep', false); A(cyl(0.45, len, 'x', 6), brass, new THREE.Matrix4().compose(mid.clone().add(new THREE.Vector3(0, 3.4, 0)), q, new THREE.Vector3(1, 1, 1)), R.g); };
    const sail = pol(166, 36), blade2 = pol(168, 108), stack = pol(166, -36), gate = pol(168, -108);
    span([sail[0] + 14, L2 + 150, sail[1] - 6], [blade2[0] - 14, L2 + 176, blade2[1] + 10]);
    span([stack[0] - 22, L2 + 118, stack[1] - 8], [gate[0] + 26, L2 + 132, gate[1] + 6]);
    span([sail[0] - 20, L2 + 96, sail[1] - 6], [stack[0] + 24, L2 + 96, stack[1] - 6]);
  }

  // ---- the outer ring ----------------------------------------------------------------------------------------------
  { // the Forum: a dome on a colonnade, right
    const R = riser('forum', 80, 1.0, 0.9), [x, z] = pol(R0 - 92, 108), M = at(x, 0, z), hall = warmHall(1.7);
    for (let i = 0; i < 3; i++) A(cyl(57 - i * 3.5, 1.6, 'y', 64), ivoryStone, at(x, L0 + 0.8 + i * 1.6, z), R.g);
    A(cyl(40, 18, 'y', 64, 40, true), hall, at(x, L0 + 13.8, z), R.g, 'keep'); R.lit.push(hall);
    for (let a = 0; a < 360; a += 360 / 28) { const [cx, cz] = pol(46, a); A(cyl(1.4, 18, 'y', 10), ivory, at(x + cx, L0 + 13.8, z + cz), R.g); }
    A(lathe([[39, L0 + 22.8], [49.5, L0 + 22.8], [49.5, L0 + 26.4], [43, L0 + 27.4]], 64), ivory, M, R.g);
    const dome: [number, number][] = []; for (let i = 0; i <= 14; i++) { const t = (i / 14) * (Math.PI / 2) * 0.93; dome.push([43 * Math.cos(t), L0 + 27.4 + 30 * Math.sin(t)]); }
    A(lathe(dome, 64), ivory, M, R.g);
    for (let a = 0; a < 360; a += 22.5) A(blade(dome.map(([q, y]) => [q + 0.2, y] as [number, number]), dome.map(([q, y]) => [q + 1.5, y + 0.4] as [number, number]), 1.3), brass, xf({ p: [x, 0, z], r: [0, (a - 90) * D2R, 0] }), R.g);
    A(cyl(7, 5, 'y', 24), brass, at(x, L0 + 59.5, z), R.g); A(cyl(5.6, 4, 'y', 24), warmGlow, at(x, L0 + 60.4, z), R.g, 'keep', false); A(lathe([[7.6, L0 + 62], [0.4, L0 + 71], [0, L0 + 71]], 24), brass, M, R.g);
  }
  { // the Gardens: stepped terraces with planted edges, left
    const R = riser('gardens', 90, 1.1, 0.9), [x, z] = pol(R0 - 92, -108), ry = -108 * D2R;
    for (let i = 0; i < 5; i++) {
      const w = 124 - i * 21, d = 84 - i * 14, y = L0 + i * 14.5, M = xf({ p: [x, 0, z], r: [0, ry, 0] });
      facade(R, M, [{ y, rx: w / 2, rz: d / 2, n: 5 }, { y: y + 12, rx: w / 2, rz: d / 2, n: 5 }], { floor: 12, bays: [48, 48, 32, 32, 16][i]!, finEvery: 2, frame: ivory, rooms: rooms(81 + i, 0.7, 2.0), plate: 2.8, finDepth: 1 });
      if (i < 4) for (let k = 0; k < 40; k++) { const [px, pz] = secPoint({ y: 0, rx: w / 2 - 4, rz: d / 2 - 4, n: 5 }, k / 40, 0); const v = new THREE.Vector3(px, 0, pz).applyMatrix4(xf({ r: [0, ry, 0] })); const [qx, qz] = secPoint({ y: 0, rx: (w - 21) / 2 + 1.5, rz: (d - 14) / 2 + 1.5, n: 5 }, k / 40, 0); if (Math.hypot(px, pz) > Math.hypot(qx, qz) + 2) tree(R.g, x + v.x, y + 13, z + v.z, 0.36); }
    }
    A(cyl(0.5, 20, 'y', 6), brass, at(x, L0 + 82, z), R.g);
  }
  { // the Port: landing pads on tall stems, behind
    const R = riser('port', 240, 1.25, 1.1);
    for (const [deg, rr, h] of [[158, R0 - 60, 150], [-166, R0 - 52, 205], [128, R0 - 46, 112]] as [number, number, number][]) {
      const [x, z] = pol(rr, deg), M = at(x, 0, z);
      A(lathe([[9, L0], [5, L0 + 10], [2.6, L0 + h * 0.5], [3.4, L0 + h - 8], [10, L0 + h - 2], [0, L0 + h - 2]], 24), ivory, M, R.g);
      A(lathe([[10, L0 + h - 2], [26, L0 + h - 0.6], [27.5, L0 + h + 0.4], [27.5, L0 + h + 1.8], [0, L0 + h + 1.8]], 56), ivory, M, R.g);
      A(ringStrip(17, 19, L0 + h + 2), brass, M, R.g, 'keep'); A(torus(27.6, 0.5, 6, 72), warmGlow, xf({ p: [x, L0 + h + 1.4, z], r: [Math.PI / 2, 0, 0] }), R.g, 'keep', false);
      for (let a = 0; a < 360; a += 45) A(blade([[4, L0 + h - 9], [10, L0 + h - 2.4]], [[5, L0 + h - 11], [25, L0 + h - 1.2]], 0.9), brass, xf({ p: [x, 0, z], r: [0, a * D2R, 0] }), R.g);
      facade(R, M, [{ y: L0, rx: 16, rz: 16 }, { y: L0 + 12, rx: 15, rz: 15 }], { floor: 12, bays: 16, finEvery: 1, frame: ivory, rooms: rooms(90 + deg, 0.8, 2.4), plate: 2 });
    }
  }
  { // the Shell: a small open theatre in the park, front left
    const R = riser('shell', 40, 0.95, 0.8), [x, z] = pol(R0 - 96, -40), ry = (-40 + 180) * D2R, M = xf({ p: [x, 0, z], r: [0, ry, 0] });
    for (let i = 0; i < 6; i++) A(ringStrip(20 + i * 5, 25 + i * 5, L0 + 1 + i * 1.7, -80, 80), ivoryStone, M, R.g, 'keep'), A(wall(25 + i * 5, L0, L0 + 1 + i * 1.7, -80, 80), ivoryStone, M, R.g);
    const sh: [number, number][] = []; for (let i = 0; i <= 10; i++) { const t = (i / 10) * (Math.PI / 2); sh.push([24 * Math.cos(t), L0 + 26 * Math.sin(t)]); }
    const shell = new THREE.LatheGeometry(sh.map(([a, b]) => new THREE.Vector2(a, b)), 28, Math.PI * 0.5, Math.PI); A(shell, ivory, xf({ p: [x, 0, z], r: [0, ry + Math.PI, 0] }), R.g);
    A(ringStrip(0, 16, L0 + 0.8, 0, 360), warmGlow, M, R.g, 'keep', false);
    for (let i = 0; i < 5; i++) for (let a = -70; a <= 70; a += 9 + i) if (r() < 0.62) { const [px, pz] = pol(22.5 + i * 5, a); const v = new THREE.Vector3(px, 0, pz).applyMatrix4(xf({ r: [0, ry, 0] })); person(R.g, x + v.x, L0 + 1 + i * 1.7, z + v.z, cloth[Math.floor(r() * 5)]!, true); }
  }
  { // the Canopy: a pavilion under a wide saucer roof, front right
    const R = riser('canopy', 40, 1.05, 0.8), [x, z] = pol(R0 - 90, 40), M = at(x, 0, z), cafe = warmHall(1.9);
    A(cyl(13, 13, 'y', 40, 13, true), cafe, at(x, L0 + 6.5, z), R.g, 'keep'); R.lit.push(cafe); A(cyl(13.1, 13, 'y', 40, 13.1, true), glass, at(x, L0 + 6.5, z), R.g, 'keep', false);
    A(lathe([[2, L0 + 13], [34, L0 + 17.5], [36, L0 + 18.6], [34, L0 + 19.6], [8, L0 + 21.5], [0, L0 + 21.5]], 64), ivory, M, R.g);
    A(torus(35.4, 0.4, 6, 90), warmGlow, xf({ p: [x, L0 + 17.6, z], r: [Math.PI / 2, 0, 0] }), R.g, 'keep', false);
    for (let a = 0; a < 360; a += 45) { const [cx, cz] = pol(27, a + 22); A(cyl(0.6, 16.6, 'y', 6), brass, at(x + cx, L0 + 8.3, z + cz), R.g); }
    A(ringStrip(0, 40, L0 + 0.4), promM, M, R.g, 'keep');
    for (let i = 0; i < 9; i++) { const [px, pz] = pol(18 + r() * 18, r() * 360); person(R.g, x + px, L0 + 0.4, z + pz, cloth[Math.floor(r() * 5)]!); }
  }

  // ---- the ring train's track -------------------------------------------------------------------------------------
  const TRACK = 221, TRACK_Y = L2 + 44;
  { const R = riser('track', 60, 1.9, 0.9);
    A(lathe([[TRACK - 2.6, TRACK_Y - 1.6], [TRACK - 1.2, TRACK_Y - 3.6], [TRACK + 1.2, TRACK_Y - 3.6], [TRACK + 2.6, TRACK_Y - 1.6], [TRACK + 2.6, TRACK_Y], [TRACK - 2.6, TRACK_Y], [TRACK - 2.6, TRACK_Y - 1.6]], 180), ivory, undefined, R.g);
    A(torus(TRACK, 0.35, 6, 240), warmGlow, xf({ p: [0, TRACK_Y - 3.9, 0], r: [Math.PI / 2, 0, 0] }), R.g, 'keep', false);
    for (let a = 6; a < 360; a += 12) { const [x, z] = pol(TRACK, a); A(lathe([[2.2, L2], [1.1, L2 + 6], [0.9, TRACK_Y - 8], [2.4, TRACK_Y - 3.6], [0, TRACK_Y - 3.6]], 10), ivory, at(x, 0, z), R.g); }
  }

  // ---- park: groves, beds, lamps, people standing ------------------------------------------------------------------
  for (const [a0, a1] of [[5, 67], [-67, -5], [77, 139], [-139, -77], [149, 211]] as [number, number][]) { A(ringStrip(338, 344, L0 + 0.35, a0, a1), promM, undefined, base, 'keep'); A(ringStrip(R0 - 74, R0 - 69, L0 + 0.35, a0 + 4, a1 - 4), promM, undefined, base, 'keep'); for (let a = a0 + 3; a < a1 - 2; a += 7.5) { const [x, z] = pol(347.5, a); lampPost(base, x, L0, z, 9); } }
  for (let i = 0; i < 260; i++) { const deg = -180 + r() * 360, rr = 302 + r() * (R0 - 352); if (CANALS.some((c) => Math.abs(((deg - c + 540) % 360) - 180) < (c === 0 ? 11 : 6.5))) continue; const [x, z] = pol(rr, deg); if ([[R0 - 92, 108, 66], [R0 - 92, -108, 78], [R0 - 96, -40, 58], [R0 - 90, 40, 46], [R0 - 60, 158, 22], [R0 - 52, -166, 22], [R0 - 46, 128, 22]].some(([q, d, c]) => Math.hypot(x - pol(q!, d!)[0], z - pol(q!, d!)[1]) < c!)) continue; if (Math.abs(rr - 341) < 6 || Math.abs(rr - (R0 - 71.5)) < 5.5) continue; tree(park, x, L0, z, 0.85 + r() * 0.5); }
  for (let a = 0; a < 360; a += 9) { const [x, z] = pol(R0 - 25, a + 4); if (CANALS.every((c) => Math.abs(((a + 4 - c + 540) % 360) - 180) > 4)) lampPost(base, x, L0 + 0.3, z, 12); }
  for (let a = 0; a < 360; a += 12) for (const rr of [235, 289]) { const [x, z] = pol(rr, a + (rr > 250 ? 6 : 0)); lampPost(base, x, L1, z, 12); }
  for (let i = 0; i < 46; i++) { const deg = -70 + r() * 140; if (Math.abs(deg) < 4 || Math.abs(Math.abs(deg) - 72) < 3) continue; const [x, z] = pol(R0 - 38 + r() * 24, deg); person(folk, x, L0 + 0.3, z, cloth[Math.floor(r() * 5)]!); }
  for (let i = 0; i < 26; i++) { const [x, z] = pol(52 + r() * 22, r() * 360); person(folk, x, L3, z, cloth[Math.floor(r() * 5)]!); }
  for (let i = 0; i < 30; i++) { const c = CANALS[Math.floor(r() * 3)]!, sx = r() < 0.5 ? -1 : 1, v = new THREE.Vector3(sx * (17 + r() * 9) * (c === 0 ? 1.25 : 0.8), 0, 300 + r() * (R0 - 350)).applyMatrix4(xf({ r: [0, c * D2R, 0] })); person(folk, v.x, L0 + 0.5, v.z, cloth[Math.floor(r() * 5)]!); }

  // ---- things that move: pods, trains, craft, walkers --------------------------------------------------------------
  const life = new THREE.Group(); city.add(life);
  const inst = (geo: THREE.BufferGeometry, m: THREE.Material, n: number, glow = false) => { const im = new THREE.InstancedMesh(geo, m, n); im.frustumCulled = false; im.castShadow = !glow; im.receiveShadow = !glow; life.add(im); movers.push(im); if (glow) { glows.push(im); ctx.noAO.push(im); } return im; };
  const paint = [0xece3d2, 0xe0a13e, 0x8a5c33, 0x2a211b, 0xcbb089, 0xb5562a].map((h) => new THREE.Color(h));
  const LANES = [{ r: 242, dir: 1, k: 2, ph: 0 }, { r: 254, dir: 1, k: 1, ph: 21 }, { r: 270, dir: -1, k: 1, ph: 7 }, { r: 282, dir: -1, k: 2, ph: 33 }];
  const OFFS = [0, 17, 39], NP = LANES.length * 18;
  const podBody = inst(new THREE.SphereGeometry(1, 20, 12), P({ color: 0xffffff, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }), NP);
  const podTop = inst(new THREE.SphereGeometry(1, 16, 10), P({ color: 0x110d0a, roughness: 0.08, clearcoat: 1 }), NP);
  const podHead = inst(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0d2).multiplyScalar(5) }), NP, true);
  const podTail = inst(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a20).multiplyScalar(3.4) }), NP, true);
  const glowM = new THREE.MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(0.9), map: dot, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const podGlow = inst(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), glowM, NP, true);
  const NT = 10, carBody = inst(new THREE.CapsuleGeometry(4.4, 24, 6, 14).rotateZ(Math.PI / 2), P({ color: 0xece3d2, roughness: 0.3, clearcoat: 1 }), NT);
  const carWin = inst(new THREE.BoxGeometry(22, 2.4, 9.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd29a).multiplyScalar(2.6) }), NT, true);
  const NS = 7, shBody = inst(new THREE.SphereGeometry(1, 20, 12), P({ color: 0xece3d2, roughness: 0.28, clearcoat: 1 }), NS);
  const shFin = inst(new THREE.ConeGeometry(1, 1, 3), P({ color: 0xd0a45a, metalness: 1, roughness: 0.3 }), NS);
  const shLight = inst(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(6) }), NS * 2, true);
  type Walk = { ax: number; az: number; bx: number; bz: number; y: number; ph: number; loop?: number; c: number };
  const walks: Walk[] = [];
  for (let i = 0; i < 6; i++) walks.push({ ax: 0, az: 0, bx: 0, bz: 0, y: L3, ph: i / 6, loop: 97, c: 0 });
  for (let i = 0; i < 16; i++) { const sx = i % 2 ? -1 : 1, x = sx * (15 + r() * 14), z = 300 + r() * (R0 - 400); walks.push({ ax: x, az: z, bx: x + (r() - 0.5) * 6, bz: z + 50, y: L0 + 0.5, ph: r(), c: Math.floor(r() * 5) }); }
  for (let i = 0; i < 26; i++) { const a = -75 + r() * 150, rr = R0 - 36 + r() * 20, da = 6 * (r() < 0.5 ? -1 : 1), [ax, az] = pol(rr, a), [bx, bz] = pol(rr, a + da); walks.push({ ax, az, bx, bz, y: L0 + 0.3, ph: r(), c: Math.floor(r() * 5) }); }
  for (let i = 0; i < 14; i++) { const a = r() * 360, rr = 112 + r() * 100, [ax, az] = pol(rr, a), [bx, bz] = pol(rr + (r() - 0.5) * 30, a + 14 * (r() < 0.5 ? -1 : 1)); walks.push({ ax, az, bx, bz, y: L2, ph: r(), c: Math.floor(r() * 5) }); }
  const wBody = inst(new THREE.CapsuleGeometry(1.45, 6, 3, 8), P({ color: 0xffffff, roughness: 0.7 }), walks.length), wHead = inst(new THREE.SphereGeometry(1.5, 10, 8), P({ color: 0xffffff, roughness: 0.7 }), walks.length);
  const clothC = [0xefe6d6, 0xc9a56c, 0x6d4a2c, 0x2b211a, 0xd98a3c].map((h) => new THREE.Color(h));
  walks.forEach((w, i) => { wBody.setColorAt(i, clothC[w.c]!); wHead.setColorAt(i, clothC[w.c]!); });
  const m4 = new THREE.Matrix4(), qd = new THREE.Quaternion(), eu = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  const place = (im: THREE.InstancedMesh, i: number, x: number, y: number, z: number, ry: number, sx: number, sy: number, sz: number, rz = 0) => { eu.set(0, ry, rz, 'YXZ'); qd.setFromEuler(eu); im.setMatrixAt(i, m4.compose(v3.set(x, y, z), qd, sc.set(sx, sy, sz))); };
  let pi = 0; LANES.forEach((ln, li) => { for (let g = 0; g < 6; g++) OFFS.forEach((_, vi) => { podBody.setColorAt(pi++, paint[(vi + li * 2) % paint.length]!); }); });
  function setLife(t: number) {
    const f = t / NOVA.T; let i = 0;
    LANES.forEach((ln, li) => { for (let g = 0; g < 6; g++) OFFS.forEach((off, vi) => {
      const deg = ln.ph + g * 60 + off + ln.dir * ln.k * 60 * f, a = deg * D2R, x = ln.r * Math.sin(a), z = ln.r * Math.cos(a), ry = a + (ln.dir > 0 ? 0 : Math.PI), bus = (vi + li) % 3 === 2, len = bus ? 21 : 14.5, y = L1 + 5.2;
      place(podBody, i, x, y, z, ry, len, 4.3, 6.1); place(podTop, i, x - Math.cos(ry) * 1.5, y + 2.4, z + Math.sin(ry) * 1.5, ry, len * 0.62, 3.4, 4.9);
      const hx = Math.cos(ry), hz = -Math.sin(ry); place(podHead, i, x + hx * (len - 0.6), y - 0.2, z + hz * (len - 0.6), ry, 0.9, 1.1, 3.6); place(podTail, i, x - hx * (len - 0.5), y - 0.2, z - hz * (len - 0.5), ry, 0.7, 0.9, 3.9);
      place(podGlow, i, x, L1 + 0.9, z, ry, len * 2.7, 1, 19); i++;
    }); });
    for (let tr = 0; tr < 2; tr++) for (let c = 0; c < 5; c++) { const a = (tr * 180 + 30 + 180 * f) * D2R - (c * 34) / TRACK, x = TRACK * Math.sin(a), z = TRACK * Math.cos(a); place(carBody, tr * 5 + c, x, TRACK_Y + 4.7, z, a, 1, 1, 1); place(carWin, tr * 5 + c, x, TRACK_Y + 5.6, z, a, 1, 1, 1); }
    for (let s = 0; s < NS; s++) {
      const hi = s >= 4, n = hi ? 3 : 4, a = ((hi ? -1 : 1) * (s % n + f) * 360) / n * D2R + (hi ? 1 : 0.4), ra = hi ? 215 : 330, rb = hi ? 160 : 245, x = ra * Math.sin(a), z = rb * Math.cos(a) - (hi ? 30 : 0), y = (hi ? 395 : 255) + 26 * Math.sin(a * 2 + s);
      const ry = Math.atan2(rb * Math.sin(a), ra * Math.cos(a)) + (hi ? Math.PI : 0), bank = (hi ? -0.3 : 0.3);
      place(shBody, s, x, y, z, ry, 13, 2.9, 6.4, bank); place(shFin, s, x - Math.cos(ry) * 9, y + 3.4, z + Math.sin(ry) * 9, ry, 2.6, 6, 0.6, bank);
      place(shLight, s * 2, x - Math.cos(ry) * 12.6, y, z + Math.sin(ry) * 12.6, ry, 1.2, 1.6, 3.6, bank); place(shLight, s * 2 + 1, x + Math.cos(ry) * 12.4, y - 0.4, z - Math.sin(ry) * 12.4, ry, 0.8, 0.8, 0.8);
    }
    walks.forEach((w, k) => {
      let x: number, z: number;
      if (w.loop) { const a = (w.ph + f / 6) * TAU; x = w.loop * Math.sin(a); z = w.loop * Math.cos(a); }
      else { const u = (f + w.ph) % 1, q = u < 0.5 ? u * 2 : 2 - u * 2, e = q * q * (3 - 2 * q); x = mix(w.ax, w.bx, e); z = mix(w.az, w.bz, e); }
      const bob = 0.35 * Math.abs(Math.sin(TAU * 8 * (f + w.ph)));
      place(wBody, k, x, w.y + 4.5 + bob, z, 0, 1, 1, 1); place(wHead, k, x, w.y + 10.3 + bob, z, 0, 1, 1, 1);
    });
    for (const m of movers) (m as THREE.InstancedMesh).instanceMatrix.needsUpdate = true;
  }

  pb.finish();
  ctx.scene.traverse((o) => { if (o instanceof THREE.Mesh && o.material === glass) ctx.noAO.push(o); });

  // ---- the slab under it: dark, with a grid the light runs along ---------------------------------------------------
  const slabGeo = new THREE.CircleGeometry(3400, 96); slabGeo.setAttribute('uv1', slabGeo.getAttribute('uv').clone());
  const fade = tex(512, 512, (g) => { const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256); gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, '#fff'); gr.addColorStop(0.55, '#8a8a8a'); gr.addColorStop(0.8, '#1c1c1c'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); }, false);
  fade.wrapS = fade.wrapT = THREE.ClampToEdgeWrapping; fade.channel = 1;
  const slab = new THREE.Mesh(slabGeo, P({ color: 0x080706, roughness: 0.7, alphaMap: fade, transparent: true, envMapIntensity: 0.06, specularIntensity: 0.35 }));
  slab.rotation.x = -Math.PI / 2; slab.receiveShadow = true; world.add(slab);
  const PITCH = 50, GX = 2100, GZ0 = -1300, GZ1 = 2200, LW = 1.5;
  const gp: number[] = [];
  const seg = (x0: number, z0: number, x1: number, z1: number) => { const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), nx = (-dz / l) * LW, nz = (dx / l) * LW; gp.push(x0 - nx, 0.9, z0 - nz, x0 + nx, 0.9, z0 + nz, x1 - nx, 0.9, z1 - nz, x1 - nx, 0.9, z1 - nz, x0 + nx, 0.9, z0 + nz, x1 + nx, 0.9, z1 + nz); };
  for (let x = -GX; x <= GX; x += PITCH) for (let z = GZ0; z < GZ1; z += PITCH) seg(x, z, x, z + PITCH);
  for (let z = GZ0; z <= GZ1; z += PITCH) for (let x = -GX; x < GX; x += PITCH) seg(x, z, x + PITCH, z);
  const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); gridGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(gp.length), 3)); gridGeo.computeVertexNormals();
  const grid = new THREE.Mesh(gridGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); grid.frustumCulled = false; world.add(grid); glows.push(grid);
  // pools of light where the falls land, and the glow the city throws on the slab
  const pools: THREE.Mesh[] = [];
  const pool = (x: number, z: number, s: number, k: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(k), map: dot, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(x, 1.4, z); m.userData.k = k; world.add(m); glows.push(m); ctx.noAO.push(m); pools.push(m); return m; };
  const under = pool(0, 0, 1500, 0.55);
  impacts.forEach(([x, z], i) => pool(x, z, i === 0 ? 300 : 210, i === 0 ? 2.6 : 1.7));
  if (NOVA.haze) { const haze = new THREE.Sprite(new THREE.SpriteMaterial({ color: new THREE.Color(0xff9a38).multiplyScalar(0.05), map: dot, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true })); haze.position.set(0, 470, -330); haze.scale.set(1900, 1050, 1); world.add(haze); glows.push(haze); ctx.noAO.push(haze); }
  const mists: THREE.Sprite[] = [];
  impacts.forEach(([x, z], i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: AMBER.clone().multiplyScalar(i === 0 ? 1.5 : 1), map: dot, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.position.set(x, 24, z); s.scale.set(i === 0 ? 150 : 100, i === 0 ? 76 : 52, 1); s.userData.k = i === 0 ? 1.5 : 1; world.add(s); glows.push(s); ctx.noAO.push(s); mists.push(s); });

  // ---- one clock for the opening, one for the loop -------------------------------------------------------------------
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const riseMats = new Set<THREE.Material>();
  for (const R of rises) R.g.traverse((o) => { if (o instanceof THREE.Mesh) riseMats.add(o.material as THREE.Material); });
  for (const m of riseMats) { m.clippingPlanes = [clip]; m.clipShadows = true; }
  const pulse = (x: number) => { const c = 0.5 + 0.5 * Math.cos(TAU * x); return c * c * c; };
  const lanePh = Array.from({ length: 40 }, () => r());
  let mode: 'full' | 'static' | 'osc' = 'static';
  const col = new THREE.Color();
  /** Paints the water and the slab grid. fill is how far the water has run (mm), flood how far it has spread on the slab, t the loop clock. */
  function paintWater(fill: number, flood: number, t: number) {
    const f = t / NOVA.T, lo = mode === 'osc' ? 0 : 1, osc = mode === 'static' ? 0 : 1;
    for (const w of waters) {
      const c = w.geo.getAttribute('color') as THREE.BufferAttribute, fall = w.kind === 'fall';
      for (let i = 0; i < w.s.length; i++) {
        const s = w.s[i]!, m = 1 - sm(fill - 26, fill, s), ph = lanePh[(w.lane[i]! + w.k * 7) % 40]!;
        const p = fall ? pulse(s / 46 - 7 * f + ph) * 1.5 + pulse(s / 19 - 13 * f + ph * 3.1) * 0.7 : pulse(s / 58 - 4 * f + ph) * 0.9 + pulse(s / 23 - 9 * f + ph * 2.3) * 0.4;
        const v = (fall ? 0.5 * lo + osc * p : 1.25 * lo + osc * p) * w.env[i]! * m;
        c.setXYZ(i, AMBER.r * v * NOVA.waterK, AMBER.g * v * NOVA.waterK, AMBER.b * v * NOVA.waterK);
      }
      c.needsUpdate = true;
    }
    const gc = gridGeo.getAttribute('color') as THREE.BufferAttribute, gpos = gridGeo.getAttribute('position');
    for (let i = 0; i < gc.count; i++) {
      const x = gpos.getX(i), z = gpos.getZ(i), rr = Math.hypot(x, z), far = 1 - sm(900, 2300, rr);
      let v = 0.011 * lo * far * (1 + 2.6 * (1 - sm(350, 1000, rr)));
      for (let k = 0; k < impacts.length; k++) {
        const d = Math.abs(x - impacts[k]![0]) + Math.abs(z - impacts[k]![1]), a = (k === 0 ? 0.95 : 0.5) * Math.exp(-d / (k === 0 ? 300 : 180)) * (1 - sm(flood - 80, flood, d));
        if (a > 0.004) v += a * (0.42 * lo + (a > 0.12 ? osc * 0.9 * pulse(d / 210 - 3 * f + k * 0.37) : 0));
      }
      if (Math.abs(x) < 4 && z > impacts[0]![1]) { const d = z - impacts[0]![1], a = 1.5 * Math.exp(-d / 2600) * (1 - sm(flood - 80, flood, d)); v += a * (0.5 * lo + osc * pulse(d / 260 - 3 * f)); }
      gc.setXYZ(i, AMBER.r * v, AMBER.g * v, AMBER.b * v);
    }
    gc.needsUpdate = true;
    const on = sm(0, 60, flood) * (mode === 'osc' ? 0 : 1);
    pools.forEach((p, i) => { (p.material as THREE.MeshBasicMaterial).color.copy(AMBER).multiplyScalar(p.userData.k * (i === 0 ? 0.35 + 0.65 * on : on)); });
    mists.forEach((s) => { s.material.color.copy(AMBER).multiplyScalar(s.userData.k * on); });
  }
  const back = (x: number) => { const c = 1.35; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
  /** Sets the opening at b seconds. At NOVA.BE and after, the city is finished. */
  function setBuild(b: number) {
    const lift = mix(NOVA.SEAT, NOVA.LIFT, sm(0.35, 1.7, b));
    city.position.y = lift; clip.constant = -(lift - 49.5) * 0.001;
    for (const R of rises) {
      const p = clamp01((b - R.t0) / R.d), e = p >= 1 ? 1 : back(p);
      R.g.position.y = -(1 - e) * (R.h + 12); R.g.visible = p > 0;
      const on = sm(R.lightAt, R.lightAt + 0.6, b);
      for (const m of R.lit) m.emissiveIntensity = m.userData.k * on;
    }
    const lamps = sm(3.5, 4.1, b);
    bulbM.color.set(0xffd9a0).multiplyScalar(4.5 * lamps); warmGlow.color.set(0xffc988).multiplyScalar(2.4 * lamps); beaconM.color.set(0xff8a3a).multiplyScalar(7 * sm(4.0, 4.4, b));
    life.visible = b >= NOVA.BE;
    const fill = b >= NOVA.BE ? 1e6 : -30 + sm(4.1, 4.95, b) * 1040, flood = b >= NOVA.BE ? 1e6 : sm(4.85, 5.6, b) * 2600;
    return { fill, flood };
  }
  return {
    world, city, life, movers, glows, noAO: ctx.noAO,
    debug: () => waters.slice(0, 3).map((w) => ({ kind: w.kind, n: w.s.length, c: Array.from((w.geo.getAttribute('color').array as Float32Array).slice(0, 9)), p: Array.from((w.geo.getAttribute('position').array as Float32Array).slice(0, 9)), s: Array.from(w.s.slice(0, 3)), env: Array.from(w.env.slice(0, 3)) })),
    setMode: (m: 'full' | 'static' | 'osc') => { mode = m; },
    set: (b: number, t: number) => { const { fill, flood } = setBuild(b); paintWater(fill, flood, t); setLife(t); },
  };
}
