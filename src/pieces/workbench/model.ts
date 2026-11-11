import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, at, cyl, lathe, rbox, seeded, xf } from '../../world/build';
import { crownMesh, dropsAt, dropsMaterial, fallStrip, riders, waterMaterial, waterStrip, type WaterRow } from '../../world/lightwater';
import { site } from '../../content/site';
import { anodised, leather, plaster, walnut } from './materials';

const KW = site.pieces.workbench.keys;
const KM = KW.mods;
import { MonitorScreen, TabletScreen, legendAtlas } from './screens';

// The workbench, in millimetres (the root is scaled by 0.001). The desk top is y = 0, the viewer sits at +z.
export const BENCH = { W: 1400, D: 680, T: 40, SCALE: 0.001, FRONT: 340 } as const;
const { W, D, T, FRONT } = BENCH;
const D2R = Math.PI / 180;

export interface Tool { name: string; group: THREE.Group; rest: THREE.Matrix4 }

export interface BenchModel {
  root: THREE.Group;
  tools: Tool[];
  monitor: MonitorScreen;
  tablet: TabletScreen;
  screens: THREE.MeshStandardMaterial[];
  wood: THREE.MeshPhysicalMaterial;
  water: THREE.ShaderMaterial[];
  drops: THREE.ShaderMaterial;
  ride: THREE.ShaderMaterial;
  waterLight: THREE.RectAreaLight;
  lampBulb: THREE.MeshBasicMaterial;
  // The water's path on the desk, mm: where it lands, where it pours, and how far along the route each is.
  // The water's path on the desk, mm: where it lands, where it pours, how far along the route each is, how high its
  // fall starts, and the pour's launch speed, time and gravity (so a page can find where it crosses the frame).
  waterPath: { land: THREE.Vector3; pour: THREE.Vector3; sLand: number; sPour: number; sEnd: number; fallTop: number; pourVx: number; pourT: number; g: number };
}

// A flat rounded slab: w along x, d along z, from y = 0 up to y = h, with a bevel.
function slab(w: number, d: number, r: number, h: number, bev = 0.8): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2); s.absarc(w / 2 - r, -d / 2 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(w / 2, d / 2 - r); s.absarc(w / 2 - r, d / 2 - r, r, 0, Math.PI / 2, false);
  s.lineTo(-w / 2 + r, d / 2); s.absarc(-w / 2 + r, d / 2 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-w / 2, -d / 2 + r); s.absarc(-w / 2 + r, -d / 2 + r, r, Math.PI, 1.5 * Math.PI, false);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, h - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 3, curveSegments: 14 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bev, 0);
  return g;
}

// Stacked superellipse outlines closed with a cap: shells such as the mouse.
type Sec = { y: number; a: number; b: number; n?: number; oz?: number };
function shell(secs: Sec[], seg = 72): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  for (const s of secs) for (let i = 0; i < seg; i++) {
    const t = (i / seg) * 2 * Math.PI, c = Math.cos(t), sn = Math.sin(t), e = 2 / (s.n ?? 2.5);
    pos.push(s.a * Math.sign(c) * Math.abs(c) ** e, s.y, (s.oz ?? 0) + s.b * Math.sign(sn) * Math.abs(sn) ** e);
  }
  for (let j = 0; j < secs.length - 1; j++) for (let i = 0; i < seg; i++) { const a = j * seg + i, b = j * seg + ((i + 1) % seg); idx.push(a, a + seg, b, b, a + seg, b + seg); }
  const top = secs[secs.length - 1], ci = pos.length / 3, base = (secs.length - 1) * seg;
  pos.push(0, top.y + 0.3, top.oz ?? 0);
  for (let i = 0; i < seg; i++) idx.push(base + i, ci, base + ((i + 1) % seg));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A screw head: a domed disc with a cross slot cut in.
function screw(r: number): THREE.BufferGeometry {
  const head = lathe([[0, 0.9], [r * 0.7, 0.75], [r, 0.3], [r, 0]], 20);
  const s1 = new THREE.BoxGeometry(r * 1.8, 0.4, r * 0.28); s1.translate(0, 0.85, 0);
  const s2 = new THREE.BoxGeometry(r * 0.28, 0.4, r * 1.8); s2.translate(0, 0.85, 0);
  return merged([head, s1, s2]);
}

function merged(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = list.map((g) => { const n = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.getAttribute('uv')) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.getAttribute('position').count * 2), 2)); if (!n.getAttribute('normal')) n.computeVertexNormals(); return n; });
  const out = mergeGeometries(clean, false);
  if (!out) throw new Error('merge failed');
  return out;
}

export function buildBench(): BenchModel {
  const r = seeded(6060);
  const root = new THREE.Group();
  root.scale.setScalar(BENCH.SCALE);
  const tools: Tool[] = [];
  const tool = (name: string, x: number, y: number, z: number, ry = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.rotation.y = ry * D2R;
    root.add(g);
    g.updateMatrix();
    tools.push({ name, group: g, rest: g.matrix.clone() });
    return g;
  };
  const P = (o: THREE.MeshPhysicalMaterialParameters, name: string) => { const m = new THREE.MeshPhysicalMaterial(o); m.name = name; return m; };

  // ---- materials ------------------------------------------------------------------------------------
  const wood = walnut(D / 3, FRONT);
  const brass = P({ color: 0xc89a55, metalness: 1, roughness: 0.32 }, 'brass');
  const brassWorn = P({ color: 0xb98c48, metalness: 1, roughness: 0.42 }, 'brassWorn');
  const plateBrass = anodised(0xa98245, 'plateBrass');
  const shadeBrass = anodised(0xb88f50, 'shadeBrass');
  const steel = P({ color: 0xc4c2be, metalness: 1, roughness: 0.3 }, 'steel');
  const caseDark = anodised(0x2a2826, 'caseDark');
  const caseMid = anodised(0x5b5753, 'caseMid');
  const ivory = P({ color: 0xcfc5b3, roughness: 0.55 }, 'ivory');
  const screwM = P({ color: 0x55504a, metalness: 1, roughness: 0.42 }, 'screw');
  const coal = P({ color: 0x2b2927, roughness: 0.55 }, 'coal');
  const amberCap = P({ color: 0xa8641f, roughness: 0.5 }, 'amberCap');
  const rubber = P({ color: 0x141312, roughness: 0.9 }, 'rubber');
  const hide = leather();
  const wall = plaster();
  const glassBlk = P({ color: 0x050505, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 }, 'glassBlk');
  // Coated glass you can see into: thin, glossy, a faint green and violet bloom from the coating.
  const lensGlass = P({ color: 0x1a2420, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.7, iridescenceIOR: 1.6, iridescenceThicknessRange: [220, 420], transparent: true, opacity: 0.42, depthWrite: false }, 'lensGlass');
  const thread = P({ color: 0xc89a5a, roughness: 0.6 }, 'thread');
  const cord = P({ color: 0x1d1a17, roughness: 0.7 }, 'cord');
  const glowAmber = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff9a38).multiplyScalar(2.2) });
  glowAmber.name = 'glowAmber';
  const lampBulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd2a0).multiplyScalar(2.4) });
  lampBulb.name = 'lampBulb';

  // ---- the room: a plaster wall with a wainscot rail, and a floor that fades into the page --------------
  {
    const b = new Builder();
    b.add(new THREE.PlaneGeometry(9000, 3000), wall, at(0, 300, -620));
    b.add(rbox(9000, 18, 14, 3), caseDark, at(0, 120, -612));
    b.add(rbox(9000, 70, 10, 3), wood, at(0, -705, -614));
    const floor = new THREE.PlaneGeometry(9000, 5000); floor.rotateX(-Math.PI / 2);
    b.add(floor, wall, at(0, -740, 500));
    for (const mesh of b.build(root, 'room')) mesh.userData.noWire = true;
  }

  // ---- the desk: three walnut boards, a bevelled edge, a brass inlay, an apron and legs --------------------
  {
    const b = new Builder();
    b.add(slab(W, D, 10, T, 3), wood, at(0, -T, 0));
    // Glue lines between the boards.
    for (const z of [-D / 6, D / 6]) b.add(new THREE.BoxGeometry(W - 8, 0.3, 0.5), coal, at(0, 0.02, z));
    b.add(rbox(W - 64, 4.5, 2, 0.8), brass, at(0, -20, FRONT + 0.3));
    b.add(rbox(W - 140, 90, 22, 4), wood, at(0, -T - 45, -D / 2 + 60));
    for (const [x, z] of [[-W / 2 + 70, -D / 2 + 70], [W / 2 - 70, -D / 2 + 70], [-W / 2 + 70, D / 2 - 70], [W / 2 - 70, D / 2 - 70]]) {
      b.add(rbox(56, 660, 56, 5), wood, at(x, -T - 330, z));
      b.add(cyl(30, 6, 32), brass, at(x, -T - 662, z));
    }
    b.add(rbox(W - 140, 70, 22, 4), wood, at(0, -T - 40, D / 2 - 70));
    b.build(root, 'desk');
  }

  // ---- the leather mat, with a stitched border ----------------------------------------------------------
  {
    const b = new Builder();
    const mw = 880, md = 350, mx = 150, mz = 122;
    b.add(slab(mw, md, 16, 3, 1), hide, at(mx, 0, mz));
    // Stitches: short slanted dashes all round, 4 mm in from the edge.
    const st = new THREE.CapsuleGeometry(0.35, 2.2, 2, 4); st.rotateZ(Math.PI / 2);
    const inset = 5, pitch = 4.2;
    const runs: [number, number, number, number][] = [[-mw / 2 + 16, -md / 2 + inset, mw / 2 - 16, -md / 2 + inset], [-mw / 2 + 16, md / 2 - inset, mw / 2 - 16, md / 2 - inset], [-mw / 2 + inset, -md / 2 + 16, -mw / 2 + inset, md / 2 - 16], [mw / 2 - inset, -md / 2 + 16, mw / 2 - inset, md / 2 - 16]];
    for (const [x0, z0, x1, z1] of runs) {
      const n = Math.floor(Math.hypot(x1 - x0, z1 - z0) / pitch);
      const ang = Math.atan2(z1 - z0, x1 - x0);
      for (let i = 0; i <= n; i++) { const k = i / n; b.add(st, thread, xf({ p: [mx + x0 + (x1 - x0) * k, 3.15, mz + z0 + (z1 - z0) * k], r: [0, -ang + 0.35, 0] }), { shadow: false }); }
    }
    for (let i = 0; i < 4; i++) { const ax = i % 2 ? 1 : -1, az = i < 2 ? -1 : 1; for (let j = 0; j < 7; j++) { const a = (j / 6) * (Math.PI / 2); const cx = mx + ax * (mw / 2 - 16), cz = mz + az * (md / 2 - 16); b.add(st, thread, xf({ p: [cx + ax * Math.cos(a) * (16 - inset), 3.15, cz + az * Math.sin(a) * (16 - inset)], r: [0, (ax * az > 0 ? -1 : 1) * a + 0.35, 0] }), { shadow: false }); } }
    b.build(root, 'mat');
  }

  // ---- the monitor --------------------------------------------------------------------------------------
  const monitor = new MonitorScreen();
  // Glossy black glass over the picture: it reflects the lamps.
  const monMat = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0xffffff, emissiveMap: monitor.texture, emissiveIntensity: 1, roughness: 0.34 });
  monMat.name = 'monitorScreen';
  {
    const g = tool('monitor', 40, 0, -215);
    const b = new Builder();
    b.add(slab(250, 190, 26, 9, 1.4), caseMid, at(0, 0, 10));
    b.add(rbox(46, 300, 14, 4), caseMid, xf({ p: [0, 152, -22], r: [-6 * D2R, 0, 0] }));
    b.add(cyl(9, 15, 24), caseDark, xf({ p: [0, 60, -14], r: [Math.PI / 2, 0, 0] }));
    b.add(rbox(120, 60, 20, 6), caseMid, at(0, 300, -12));
    const head = xf({ p: [0, 345, 8], r: [-4 * D2R, 0, 0] });
    b.add(rbox(724, 414, 12, 3), caseDark, xf({ p: [0, 0, -8] }).premultiply(head));
    b.add(rbox(320, 210, 26, 10), caseDark, xf({ p: [0, 0, -20] }).premultiply(head));
    b.add(rbox(717, 407, 2, 0.9), glassBlk, xf({ p: [0, 0, -1.3] }).premultiply(head));
    // Ports and vents on the back.
    for (let i = 0; i < 4; i++) b.add(rbox(12, 5, 4, 0.6), coal, xf({ p: [-60 + i * 22, -70, -34] }).premultiply(head));
    for (let i = 0; i < 2; i++) b.add(rbox(9, 9, 4, 1.2), coal, xf({ p: [40 + i * 18, -70, -34] }).premultiply(head));
    for (let i = 0; i < 18; i++) b.add(rbox(160, 2, 2, 0.5), coal, xf({ p: [0, 30 + i * 4.5 - 40, -33.4] }).premultiply(head));
    b.add(rbox(36, 3, 3, 1), glowAmber, xf({ p: [0, -211, -4] }).premultiply(head), { shadow: false });
    const scr = new THREE.PlaneGeometry(704, 396);
    b.add(scr, monMat, xf({ p: [0, 0, 0.35] }).premultiply(head), { shadow: false, uv: 'keep' });
    for (const mesh of b.build(g, 'monitor')) if (mesh.material === monMat) { mesh.receiveShadow = false; mesh.userData.noWire = true; }
  }

  // ---- the keyboard: a 75 percent layout with legends, an aluminium case and a brass knob -------------
  {
    const g = tool('keyboard', 20, 3, 190);
    const tilt = xf({ r: [5 * D2R, 0, 0] });
    const b = new Builder();
    const U = 19.05;
    b.add(slab(326, 136, 13, 19, 1.5), caseDark, xf({ p: [0, 0, -68] }).premultiply(tilt));
    b.add(rbox(298, 1.2, 110, 0.4), caseMid, xf({ p: [0, 11, -68] }).premultiply(tilt));
    for (const [x, z] of [[-156, -4], [156, -4], [-156, -132], [156, -132], [0, -132]]) b.add(screw(2.4), screwM, xf({ p: [x, 19, z] }).premultiply(tilt));
    b.add(rbox(60, 2.2, 1.4, 0.6), brass, xf({ p: [-118, 9, 0.4] }).premultiply(tilt));
    // Sculpted caps: tapered, dished on top.
    const capGeos = new Map<number, THREE.BufferGeometry>();
    const capGeo = (wu: number) => {
      if (!capGeos.has(wu)) {
        const w = wu * U - 1.1, h = 8.6, d = U - 1.1, cg = new RoundedBoxGeometry(w, h, d, 3, 2.0), p = cg.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const t = (p.getY(i) + h / 2) / h;
          let x = p.getX(i) * (1 - (4.6 / w) * t), z = p.getZ(i) * (1 - (4.2 / d) * t) - 0.6 * t, y = p.getY(i);
          if (t > 0.97) y -= 0.55 * (1 - (2 * z / (d - 4.2)) ** 2);
          p.setXYZ(i, x, y, z);
        }
        cg.computeVertexNormals();
        capGeos.set(wu, cg);
      }
      return capGeos.get(wu)!;
    };
    type K = [number, string, string];
    const k = (w: number, c: string, l: string): K => [w, c, l];
    const rows: K[][] = [
      [k(1, 'a', KW.f[0]), ...KW.f.slice(1, 13).map((s) => k(1, 'c', s)), k(1, 'c', KW.f[13])],
      [...'`1234567890-='.split('').map((s) => k(1, 'i', s)), k(2, 'c', KM.back), k(1, 'c', KM.home)],
      [k(1.5, 'c', KM.tab), ...'QWERTYUIOP[]'.split('').map((s) => k(1, 'i', s)), k(1.5, 'i', '\\'), k(1, 'c', KM.pgup)],
      [k(1.75, 'c', KM.caps), ...'ASDFGHJKL;\''.split('').map((s) => k(1, 'i', s)), k(2.25, 'a', KM.enter), k(1, 'c', KM.pgdn)],
      [k(2.25, 'c', KM.shift), ...'ZXCVBNM,./'.split('').map((s) => k(1, 'i', s)), k(1.75, 'c', KM.shift), k(1, 'c', KM.up), k(1, 'c', KM.end)],
      [k(1.25, 'c', KM.ctrl), k(1.25, 'c', KM.alt), k(1.25, 'c', KM.fn), k(6.25, 'i', ''), k(1, 'c', KM.alt), k(1, 'c', KM.fn), k(1, 'c', KM.ctrl), k(1, 'c', KM.left), k(1, 'c', KM.down), k(1, 'c', KM.right)],
    ];
    const labels: string[] = [];
    for (const row of rows) for (const [, , l] of row) if (l && !labels.includes(l)) labels.push(l);
    const atlas = legendAtlas(labels);
    const legendDark = new THREE.MeshStandardMaterial({ color: 0x2a2420, map: atlas.texture, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
    legendDark.name = 'legendDark';
    const legendLight = new THREE.MeshStandardMaterial({ color: 0xe8dcc6, map: atlas.texture, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
    legendLight.name = 'legendLight';
    const capM: Record<string, THREE.Material> = { i: ivory, c: coal, a: amberCap };
    const lift = [1.4, 0.9, 0.3, 0, 0.3, 0.9], rowTilt = [7, 5, 2, -1, -4, -6];
    rows.forEach((row, ri) => {
      let x = -8 * U;
      for (const [w, c, l] of row) {
        const at2 = xf({ p: [x + (w * U) / 2, 24.6 + lift[ri], -68 - 2.5 * U + ri * U], r: [rowTilt[ri] * D2R, 0, 0] }).premultiply(tilt);
        b.add(capGeo(w), capM[c], at2);
        if (l) {
          const [u0, v0, du, dv] = atlas.cell(labels.indexOf(l));
          const pl = new THREE.PlaneGeometry(11, 11); pl.rotateX(-Math.PI / 2);
          const uv = pl.getAttribute('uv');
          for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
          pl.translate(-w * U / 2 + 9.2, 4.45, -0.6);
          b.add(pl, c === 'i' ? legendDark : legendLight, at2, { uv: 'keep', shadow: false });
        }
        x += w * U;
      }
    });
    // The knob: knurled brass on a brass collar.
    const kx = 7.5 * U, kz = -68 - 2.5 * U;
    b.add(cyl(12.4, 13, 64), brass, xf({ p: [kx, 27, kz] }).premultiply(tilt));
    b.add(cyl(10.2, 1.2, 64), brassWorn, xf({ p: [kx, 34.1, kz] }).premultiply(tilt));
    for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; b.add(rbox(0.9, 9.5, 0.9, 0.2), brassWorn, xf({ p: [kx + Math.sin(a) * 12.5, 26.5, kz + Math.cos(a) * 12.5], r: [0, a, 0] }).premultiply(tilt)); }
    b.build(g, 'keyboard');
    // A coiled cable that sags to the desk and runs off behind.
    const cb = new Builder();
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 160; i++) {
      const t = i / 160, coil = t > 0.12 && t < 0.42 ? 1 : 0;
      const bx = -70 - t * 260, bz = -138 - t * 300;
      const by = Math.max(0.0, 13 - t * 60) + 2.4;
      const ca = t * 160;
      pts.push(new THREE.Vector3(bx + coil * Math.cos(ca) * 5, by + coil * (Math.sin(ca) * 5 + 4), bz));
    }
    cb.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 600, 1.8, 8), cord);
    cb.build(g, 'cable');
  }

  // ---- the mouse --------------------------------------------------------------------------------------
  {
    const g = tool('mouse', 318, 3, 135, 9);
    const b = new Builder();
    const body = shell([{ y: 0.4, a: 29, b: 59, n: 2.7 }, { y: 5, a: 32, b: 62, n: 2.7 }, { y: 15, a: 32.5, b: 62.5, n: 2.6, oz: 1 }, { y: 25, a: 30, b: 58, oz: 4 }, { y: 32, a: 25, b: 49, oz: 8 }, { y: 36.5, a: 17, b: 35, oz: 11 }, { y: 38.6, a: 8, b: 17, oz: 13 }]);
    b.add(body, ivory);
    b.add(shell([{ y: 0, a: 28, b: 58, n: 2.7 }, { y: 3, a: 31.5, b: 61.5, n: 2.7 }]), rubber);
    // Seams found on the shell itself: a ray down onto the top surface for every point of each seam.
    const probe = new THREE.Mesh(body, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const rc = new THREE.Raycaster();
    const onTop = (x: number, z: number) => { rc.set(new THREE.Vector3(x, 80, z), new THREE.Vector3(0, -1, 0)); const h = rc.intersectObject(probe)[0]; return h ? h.point.y : 0; };
    const seam = (pts: [number, number][]) => b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, onTop(x, z) + 0.05, z))), 64, 0.42, 6), coal, undefined, { shadow: false });
    // The split between the two buttons, either side of the wheel, and where the buttons end across the back.
    seam([[0, -58], [0, -44]]);
    seam([[0, -12], [0, -2]]);
    const back: [number, number][] = []; for (let i = 0; i <= 20; i++) { const x = -26 + (52 * i) / 20; back.push([x, -2 - 6 * (1 - (x / 26) ** 2)]); } seam(back);
    // The wheel in its well, with a brass ring round the well.
    b.add(rbox(13, 4, 30, 3), coal, at(0, onTop(0, -28) - 2.4, -28));
    b.add(cyl(9.2, 7, 40), rubber, xf({ p: [0, onTop(0, -28) - 4.2, -28], r: [0, 0, Math.PI / 2] }));
    for (let i = 0; i < 30; i++) { const ang = (i / 30) * Math.PI * 2; b.add(rbox(7.2, 0.7, 0.7, 0.2), coal, xf({ p: [0, onTop(0, -28) - 4.2 + Math.sin(ang) * 9.3, -28 + Math.cos(ang) * 9.3] })); }
    // Two thumb buttons and a grip band on the left side.
    for (const z of [-22, -4]) b.add(rbox(3, 7, 15, 2.5), coal, xf({ p: [-32.6, 18, z], r: [0, 0, 0.12] }));
    b.build(g, 'mouse');
  }

  // ---- the tablet on its fold stand, and the stylus ---------------------------------------------------
  const tablet = new TabletScreen();
  const tabMat = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0xffffff, emissiveMap: tablet.texture, emissiveIntensity: 0.9, roughness: 0.75 });
  tabMat.name = 'tabletScreen';
  {
    const g = tool('tablet', -425, 0, 100, 22);
    const b = new Builder();
    const lean = xf({ p: [0, 1.2, 108], r: [24 * D2R, 0, 0] });
    b.add(slab(290, 222, 14, 8, 1.2), caseDark, xf({ p: [0, 0, -107.5] }).premultiply(lean));
    b.add(slab(292, 224, 15, 1.6, 0.6), caseDark, xf({ p: [0, 6.6, -107.5] }).premultiply(lean));
    b.add(slab(270, 202, 8, 0.5, 0), glassBlk, xf({ p: [0, 8.1, -107.5] }).premultiply(lean));
    const sp = new THREE.PlaneGeometry(250, 187.5); sp.rotateX(-Math.PI / 2);
    b.add(sp, tabMat, xf({ p: [0, 8.65, -107.5] }).premultiply(lean), { shadow: false, uv: 'keep' });
    // The fold stand: two leaves of leather on brass hinges.
    b.add(rbox(200, 96, 4, 1.6), hide, xf({ p: [0, 45, -99], r: [-16 * D2R, 0, 0] }));
    b.add(slab(240, 60, 8, 3, 0.8), hide, at(0, 0, -108));
    for (const x of [-80, 80]) b.add(cyl(2.6, 18, 16), brass, xf({ p: [x, 3, -78], r: [0, 0, Math.PI / 2] }));
    for (const mesh of b.build(g, 'tablet')) if (mesh.material === tabMat) { mesh.receiveShadow = false; mesh.userData.noWire = true; }
    const pen = new Builder();
    const pm = xf({ p: [205, 4.5, 30], r: [0, 68 * D2R, 0] });
    pen.add(cyl(4.45, 150, 28), ivory, xf({ r: [0, 0, Math.PI / 2] }).premultiply(pm));
    pen.add(new THREE.ConeGeometry(4.45, 15, 28), ivory, xf({ p: [82.5, 0, 0], r: [0, 0, -Math.PI / 2] }).premultiply(pm));
    pen.add(cyl(1.2, 4, 12), coal, xf({ p: [91, 0, 0], r: [0, 0, Math.PI / 2] }).premultiply(pm));
    pen.add(cyl(4.55, 6, 28), brass, xf({ p: [-52, 0, 0], r: [0, 0, Math.PI / 2] }).premultiply(pm));
    pen.add(rbox(14, 1.2, 2.4, 0.4), brass, xf({ p: [-40, 4.6, 0] }).premultiply(pm));
    pen.build(g, 'stylus');
  }

  // ---- the camera: an invented body with a brass top plate, a lens, a spare lens and a cap -------------
  const lens = (b: Builder, M: THREE.Matrix4) => {
    b.add(lathe([[30, 0], [31.5, 2], [31.5, 14], [34, 16], [34, 44], [35.5, 46], [35.5, 58], [33.5, 60], [33.5, 78], [36, 80], [38, 92], [38, 99], [36.2, 100], [35.6, 96.5], [32, 96], [31, 91], [27.6, 89]], 96), caseDark, M);
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; b.add(rbox(1.9, 26, 1.3, 0.3), rubber, xf({ p: [Math.sin(a) * 34.3, 30, Math.cos(a) * 34.3], r: [0, a, 0] }).premultiply(M)); }
    for (let i = 0; i < 90; i++) { const a = (i / 90) * Math.PI * 2; b.add(rbox(0.9, 16, 0.9, 0.2), rubber, xf({ p: [Math.sin(a) * 33.8, 69, Math.cos(a) * 33.8], r: [0, a, 0] }).premultiply(M)); }
    b.add(new THREE.TorusGeometry(36.5, 0.75, 10, 96).rotateX(Math.PI / 2), brass, xf({ p: [0, 81, 0] }).premultiply(M));
    b.add(new THREE.TorusGeometry(31.8, 0.5, 8, 96).rotateX(Math.PI / 2), steel, xf({ p: [0, 14.6, 0] }).premultiply(M));
    // Distance scale: small brass ticks.
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 0.9 - 0.4; b.add(rbox(0.5, 3 + (i % 3 === 0 ? 2 : 0), 0.3, 0.1), brass, xf({ p: [Math.sin(a) * 35.7, 52, Math.cos(a) * 35.7], r: [0, a, 0] }).premultiply(M), { shadow: false }); }
    const th = Math.asin(27.6 / 62);
    b.add(new THREE.SphereGeometry(62, 56, 18, 0, Math.PI * 2, 0, th), lensGlass, xf({ p: [0, 89 - 62 * Math.cos(th), 0] }).premultiply(M));
    b.add(new THREE.TorusGeometry(24, 0.5, 6, 64).rotateX(Math.PI / 2), coal, xf({ p: [0, 86, 0] }).premultiply(M));
    // Inside the front element: a black baffle, a second smaller element and the iris blades.
    b.add(lathe([[27, 88], [22, 80], [14, 70], [13, 68]], 64), coal, M);
    const th2 = Math.asin(14 / 30);
    b.add(new THREE.SphereGeometry(30, 40, 12, 0, Math.PI * 2, 0, th2), lensGlass, xf({ p: [0, 72 - 30 * Math.cos(th2), 0] }).premultiply(M));
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; b.add(rbox(9, 0.4, 5, 0.2), caseDark, xf({ p: [Math.sin(a) * 9, 66, Math.cos(a) * 9], r: [0.2, a, 0] }).premultiply(M), { shadow: false }); }
  };
  {
    const g = tool('camera', 492, 3, 96, -36);
    const b = new Builder();
    b.add(rbox(134, 62, 40, 6), caseDark, at(0, 31, 0));
    b.add(rbox(136, 14, 42, 3), plateBrass, at(0, 67, 0));
    // Two finder windows and a frame lines window on the front of the top plate, a self timer lever.
    for (const [x, w] of [[-44, 16], [40, 20], [8, 9]] as [number, number][]) { b.add(rbox(w, 8, 1.4, 1.2), glassBlk, at(x, 67, 21.2)); b.add(rbox(w + 3, 11, 0.8, 1.6), caseDark, at(x, 67, 20.9)); }
    b.add(rbox(4, 16, 3, 1.2), plateBrass, xf({ p: [-34, 48, 21.5], r: [0, 0, 0.4] }));
    b.add(cyl(4, 3, 24), plateBrass, xf({ p: [48, 18, 21.6], r: [Math.PI / 2, 0, 0] }));
    b.add(cyl(2.6, 2, 16), coal, xf({ p: [56, 46, 21.4], r: [Math.PI / 2, 0, 0] }));
    for (let i = 0; i < 6; i++) b.add(rbox(14, 0.6, 0.6, 0.2), coal, at(48, 30 + i * 2.2, 21.9));
    b.add(rbox(86, 44, 2.4, 1.2), hide, at(16, 31, 20.8));
    b.add(rbox(34, 58, 36, 12), hide, at(-52, 31, 16));
    b.add(rbox(48, 22, 40, 6), caseDark, at(6, 84, -2));
    b.add(rbox(20, 2.4, 20, 0.7), steel, at(6, 95.6, 1));
    b.add(rbox(34, 22, 8, 4), rubber, at(6, 82, -24));
    const dial = (x: number, z: number, rr: number, h: number) => {
      b.add(cyl(rr, h, 48), caseDark, at(x, 74 + h / 2, z));
      for (let i = 0; i < Math.round(rr * 5); i++) { const a = (i / Math.round(rr * 5)) * Math.PI * 2; b.add(rbox(0.8, h * 0.7, 0.8, 0.2), steel, xf({ p: [x + Math.sin(a) * (rr + 0.1), 74 + h / 2, z + Math.cos(a) * (rr + 0.1)], r: [0, a, 0] })); }
      b.add(cyl(rr * 0.72, 0.8, 48), brass, at(x, 74 + h + 0.2, z));
    };
    dial(47, 2, 12.5, 9); dial(-24, -8, 9.5, 7);
    b.add(cyl(8.5, 2.4, 40), steel, at(-53, 75.4, 26)); b.add(cyl(5.6, 3.4, 40), brass, at(-53, 77.6, 26));
    for (const [x, z] of [[-60, -18], [60, -18], [-60, 18], [60, 18]]) b.add(screw(1.6), screwM, at(x, 74, z));
    b.add(cyl(1.6, 0.6, 16), caseDark, xf({ p: [-50, 54, 20.6], r: [Math.PI / 2, 0, 0] }));
    b.add(cyl(33, 5, 72), steel, xf({ p: [6, 33, 22], r: [Math.PI / 2, 0, 0] }));
    lens(b, xf({ p: [6, 33, 23], r: [Math.PI / 2, 0, 0] }));
    for (const x of [-64, 64]) b.add(new THREE.TorusGeometry(4, 1, 8, 24), steel, xf({ p: [x, 62, 0], r: [0, Math.PI / 2, 0] }));
    b.build(g, 'camera');
    const spare = tool('lens', 612, 0, -116);
    const sb = new Builder();
    lens(sb, new THREE.Matrix4());
    sb.build(spare, 'lens');
    const cap = tool('cap', 404, 3, 236);
    const cb = new Builder();
    cb.add(cyl(39, 5.5, 72), caseDark, at(0, 2.75, 0));
    cb.add(cyl(30, 0.8, 72), hide, at(0, 5.7, 0));
    cb.add(new THREE.TorusGeometry(38.4, 0.6, 8, 72).rotateX(Math.PI / 2), brassWorn, at(0, 5.4, 0));
    cb.build(cap, 'cap');
  }

  // ---- the brass lamp: weighted base, two arm sections with knuckles, a cone shade with a rolled rim ------
  {
    const g = tool('lamp', -612, 0, -212);
    const b = new Builder();
    b.add(lathe([[0, 0], [88, 0], [90, 2], [90, 9], [84, 13], [22, 15.5], [10, 24], [7, 31]], 96), brass);
    b.add(new THREE.TorusGeometry(86, 0.8, 8, 96).rotateX(Math.PI / 2), brassWorn, at(0, 9.5, 0));
    b.add(cyl(6, 18, 24), brassWorn, at(0, 34, 0));
    const lower = new THREE.CatmullRomCurve3([[0, 40, 0], [0, 230, 0], [4, 300, 6]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    b.add(new THREE.TubeGeometry(lower, 60, 5.5, 18), brass);
    b.add(new THREE.SphereGeometry(10, 24, 16), brassWorn, at(4, 304, 6));
    b.add(cyl(5, 26, 24), brass, xf({ p: [4, 304, 6], r: [0, 0, Math.PI / 2] }));
    for (const s of [-1, 1]) b.add(cyl(7, 4, 24), brassWorn, xf({ p: [4 + s * 15, 304, 6], r: [0, 0, Math.PI / 2] }));
    const upper = new THREE.CatmullRomCurve3([[4, 304, 6], [40, 420, 46], [100, 486, 112], [170, 490, 182]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    b.add(new THREE.TubeGeometry(upper, 70, 4.5, 18), brass);
    b.add(new THREE.SphereGeometry(8, 20, 14), brassWorn, at(176, 488, 188));
    const shade = xf({ p: [190, 482, 196], r: [18 * D2R, 0, -14 * D2R] });
    b.add(lathe([[79, -80], [80, -78], [79, -76], [62, -52], [32, -20], [15, -6], [10, 0], [0, 2]], 96), shadeBrass, shade);
    const inner = lathe([[76, -78], [60, -53], [30, -21], [13, -7], [8, -1], [0, 0.5]], 96);
    const innerM = P({ color: 0xf2e6cf, roughness: 0.5, side: THREE.BackSide }, 'shadeInner');
    b.add(inner, innerM, shade);
    b.add(new THREE.TorusGeometry(79.5, 1.6, 10, 96).rotateX(Math.PI / 2), brassWorn, xf({ p: [0, -78.5, 0] }).premultiply(shade));
    // The spinning seam, a ring of vent holes near the top, the switch on the knuckle.
    { const sg = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(79.6, -77.5, 0), new THREE.Vector3(15.5, -6.5, 0)), 1, 0.45, 5); b.add(sg, brassWorn, xf({ r: [0, 1.2, 0] }).premultiply(shade)); }
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; b.add(cyl(1.3, 2, 10), coal, xf({ p: [Math.sin(a) * 22, -16, Math.cos(a) * 22], r: [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9] }).premultiply(shade), { shadow: false }); }
    b.add(new THREE.TorusGeometry(15.5, 1.1, 8, 48).rotateX(Math.PI / 2), brassWorn, xf({ p: [0, -6.5, 0] }).premultiply(shade));
    b.add(cyl(4, 12, 20), brassWorn, xf({ p: [0, 6, 0] }).premultiply(shade));
    b.add(rbox(3, 9, 3, 1), coal, xf({ p: [0, 13, 4], r: [0.5, 0, 0] }).premultiply(shade));
    b.add(new THREE.SphereGeometry(24, 24, 16), lampBulb, xf({ p: [0, -42, 0] }).premultiply(shade), { shadow: false });
    b.build(g, 'lamp');
    // The cord from the base, off the back of the desk.
    const cb = new Builder();
    const pts = [[-40, 3, -60], [-90, 1.5, -150], [-60, 1.5, -230], [-20, 1.2, -330], [10, -10, -350], [12, -120, -360]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    cb.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 2.2, 10), cord);
    cb.build(g, 'cord');
  }

  // ---- the water on the desk: it falls in from above, lands on the front left corner, runs the front edge as a
  // sheet over the brass inlay, and pours off the front right corner ------------------------------------------
  const G = 2600, VRUN = 240, LIFTIN = 2400;
  const land = new THREE.Vector3(-W / 2 + 26, 0.6, FRONT - 14);
  const pour = new THREE.Vector3(W / 2 - 10, 0.6, FRONT - 14);
  const waterRun = waterMaterial(0.62);
  const waterFall = waterMaterial(0.85, true);
  const water = [waterRun, waterFall];
  let s = 0, f = 0;
  {
    // The arriving fall: straight down onto the corner.
    const rows: WaterRow[] = [];
    const tIn = Math.sqrt((2 * LIFTIN) / G);
    for (let j = 0; j <= 40; j++) { const t = (j / 40) * tIn, d = 0.5 * G * t * t; rows.push({ c: new THREE.Vector3(land.x - 6, land.y + LIFTIN - d, land.z + 4), side: new THREE.Vector3(1, 0, 0), w: 26 * Math.max(0.6, Math.sqrt(1 / (1 + G * t / 300))), s: s + d, f: f + t, d: 20, seed: 1 }); }
    s += LIFTIN; f += tIn;
    const fm = new THREE.Mesh(fallStrip(rows), waterFall);
    fm.frustumCulled = false; fm.userData.noWire = true;
    root.add(fm);
  }
  const sLand = s;
  {
    // The sheet along the front edge: widest just after the landing, settling to a steady run.
    const rows: WaterRow[] = [];
    const len = pour.x - land.x;
    for (let x = 0; x <= len; x += 6) {
      const k = x / len, w = 18 + 24 * Math.exp(-x / 60);
      rows.push({ c: new THREE.Vector3(land.x + x, 0.5, FRONT - 3 - w / 2), side: new THREE.Vector3(0, 0, 1), w, s: s + x, f: f + x / VRUN, seed: 2 + k });
    }
    s += len; f += len / VRUN;
    const rm = new THREE.Mesh(waterStrip(rows, 8), waterRun);
    rm.frustumCulled = false; rm.userData.noWire = true;
    root.add(rm);
  }
  const sPour = s;
  {
    // Over the corner and down: it leaves along the edge, then falls free past the leg and out of frame.
    const rows: WaterRow[] = [];
    const vx = VRUN * 0.55, tOut = 1.1;
    for (let j = 0; j <= 50; j++) { const t = (j / 50) * tOut, d = 0.5 * G * t * t; rows.push({ c: new THREE.Vector3(pour.x + 4 + vx * t, 0.6 - d, FRONT - 8 + 60 * t), side: new THREE.Vector3(1, 0, 0), w: 30 * Math.max(0.55, Math.sqrt(VRUN / (VRUN + G * t))), s: s + vx * t + d, f: f + t, d, seed: 5 }); }
    const fm = new THREE.Mesh(fallStrip(rows), waterFall);
    fm.frustumCulled = false; fm.userData.noWire = true;
    root.add(fm);
    s += vx * tOut + 0.5 * G * tOut * tOut;
  }
  const drops = dropsMaterial(G * 0.35);
  const dp = dropsAt([land.clone().add(new THREE.Vector3(-4, 1, 2)), pour.clone().add(new THREE.Vector3(8, -2, 4))], 140, 22, [1.4, 3.0], r);
  dp.material = drops;
  root.add(dp);
  const ride = riders(new THREE.Vector3(land.x + 10, 0.6, FRONT - 16), new THREE.Vector3(pour.x, 0.6, FRONT - 16), new THREE.Vector3(0, 0, 1), 22, sLand, VRUN, 70, r);
  root.add(ride);
  const crown = crownMesh(30, 10, 18, 7, sLand);
  (crown.material as THREE.ShaderMaterial).userData.gain = 0.55;
  crown.position.copy(land).add(new THREE.Vector3(0, -0.2, 0));
  root.add(crown);
  const pourCrown = crownMesh(18, 6, 14, 11, sPour);
  pourCrown.position.set(pour.x + 6, 0.5, pour.z);
  pourCrown.scale.set(1, 0.6, 1);
  root.add(pourCrown);
  // The water's light on the wood around it: a long low panel of amber along the front edge.
  const waterLight = new THREE.RectAreaLight(0xff8a26, 0, (W - 60) * BENCH.SCALE, 0.05);
  waterLight.position.set(0, 0.012, (FRONT - 10) * BENCH.SCALE);
  waterLight.lookAt(0, 0.012, (FRONT - 400) * BENCH.SCALE);

  return { root, tools, monitor, tablet, screens: [monMat, tabMat], wood, water: [...water, crown.material as THREE.ShaderMaterial, pourCrown.material as THREE.ShaderMaterial], drops, ride: ride.material as THREE.ShaderMaterial, waterLight, lampBulb, waterPath: { land, pour, sLand, sPour, sEnd: s, fallTop: LIFTIN, pourVx: VRUN * 0.55, pourT: 0.75, g: G } };
}
