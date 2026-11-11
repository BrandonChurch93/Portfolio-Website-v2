import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { lathe } from './build';

// Outlines and parts for machined objects, in millimetres: rounded outlines and their offsets, bevelled slabs
// extruded along z with smooth normals that keep their flat faces flat, and slotted screws.

export type V = [number, number, number];
export type P2 = [number, number];

// Offsets a convex outline inward by d (its corner radii shrink by d).
export function inset(vs: V[], d: number): V[] {
  const n = vs.length;
  const lines = vs.map((a, i) => {
    const b = vs[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    const nx = -dy / l, ny = dx / l;
    return { px: a[0] + nx * d, py: a[1] + ny * d, dx: dx / l, dy: dy / l };
  });
  return vs.map((v, i) => {
    const l1 = lines[(i + n - 1) % n], l2 = lines[i];
    const den = l1.dx * l2.dy - l1.dy * l2.dx;
    const t = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / den;
    return [l1.px + l1.dx * t, l1.py + l1.dy * t, Math.max(0.2, v[2] - d)] as V;
  });
}

// A polygon with each corner rounded by its radius, as a dense list of points.
export function rounded(vs: V[]): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  const n = vs.length;
  for (let i = 0; i < n; i++) {
    const p = vs[i], a = vs[(i + n - 1) % n], b = vs[(i + 1) % n];
    const u1 = new THREE.Vector2(a[0] - p[0], a[1] - p[1]).normalize(), u2 = new THREE.Vector2(b[0] - p[0], b[1] - p[1]).normalize();
    const half = Math.acos(THREE.MathUtils.clamp(u1.dot(u2), -1, 1)) / 2;
    const r = p[2], t = r / Math.tan(half);
    const p1 = new THREE.Vector2(p[0], p[1]).addScaledVector(u1, t), p2 = new THREE.Vector2(p[0], p[1]).addScaledVector(u2, t);
    const c = new THREE.Vector2(p[0], p[1]).addScaledVector(u1.clone().add(u2).normalize(), r / Math.sin(half));
    const a1 = Math.atan2(p1.y - c.y, p1.x - c.x);
    let sw = Math.atan2(p2.y - c.y, p2.x - c.x) - a1;
    while (sw > Math.PI) sw -= 2 * Math.PI;
    while (sw < -Math.PI) sw += 2 * Math.PI;
    const steps = Math.max(3, Math.min(64, Math.ceil((Math.abs(sw) * r) / 0.45)));
    for (let k = 0; k <= steps; k++) { const q = a1 + (sw * k) / steps; out.push(new THREE.Vector2(c.x + Math.cos(q) * r, c.y + Math.sin(q) * r)); }
  }
  return out;
}

export const rrect = (cx: number, cy: number, w: number, h: number, r: number): V[] => [[cx - w / 2, cy - h / 2, r], [cx + w / 2, cy - h / 2, r], [cx + w / 2, cy + h / 2, r], [cx - w / 2, cy + h / 2, r]];
export const circle = (cx: number, cy: number, r: number, n = Math.max(24, Math.min(192, Math.ceil(r * 7)))) => Array.from({ length: n }, (_, i) => new THREE.Vector2(cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r));

// An extruded slab from z0 to z1 with a rounded bevel on both faces (the outline is its middle).
export function slab(outline: THREE.Vector2[], holes: THREE.Vector2[][], z0: number, z1: number, bev: number, segs = 3): THREE.BufferGeometry {
  const s = new THREE.Shape(outline);
  for (const h of holes) s.holes.push(new THREE.Path(h));
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, z1 - z0 - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: segs, curveSegments: 1 });
  g.translate(0, 0, z0 + bev);
  // Smooth across the facets of arcs and bevel steps; keep the edges where faces really meet. The flat faces keep
  // their own normal exactly: a long sliver of a face that shared a vertex with the bevel would otherwise fan the
  // bevel's tilt across the whole face.
  const out = toCreasedNormals(g, (40 * Math.PI) / 180);
  const p = out.getAttribute('position'), n = out.getAttribute('normal');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    const f = b.sub(a).cross(c.sub(a));
    if (f.lengthSq() === 0) continue;
    f.normalize();
    if (Math.abs(f.z) > 0.9995) for (let k = 0; k < 3; k++) n.setXYZ(i + k, 0, 0, Math.sign(f.z));
  }
  return out;
}

// A slotted screw head facing +z, radius r: a low dome, and a slot whose floor follows the dome.
export function screw(r: number): { head: THREE.BufferGeometry; slot: THREE.BufferGeometry } {
  const h = r * 0.42;
  const dome = (x: number) => h * Math.sqrt(Math.max(0, 1 - (x / r) ** 2)) * 0.85 + h * 0.15;
  const prof: P2[] = [[0, h]];
  for (let i = 1; i <= 8; i++) { const x = (r * i) / 8; prof.push([x, dome(x)]); }
  prof.push([r, 0]);
  const head = lathe(prof.slice().reverse(), 28);
  head.rotateX(Math.PI / 2);
  const slot = new THREE.BoxGeometry(r * 1.9, 1, r * 0.3, 12, 1, 1);
  const p = slot.getAttribute('position');
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) > 0 ? dome(x) + 0.03 : dome(x) - h * 0.55); }
  slot.computeVertexNormals();
  slot.rotateX(Math.PI / 2);
  return { head, slot };
}

