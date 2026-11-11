import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Geometry helpers and a builder that merges static parts per material, so a detailed piece stays a few dozen draw
// calls. Units are whatever the piece chooses (the city uses millimetres under a 0.001 scale).

export type Vec3 = [number, number, number];

// Hands the main thread back to the browser between the sections of a model build, so a frame can be drawn and input
// handled: a detailed piece takes a few hundred milliseconds to build, too long to hold a scrolling page still.
export const pause = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

export function xf(o: { p?: Vec3; r?: Vec3; s?: number | Vec3 } = {}): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.r ?? [0, 0, 0])));
  const s = typeof o.s === 'number' ? new THREE.Vector3(o.s, o.s, o.s) : new THREE.Vector3(...(o.s ?? [1, 1, 1]));
  return m.compose(new THREE.Vector3(...(o.p ?? [0, 0, 0])), q, s);
}

export const at = (x: number, y: number, z: number, r?: Vec3) => xf({ p: [x, y, z], r });

// Normalise a geometry to position, normal, uv (and the optional room cell attribute) so every part can be merged.
function clean(g: THREE.BufferGeometry, owned = false): THREE.BufferGeometry {
  let out = g.index ? g.toNonIndexed() : g;
  if (!out.getAttribute('normal')) out.computeVertexNormals();
  const n = out.getAttribute('position').count;
  if (!out.getAttribute('uv')) out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (!out.getAttribute('cell')) out.setAttribute('cell', new THREE.Float32BufferAttribute(new Float32Array(n * 4), 4));
  for (const name of Object.keys(out.attributes)) if (!['position', 'normal', 'uv', 'cell'].includes(name)) out.deleteAttribute(name);
  out.morphAttributes = {};
  if (out === g && !owned) out = g.clone();
  return out;
}

// Box projected uvs, in the geometry's units divided by tile, for textures that tile in world space.
export function boxUV(g: THREE.BufferGeometry, tile = 1): void {
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
}

export class Builder {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private shadowless = new Set<THREE.Material>();
  tris = 0;

  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4, opts: { shadow?: boolean; uv?: 'box' | 'keep'; tile?: number } = {}): void {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if ((opts.uv ?? 'keep') === 'box') boxUV(g, opts.tile ?? 1);
    g = clean(g, true);
    if (opts.shadow === false) this.shadowless.add(mat);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat)!.push(g);
    this.tris += g.getAttribute('position').count / 3;
  }

  // One mesh per material, added to the parent.
  build(parent: THREE.Object3D, name: string): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `${name}:${mat.name || mat.type}`;
      mesh.castShadow = !this.shadowless.has(mat);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
      out.push(mesh);
      for (const g of list) g.dispose();
    }
    this.parts.clear();
    return out;
  }
}

// A piece adds the same small rounded box hundreds of times (grip ribs, knurls, keys): each shape is made once and
// handed out as a copy, which is far cheaper than rounding a new box.
const boxes = new Map<string, THREE.BufferGeometry>();
export const rbox = (w: number, h: number, d: number, r = 0.6, seg = 2) => {
  const rr = Math.min(r, w / 2, h / 2, d / 2);
  const key = `${w}|${h}|${d}|${rr}|${seg}`;
  let g = boxes.get(key);
  if (!g) { g = new RoundedBoxGeometry(w, h, d, seg, rr); boxes.set(key, g); }
  return g.clone();
};
export const cyl = (r: number, h: number, seg = 32, rTop = r, open = false) => new THREE.CylinderGeometry(rTop, r, h, seg, 1, open);

export function lathe(pts: [number, number][], seg = 64): THREE.BufferGeometry {
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

// A flat ring in the xz plane at height y.
export function ring(r0: number, r1: number, y: number, seg = 128, a0 = 0, a1 = Math.PI * 2): THREE.BufferGeometry {
  const g = new THREE.RingGeometry(r0, r1, seg, 1, a0, a1 - a0);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

// An upright cylindrical wall, facing out.
export function wall(r: number, y0: number, y1: number, seg = 128): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg, 1, true);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

export interface Section { y: number; rx: number; rz: number; n?: number; twist?: number; ox?: number; oz?: number }

// Superellipse outline point: n 2 is an ellipse, higher is squarer.
function outline(s: Section, k: number, grow: number): [number, number] {
  const a = k * Math.PI * 2;
  const c = Math.cos(a), sn = Math.sin(a), e = 2 / (s.n ?? 2);
  const x = (s.rx + grow) * Math.sign(c) * Math.abs(c) ** e, z = (s.rz + grow) * Math.sign(sn) * Math.abs(sn) ** e;
  // Twist turns the whole outline about the section's centre.
  const tw = s.twist ?? 0, ct = Math.cos(tw), st = Math.sin(tw);
  return [x * ct - z * st + (s.ox ?? 0), x * st + z * ct + (s.oz ?? 0)];
}

export function interp(secs: Section[], y: number): Section {
  for (let i = 0; i < secs.length - 1; i++) {
    const a = secs[i], b = secs[i + 1];
    if (y >= a.y && y <= b.y) {
      const t = (y - a.y) / Math.max(1e-6, b.y - a.y);
      const l = (u: number | undefined, v: number | undefined, d: number) => (u ?? d) + ((v ?? d) - (u ?? d)) * t;
      return { y, rx: l(a.rx, b.rx, 0), rz: l(a.rz, b.rz, 0), n: l(a.n, b.n, 2), twist: l(a.twist, b.twist, 0), ox: l(a.ox, b.ox, 0), oz: l(a.oz, b.oz, 0) };
    }
  }
  return { ...secs[y < secs[0].y ? 0 : secs.length - 1], y };
}

// A loft through stacked sections. uv: u counts bays round the outline, v counts floors up it. The cell attribute
// carries the room size (bay width, floor height, room depth) and a seed, for the interior mapped facade.
export function loft(secs: Section[], seg: number, o: { grow?: number; cap?: boolean; bays?: number; floor?: number; depth?: number; seed?: number } = {}): THREE.BufferGeometry {
  const grow = o.grow ?? 0;
  const pos: number[] = [], uv: number[] = [], cell: number[] = [], idx: number[] = [];
  const bays = o.bays ?? seg, floor = o.floor ?? 12;
  // Bay width from the perimeter of the widest section.
  let per = 0;
  for (const s of secs) { let p = 0; let prev = outline(s, 0, grow); for (let i = 1; i <= seg; i++) { const q = outline(s, i / seg, grow); p += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; } per = Math.max(per, p); }
  const bayW = per / bays;
  secs.forEach((s) => {
    for (let i = 0; i <= seg; i++) {
      const [x, z] = outline(s, i / seg, grow);
      pos.push(x, s.y, z);
      uv.push((i / seg) * bays, (s.y - secs[0].y) / floor);
      cell.push(bayW, floor, o.depth ?? floor * 1.1, o.seed ?? 0);
    }
  });
  const W = seg + 1;
  for (let j = 0; j < secs.length - 1; j++) for (let i = 0; i < seg; i++) { const a = j * W + i; idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('cell', new THREE.Float32BufferAttribute(cell, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (!o.cap) return g;
  const top = secs[secs.length - 1];
  const capPts: THREE.Vector2[] = [];
  for (let i = 0; i < seg; i++) { const [x, z] = outline(top, i / seg, grow); capPts.push(new THREE.Vector2(x, -z)); }
  const cap = new THREE.ShapeGeometry(new THREE.Shape(capPts));
  cap.rotateX(-Math.PI / 2);
  cap.translate(0, top.y, 0);
  return mergeGeometries([clean(g), clean(cap)], false) ?? g;
}

// A thin plate following a section outline at height y: floor slabs, belts, setback ledges.
export function slab(s: Section, seg: number, thick: number, out: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < seg; i++) { const [x, z] = outline(s, i / seg, out); pts.push(new THREE.Vector2(x, -z)); }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: thick, bevelEnabled: true, bevelThickness: Math.min(0.4, thick * 0.3), bevelSize: Math.min(0.4, thick * 0.3), bevelSegments: 1, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, s.y - thick / 2, 0);
  return g;
}

// Vertical fins on the outline at fraction k, between sections.
export function fin(secs: Section[], k: number, depth: number, width: number): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  secs.forEach((s, j) => {
    const [x0, z0] = outline(s, k, 0), [x1, z1] = outline(s, k, depth);
    const tx = -(z1 - z0), tz = x1 - x0, l = Math.hypot(tx, tz) || 1;
    const ox = (tx / l) * width * 0.5, oz = (tz / l) * width * 0.5;
    pos.push(x0 - ox, s.y, z0 - oz, x1 - ox, s.y, z1 - oz, x1 + ox, s.y, z1 + oz, x0 + ox, s.y, z0 + oz);
    if (j > 0) { const a = (j - 1) * 4, b = j * 4; for (let e = 0; e < 4; e++) { const e2 = (e + 1) % 4; idx.push(a + e, b + e, a + e2, a + e2, b + e, b + e2); } }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
}
