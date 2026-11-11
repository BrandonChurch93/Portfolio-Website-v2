// Skills workbench, rough draft. Units are millimetres, the desk top is y = 0 and the viewer sits at +z.
// Every tool belongs to a group, and each group has its own lights so the page can light one tool at a time.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const D = Math.PI / 180, MM = 0.001;
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function tex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const rb = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 4, r);
const cyl = (r: number, h: number, seg = 48, rTop = r) => new THREE.CylinderGeometry(rTop, r, h, seg);
const lathe = (pts: number[][], seg = 96) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
/** A rounded slab lying flat: w along x, d along z, from y = 0 up to y = h. */
function slab(w: number, d: number, r: number, h: number, bev = 0.8) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2); s.absarc(w / 2 - r, -d / 2 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(w / 2, d / 2 - r); s.absarc(w / 2 - r, d / 2 - r, r, 0, Math.PI / 2, false);
  s.lineTo(-w / 2 + r, d / 2); s.absarc(-w / 2 + r, d / 2 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-w / 2, -d / 2 + r); s.absarc(-w / 2 + r, -d / 2 + r, r, Math.PI, 1.5 * Math.PI, false);
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * bev, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 3, curveSegments: 14 });
  g.rotateX(-Math.PI / 2); g.translate(0, bev, 0);
  return g;
}
type Sec = { y: number; a: number; b: number; n?: number; oz?: number };
/** Stacked outlines, each a superellipse a wide and b long, closed with a cap. */
function loft(secs: Sec[], seg = 72) {
  const pos: number[] = [], idx: number[] = [];
  for (const s of secs) for (let i = 0; i < seg; i++) {
    const t = (i / seg) * 2 * Math.PI, c = Math.cos(t), sn = Math.sin(t), e = 2 / (s.n ?? 2.5);
    pos.push(s.a * Math.sign(c) * Math.abs(c) ** e, s.y, (s.oz ?? 0) + s.b * Math.sign(sn) * Math.abs(sn) ** e);
  }
  for (let j = 0; j < secs.length - 1; j++) for (let i = 0; i < seg; i++) { const a = j * seg + i, b = j * seg + ((i + 1) % seg); idx.push(a, a + seg, b, b, a + seg, b + seg); }
  const top = secs[secs.length - 1]!, ci = pos.length / 3, base = (secs.length - 1) * seg;
  pos.push(0, top.y + 0.4, top.oz ?? 0);
  for (let i = 0; i < seg; i++) idx.push(base + i, ci, base + ((i + 1) % seg));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ---------- pictures ----------
const woodTex = tex(2048, 1024, (c, w, h) => {
  c.fillStyle = '#2c1e16'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 16; i++) { const y = rnd() * h, g = c.createLinearGradient(0, y - 60, 0, y + 60); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, rnd() < 0.55 ? 'rgba(0,0,0,0.26)' : 'rgba(150,98,58,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, y - 60, w, 120); }
  for (let i = 0; i < 1700; i++) {
    const y = rnd() * h, a = 0.03 + rnd() * 0.13, k = (rnd() - 0.5) * 30;
    c.strokeStyle = rnd() < 0.5 ? `rgba(132,92,60,${a})` : `rgba(8,5,3,${a * 1.7})`; c.lineWidth = 0.5 + rnd() * 2.2;
    c.beginPath(); c.moveTo(-20, y); c.bezierCurveTo(w * 0.3, y + k, w * 0.7, y - k * 0.6 + (rnd() - 0.5) * 12, w + 20, y + (rnd() - 0.5) * 20); c.stroke();
  }
});
woodTex.repeat.set(1 / 1400, 1 / 680); woodTex.offset.set(0.5, 0.5);
const grain = (rep: number) => { const t = tex(256, 256, (c, w, h) => { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (let i = 0; i < 5200; i++) { const v = 90 + rnd() * 90; c.fillStyle = `rgb(${v},${v},${v})`; c.beginPath(); c.arc(rnd() * w, rnd() * h, 0.7 + rnd() * 1.6, 0, 7); c.fill(); } }, false); t.repeat.set(rep, rep); return t; };
const MONO = '"DejaVu Sans Mono", "Liberation Mono", monospace';
const CODE = [
  '// the hero: a city that builds itself',
  'export function buildCity(stage: Stage) {',
  '  const disc = terraces({ radius: 456, levels: 4 });',
  '  const spire = tower({ height: 462, legs: 5 });',
  '  const water = lightWater(CANALS, { flow: 1.35 });',
  '',
  '  for (const lot of disc.lots) {',
  '    lot.raise(facade(lot, { glass: 0.82 }));',
  '  }',
  '',
  '  stage.onScroll((t) => {',
  '    water.pour(t);          // off the rim, down the page',
  '    spire.beacon(t > 0.9);',
  '  });',
  '',
  '  return { disc, spire, water };',
  '}',
];
function codeLine(c: CanvasRenderingContext2D, s: string, x: number, y: number) {
  const re = /(\/\/.*$|'[^']*'|\b(?:const|export|function|return|for|of|new)\b|\b\d+(?:\.\d+)?\b)/g;
  let last = 0, m: RegExpExecArray | null;
  const out = (t: string, col: string) => { c.fillStyle = col; c.fillText(t, x, y); x += c.measureText(t).width; };
  while ((m = re.exec(s))) {
    out(s.slice(last, m.index), '#e9e2d6');
    const t = m[0]; out(t, t.startsWith('//') ? '#7d7469' : /^\d/.test(t) ? '#ffc98f' : t.startsWith("'") ? '#f1d9b0' : '#ff9a38');
    last = m.index + t.length;
  }
  out(s.slice(last), '#e9e2d6');
}
const monTex = tex(2048, 1152, (c, w, h) => {
  c.fillStyle = '#0c0b0a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#161412'; c.fillRect(0, 0, w, 60);
  ['#ff9a38', '#6b6259', '#6b6259'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(40 + i * 34, 30, 9, 0, 7); c.fill(); });
  c.font = `500 24px ${MONO}`; c.fillStyle = '#b8afa4'; c.fillText('city.ts', 190, 39); c.fillStyle = '#6b6259'; c.fillText('water.ts      stage.ts', 330, 39);
  c.fillStyle = '#ff9a38'; c.fillRect(170, 56, 150, 4);
  c.font = `500 33px ${MONO}`;
  CODE.forEach((s, i) => { const y = 136 + i * 54; c.fillStyle = '#4d463f'; c.fillText(String(i + 1).padStart(2, ' '), 46, y); codeLine(c, s, 130, y); });
  // the viewport on the right: the city as a wire model
  const px = 1210, py = 96, pw = w - px - 36, ph = h - py - 150, cx = px + pw / 2, cy = py + ph * 0.6;
  c.fillStyle = '#100e0d'; c.strokeStyle = '#2b2622'; c.lineWidth = 2; c.beginPath(); c.roundRect(px, py, pw, ph, 18); c.fill(); c.stroke();
  c.save(); c.beginPath(); c.roundRect(px, py, pw, ph, 18); c.clip();
  c.strokeStyle = 'rgba(255,154,56,0.16)'; c.lineWidth = 1.5;
  for (let i = -9; i <= 9; i++) { c.beginPath(); c.moveTo(cx + i * 46, cy + 40); c.lineTo(cx + i * 150, py + ph + 40); c.stroke(); }
  for (let i = 0; i < 8; i++) { const y = cy + 40 + (i * i) * 9; c.beginPath(); c.moveTo(px, y); c.lineTo(px + pw, y); c.stroke(); }
  c.strokeStyle = '#ff9a38'; c.lineWidth = 3;
  [[330, 88], [250, 66], [170, 45]].forEach(([a, b], i) => { c.globalAlpha = 1 - i * 0.22; c.beginPath(); c.ellipse(cx, cy + i * -12, a!, b!, 0, 0, 7); c.stroke(); });
  c.globalAlpha = 1;
  const tw = (x: number, wd: number, ht: number, a = 1) => { c.globalAlpha = a; c.strokeRect(cx + x - wd / 2, cy - 24 - ht, wd, ht); for (let k = 1; k < ht / 26; k++) { c.globalAlpha = a * 0.35; c.beginPath(); c.moveTo(cx + x - wd / 2, cy - 24 - k * 26); c.lineTo(cx + x + wd / 2, cy - 24 - k * 26); c.stroke(); } c.globalAlpha = 1; };
  tw(-200, 56, 170, 0.7); tw(-110, 48, 250, 0.85); tw(118, 52, 220, 0.85); tw(206, 60, 150, 0.7);
  c.lineWidth = 4; c.beginPath(); c.moveTo(cx - 34, cy - 24); c.lineTo(cx - 12, cy - 330); c.lineTo(cx, cy - 430); c.lineTo(cx + 12, cy - 330); c.lineTo(cx + 34, cy - 24); c.closePath(); c.stroke();
  c.fillStyle = '#fff0d8'; c.beginPath(); c.arc(cx, cy - 436, 9, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,154,56,0.75)'; c.lineWidth = 3; c.setLineDash([16, 12]);
  [-300, -40, 250].forEach((x) => { c.beginPath(); c.moveTo(cx + x, cy + 64); c.lineTo(cx + x * 1.04, cy + 300); c.stroke(); });
  c.setLineDash([]); c.restore();
  // a timeline under it
  c.fillStyle = '#161412'; c.beginPath(); c.roundRect(px, h - 132, pw, 96, 14); c.fill();
  c.strokeStyle = '#3a342e'; c.lineWidth = 2; [0, 1, 2].forEach((i) => { c.beginPath(); c.moveTo(px + 24, h - 108 + i * 24); c.lineTo(px + pw - 24, h - 108 + i * 24); c.stroke(); });
  c.fillStyle = '#ff9a38'; [[60, 0], [210, 0], [330, 1], [470, 1], [560, 2], [690, 0], [150, 2]].forEach(([x, r]) => { c.save(); c.translate(px + x!, h - 108 + r! * 24); c.rotate(Math.PI / 4); c.fillRect(-7, -7, 14, 14); c.restore(); });
  c.fillStyle = '#fff0d8'; c.fillRect(px + 400, h - 126, 3, 84);
});
const padTex = tex(1600, 1200, (c, w, h) => {
  c.fillStyle = '#171513'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#211e1b'; c.fillRect(0, 0, 96, h); c.fillRect(w - 300, 0, 300, h);
  for (let i = 0; i < 7; i++) { c.fillStyle = i === 2 ? '#ff9a38' : '#5d554d'; c.beginPath(); c.roundRect(28, 60 + i * 84, 40, 40, 10); c.fill(); }
  c.font = '600 26px "Inter", sans-serif'; c.fillStyle = '#b8afa4'; c.fillText('Layers', w - 268, 70);
  ['Plate', 'Engraving', 'Screws', 'Light', 'Shadow'].forEach((t, i) => { c.fillStyle = i === 0 ? '#2e2924' : '#211e1b'; c.fillRect(w - 284, 96 + i * 62, 268, 52); c.fillStyle = i === 0 ? '#f3ede3' : '#8e857a'; c.fillText(t, w - 232, 131 + i * 62); c.fillStyle = '#ff9a38'; c.fillRect(w - 268, 114 + i * 62, 16, 16); });
  ['#ff9a38', '#d0a35c', '#f3ede3', '#8a5a34', '#2b2927'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(w - 250 + i * 52, 520, 20, 0, 7); c.fill(); });
  c.fillStyle = '#f3ede3'; c.font = '300 200px "Inter", sans-serif'; c.fillText('Aa', w - 276, 790);
  // the artboard: a brass plate being designed
  const ax = 190, ay = 150, aw = 1010, ah = 620, g = c.createLinearGradient(ax, ay, ax + aw, ay + ah);
  g.addColorStop(0, '#f1cf8c'); g.addColorStop(0.35, '#c79a52'); g.addColorStop(0.62, '#e8c27c'); g.addColorStop(1, '#8f6a34');
  c.fillStyle = g; c.beginPath(); c.roundRect(ax, ay, aw, ah, 34); c.fill();
  c.strokeStyle = 'rgba(60,38,12,0.55)'; c.lineWidth = 4; c.beginPath(); c.roundRect(ax + 26, ay + 26, aw - 52, ah - 52, 18); c.stroke();
  c.fillStyle = 'rgba(40,24,6,0.85)'; c.fillRect(ax + 80, ay + 110, 180, 20); c.fillRect(ax + 80, ay + 200, 700, 54); c.fillRect(ax + 80, ay + 280, 520, 54); c.fillRect(ax + 80, ah + ay - 110, 380, 18);
  [[ax + 52, ay + 52], [ax + aw - 52, ay + 52], [ax + 52, ay + ah - 52], [ax + aw - 52, ay + ah - 52]].forEach(([x, y]) => { c.fillStyle = '#7b5a2a'; c.beginPath(); c.arc(x!, y!, 13, 0, 7); c.fill(); });
  c.strokeStyle = '#ff9a38'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(220, 900); c.bezierCurveTo(420, 820, 520, 1040, 760, 940); c.bezierCurveTo(900, 880, 980, 1000, 1180, 930); c.stroke();
  c.setLineDash([10, 14]); c.lineWidth = 4; c.beginPath(); c.ellipse(1000, 420, 150, 96, 0, 0, 7); c.stroke(); c.setLineDash([]);
  c.font = '500 30px "Inter", sans-serif'; c.fillStyle = '#ff9a38'; c.fillText('shine follows the light', 866, 560);
});
[monTex, padTex].forEach((t) => { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; });

export type Bench = ReturnType<typeof buildBench>;
export function buildBench(scene: THREE.Scene, G: THREE.Group, noAO: THREE.Object3D[], k: (name: string, d: number) => number) {
  const groups: Record<string, THREE.Group> = {};
  const emis: { m: THREE.MeshStandardMaterial; grp: string; base: number; on: number }[] = [];
  const lights: { l: THREE.Light; grp: string; base: number; on: number }[] = [];
  const screens: THREE.Mesh[] = [];
  const grp = (name: string, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry * D; G.add(g); groups[name] = g; return g; };
  const put = (p: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx * D, ry * D, rz * D); m.castShadow = true; m.receiveShadow = true; p.add(m); return m;
  };
  const std = (color: number, rough: number, metal = 0, extra: THREE.MeshPhysicalMaterialParameters = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: metal, ...extra });
  const glow = (g: string, map: THREE.Texture | null, color: number, base: number, on: number, rough = 0.45) => {
    const m = new THREE.MeshPhysicalMaterial({ color: 0x020202, roughness: rough, specularIntensity: 0.28, emissive: color, emissiveMap: map, emissiveIntensity: base }); emis.push({ m, grp: g, base, on }); return m;
  };
  const ribs = (p: THREE.Object3D, r: number, len: number, n: number, w: number, t: number, mat: THREE.Material, y: number) => {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(w, len, t), mat, n), o = new THREE.Object3D();
    for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI; o.position.set(Math.sin(a) * r, y, Math.cos(a) * r); o.rotation.y = a; o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
    im.castShadow = true; im.receiveShadow = true; p.add(im); return im;
  };
  const M = {
    wood: std(0xffffff, 0.44, 0, { map: woodTex, clearcoat: 0.4, clearcoatRoughness: 0.32 }),
    leather: std(0x171513, 0.8, 0, { bumpMap: grain(1 / 36), bumpScale: 0.5 }),
    alu: std(0x25262a, 0.34, 0.92), aluDark: std(0x121316, 0.42, 0.9),
    brass: std(0xd0a35c, 0.22, 1, { side: THREE.DoubleSide }), silver: std(0xc9c9cc, 0.28, 1),
    ivory: std(0xe6dfd0, 0.56), coal: std(0x2b2927, 0.6), amber: std(0xdd8a2f, 0.5), rubber: std(0x0d0d0d, 0.92),
    body: std(0x151515, 0.5, 0.35), hide: std(0x0d0d0d, 0.86, 0, { bumpMap: grain(4), bumpScale: 0.8 }),
    barrel: std(0x131313, 0.42, 0.55, { side: THREE.DoubleSide }),
    glassMatte: std(0x030303, 0.4),
    glassBlk: std(0x030303, 0.06, 0, { clearcoat: 1, clearcoatRoughness: 0.03 }),
    lensGlass: std(0x05070b, 0.04, 0, { clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [160, 430] }),
  };

  // ---------- desk and mat ----------
  const desk = grp('desk');
  put(desk, slab(1400, 680, 12, 40, 2.5), M.wood, 0, -40, 0);
  put(desk, rb(1336, 2.4, 1.6, 0.5), M.brass, 0, -15, 340.3);
  put(desk, slab(880, 350, 16, 3, 0.9), M.leather, 150, 0, 122);

  // ---------- monitor ----------
  const mon = grp('monitor', 40, 0, -215);
  put(mon, slab(250, 190, 26, 9, 1.4), M.alu, 0, 0, 10);
  put(mon, rb(46, 300, 14, 4), M.alu, 0, 152, -22, -6);
  put(mon, rb(120, 60, 20, 6), M.alu, 0, 300, -12);
  const head = new THREE.Group(); head.position.set(0, 345, 8); head.rotation.x = -4 * D; mon.add(head);
  put(head, rb(724, 414, 12, 3), M.aluDark, 0, 0, -8);
  put(head, rb(320, 210, 26, 10), M.aluDark, 0, 0, -20);
  put(head, rb(717, 407, 2, 0.9), M.glassBlk, 0, 0, -1.3);
  const scr = put(head, new THREE.PlaneGeometry(704, 396), glow('monitor', monTex, 0xffffff, 0.16, 1.0), 0, 0, 0.3); scr.castShadow = false; screens.push(scr);
  put(head, rb(40, 3, 3, 1), glow('monitor', null, 0xff9a38, 0.5, 3), 0, -211, -4).castShadow = false;

  // ---------- keyboard: origin on the front bottom edge of the case, back raised ----------
  const kb = grp('keys', 20, 3, 190);
  const kt = new THREE.Group(); kt.rotation.x = 5 * D; kb.add(kt);
  put(kt, slab(326, 136, 13, 19, 1.5), M.aluDark, 0, 0, -68);
  put(kt, rb(326, 7, 9, 2.2), M.aluDark, 0, 21.5, -4.6); put(kt, rb(326, 7, 9, 2.2), M.aluDark, 0, 21.5, -131.4);
  put(kt, rb(9, 7, 136, 2.2), M.aluDark, -158.5, 21.5, -68); put(kt, rb(9, 7, 136, 2.2), M.aluDark, 158.5, 21.5, -68);
  put(kt, new THREE.BoxGeometry(309, 1, 119), glow('keys', null, 0xff8a26, 0.22, 1.5), 0, 19.4, -68).castShadow = false;
  put(kt, rb(60, 2.2, 1.4, 0.6), M.brass, -118, 9, 0.4);
  const U = 19.05, capGeos = new Map<number, THREE.BufferGeometry>();
  const capGeo = (wu: number) => {
    if (!capGeos.has(wu)) {
      const w = wu * U - 1.1, h = 8.6, d = U - 1.1, g = new RoundedBoxGeometry(w, h, d, 3, 2.0), p = g.attributes.position!;
      for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + h / 2) / h; p.setX(i, p.getX(i) * (1 - (4.6 / w) * t)); p.setZ(i, p.getZ(i) * (1 - (4.2 / d) * t) - 0.6 * t); }
      capGeos.set(wu, g);
    }
    return capGeos.get(wu)!;
  };
  const rep = (n: number, w: number, c: string) => Array.from({ length: n }, () => [w, c] as [number, string]);
  const rows: [number, string][][] = [
    [[1, 'a'], ...rep(14, 1, 'c')],
    [...rep(13, 1, 'i'), [2, 'c'], [1, 'c']],
    [[1.5, 'c'], ...rep(12, 1, 'i'), [1.5, 'i'], [1, 'c']],
    [[1.75, 'c'], ...rep(11, 1, 'i'), [2.25, 'a'], [1, 'c']],
    [[2.25, 'c'], ...rep(10, 1, 'i'), [1.75, 'c'], [1, 'c'], [1, 'c']],
    [...rep(3, 1.25, 'c'), [6.25, 'i'], ...rep(6, 1, 'c')],
  ];
  const lift = [1.4, 0.9, 0.3, 0, 0.3, 0.9], tilt = [7, 5, 2, -1, -4, -6], capM: Record<string, THREE.Material> = { i: M.ivory, c: M.coal, a: M.amber };
  rows.forEach((row, r) => { let x = -8 * U; for (const [w, c] of row) { put(kt, capGeo(w), capM[c]!, x + (w * U) / 2, 24.6 + lift[r]!, -68 - 2.5 * U + r * U, tilt[r]!); x += w * U; } });
  const knob = new THREE.Group(); knob.position.set(7.5 * U, 20, -68 - 2.5 * U); kt.add(knob);
  put(knob, cyl(12.4, 13, 64), M.brass, 0, 7, 0); put(knob, cyl(10.4, 1.2, 64), M.brass, 0, 14, 0); ribs(knob, 12.5, 9.5, 46, 0.9, 0.9, M.brass, 6.5);
  const cable = new THREE.CatmullRomCurve3([[-70, 13, -138], [-72, 5, -168], [-96, -0.6, -215], [-170, -0.6, -262], [-300, -3, -300], [-420, -3, -420]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  put(kb, new THREE.TubeGeometry(cable, 90, 2.3, 12), M.coal);

  // ---------- mouse ----------
  const ms = grp('mouse', 318, 3, 135, 9);
  put(ms, loft([{ y: 0.4, a: 29, b: 59, n: 2.7 }, { y: 5, a: 32, b: 62, n: 2.7 }, { y: 15, a: 32.5, b: 62.5, n: 2.6, oz: 1 }, { y: 25, a: 30, b: 58, oz: 4 }, { y: 32, a: 25, b: 49, oz: 8 }, { y: 36.5, a: 17, b: 35, oz: 11 }, { y: 38.6, a: 8, b: 17, oz: 13 }]), M.ivory);
  put(ms, cyl(10.5, 7.5, 40), M.rubber, 0, 26.5, -30, 0, 0, 90);
  put(ms, cyl(11, 1.2, 40), glow('keys', null, 0xff8a26, 0.3, 2.4), 0, 26.5, -30, 0, 0, 90).castShadow = false;
  put(ms, new THREE.BoxGeometry(0.7, 3, 40), M.coal, 0, 30.4, -37, -18);

  // ---------- iPad on a low prop, and the pencil ----------
  const pad = grp('ipad', -425, 0, 100, 22);
  const tb = new THREE.Group(); tb.position.set(0, 1.2, 108); tb.rotation.x = 24 * D; pad.add(tb);
  put(tb, slab(280, 215, 17, 6.2, 0.9), M.alu, 0, 0, -107.5);
  put(tb, slab(277.6, 212.6, 16, 0.5, 0), M.glassMatte, 0, 6.2, -107.5);
  const ps = put(tb, new THREE.PlaneGeometry(262, 197).rotateX(-Math.PI / 2), glow('ipad', padTex, 0xffffff, 0.2, 1.0), 0, 6.78, -107.5); ps.castShadow = false; screens.push(ps);
  put(pad, rb(190, 96, 4, 1.6), M.aluDark, 0, 45, -99, -16);
  put(pad, slab(240, 60, 8, 3, 0.8), M.aluDark, 0, 0, -108);
  const pen = new THREE.Group(); pen.position.set(205, 4.5, 30); pen.rotation.y = 68 * D; pad.add(pen);
  put(pen, cyl(4.45, 150, 28), M.ivory, 0, 0, 0, 0, 0, 90); put(pen, new THREE.ConeGeometry(4.45, 15, 28), M.ivory, 82.5, 0, 0, 0, 0, -90); put(pen, cyl(1.2, 4, 12), M.coal, 91, 0, 0, 0, 0, 90);
  put(pen, cyl(4.5, 1.2, 28), M.brass, -52, 0, 0, 0, 0, 90);

  // ---------- camera, spare lens, cap ----------
  const lens = (p: THREE.Object3D) => {
    const L = new THREE.Group(); p.add(L);
    put(L, lathe([[30, 0], [31.5, 2], [31.5, 14], [34, 16], [34, 44], [35.5, 46], [35.5, 58], [33.5, 60], [33.5, 78], [36, 80], [38, 92], [38, 99], [36.2, 100], [35.6, 96.5], [32, 96], [31, 91], [27.6, 89]]), M.barrel);
    ribs(L, 34.3, 26, 60, 1.9, 1.3, M.rubber, 30); ribs(L, 33.8, 16, 110, 0.9, 0.9, M.rubber, 69);
    put(L, new THREE.TorusGeometry(36.5, 0.75, 10, 96).rotateX(Math.PI / 2), M.brass, 0, 81, 0);
    put(L, new THREE.TorusGeometry(31.8, 0.5, 8, 96).rotateX(Math.PI / 2), M.silver, 0, 14.6, 0);
    const th = Math.asin(27.6 / 62); put(L, new THREE.SphereGeometry(62, 56, 18, 0, Math.PI * 2, 0, th), M.lensGlass, 0, 89 - 62 * Math.cos(th), 0);
    return L;
  };
  const cam = grp('camera', 492, 3, 96, -36);
  put(cam, rb(134, 70, 44, 7), M.body, 0, 37, 0);
  put(cam, rb(86, 50, 3, 1.3), M.hide, 14, 33, 21.4);
  put(cam, rb(31, 66, 36, 11), M.hide, -53, 37, 19);
  put(cam, rb(50, 22, 42, 7), M.body, 6, 80, -2); put(cam, rb(36, 24, 9, 4), M.rubber, 6, 77, -25); put(cam, rb(20, 2.4, 20, 0.7), M.silver, 6, 92.3, 1);
  const dial = (x: number, z: number, r: number, h: number) => { const d = new THREE.Group(); d.position.set(x, 72, z); cam.add(d); put(d, cyl(r, h, 48), M.body, 0, h / 2, 0); ribs(d, r + 0.1, h * 0.7, Math.round(r * 5), 0.8, 0.8, M.aluDark, h / 2); put(d, cyl(r * 0.72, 0.8, 48), M.silver, 0, h + 0.2, 0); };
  dial(47, 2, 12.5, 9); dial(-24, -8, 9.5, 7);
  put(cam, cyl(8.5, 2.4, 40), M.silver, -53, 71.4, 26); put(cam, cyl(5.6, 3.4, 40), M.silver, -53, 73.6, 26);
  put(cam, cyl(1.6, 1, 16), glow('camera', null, 0xff7a1e, 0, 6), -34, 58, 22.2, 90).castShadow = false;
  put(cam, cyl(33, 5, 72), M.silver, 6, 37, 23, 90);
  const cl = lens(cam); cl.position.set(6, 37, 24); cl.rotation.x = 90 * D;
  [-64, 64].forEach((x) => put(cam, new THREE.TorusGeometry(4, 1, 8, 24), M.silver, x, 66, 0, 0, 90));
  const sp = grp('lens2', 612, 0, -116, 0); lens(sp);
  const lc = grp('cap', 404, 3, 236, 0); put(lc, cyl(39, 5.5, 72), M.body, 0, 2.75, 0); put(lc, cyl(30, 0.8, 72), M.hide, 0, 5.7, 0); put(lc, new THREE.TorusGeometry(38.4, 0.6, 8, 72).rotateX(Math.PI / 2), M.aluDark, 0, 5.4, 0);

  // ---------- brass lamp ----------
  const lp = grp('lamp', -612, 0, -212);
  put(lp, lathe([[0, 0], [88, 0], [90, 2], [90, 9], [84, 13], [22, 15.5], [10, 24], [7, 31]]), M.brass);
  const arm = new THREE.CatmullRomCurve3([[0, 28, 0], [0, 240, 0], [6, 385, 8], [52, 472, 62], [126, 506, 136], [186, 486, 192]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  put(lp, new THREE.TubeGeometry(arm, 90, 5.5, 18), M.brass);
  const shade = new THREE.Group(); shade.position.set(190, 482, 196); shade.rotation.set(18 * D, 0, -14 * D); lp.add(shade);
  put(shade, lathe([[78, -80], [77, -76], [62, -52], [32, -20], [15, -6], [10, 0], [0, 2]]), M.brass);
  const bulb = put(shade, new THREE.CircleGeometry(70, 48).rotateX(Math.PI / 2), glow('base', null, 0xffd2a0, 1.6, 0), 0, -66, 0); bulb.castShadow = false; screens.push(bulb);

  // ---------- lights (the scene is in metres) ----------
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x * MM, y * MM, z * MM);
  const spot = (g: string, color: number, base: number, on: number, from: number[], to: number[], angle: number, pen = 0.7, shadow = true) => {
    const l = new THREE.SpotLight(color, 0, 0, angle * D, pen, 2); l.position.copy(V(from[0]!, from[1]!, from[2]!)); l.target.position.copy(V(to[0]!, to[1]!, to[2]!)); scene.add(l, l.target);
    if (shadow) { l.castShadow = true; l.shadow.mapSize.set(2048, 2048); l.shadow.bias = -0.0006; l.shadow.normalBias = 0.002; l.shadow.radius = 5; l.shadow.blurSamples = 16; l.shadow.camera.near = 0.05; l.shadow.camera.far = 4; }
    lights.push({ l, grp: g, base, on }); return l;
  };
  const area = (g: string, color: number, base: number, on: number, w: number, h: number, at: number[], look: number[]) => {
    const l = new THREE.RectAreaLight(color, 0, w * MM, h * MM); l.position.copy(V(at[0]!, at[1]!, at[2]!)); l.lookAt(V(look[0]!, look[1]!, look[2]!)); scene.add(l); lights.push({ l, grp: g, base, on }); return l;
  };
  spot('base', 0xffd0a0, k('lamp', 2.6), 0, [-420, 425, -18], [-400, 0, 100], 58, 0.85);
  area('base', 0xffe0c4, k('rim', 1.3), 0, 1700, 500, [700, 950, -1250], [0, 150, 0]);
  area('base', 0xffe6d0, k('fill', 0.3), 0, 1500, 900, [-900, 1300, 1500], [0, 100, 0]);
  area('monitor', 0xffc48a, 0, k('mon', 5), 704, 396, [40, 345, -204], [40, 150, 310]);
  spot('monitor', 0xffe8d0, 0, k('monS', 3), [40, 1000, 270], [40, 330, -205], 22, 0.8, false);
  spot('keys', 0xffe6c8, 0, k('keyS', 3.4), [210, 760, 560], [130, 12, 132], 16, 0.8);
  area('ipad', 0xffd2a4, 0, k('pad', 2.5), 262, 197, [-425, 60, 68], [-425, 400, 268]);
  spot('ipad', 0xffe8d0, 0, k('padS', 3.4), [-640, 640, 420], [-410, 30, 105], 17, 0.75);
  spot('camera', 0xfff1e2, 0, k('camS', 7), [230, 540, 640], [515, 48, 70], 15, 0.7);
  spot('camera', 0xffb060, 0, k('camR', 3), [860, 320, -340], [515, 52, 60], 16, 0.6, false);

  area('water', 0xff8a26, 0, k('wat', 7), 1400, 70, [0, 95, 372], [0, 0, 140]);
  spot('water', 0xff8a26, 0, k('watS', 6), [-730, 170, 420], [-620, 0, 280], 42, 0.9, false);
  spot('water', 0xff8a26, 0, k('watS', 6), [730, 170, 420], [620, 0, 280], 42, 0.9, false);

  const setPass = (name: string) => {
    const base = name === 'base' || name === 'all', all = name === 'all';
    for (const e of emis) e.m.emissiveIntensity = (base ? e.base : 0) + (all || e.grp === name ? e.on : 0);
    for (const x of lights) x.l.intensity = (base ? x.base : 0) + (all || x.grp === name ? x.on : 0);
  };
  void noAO;
  return { groups, screens, setPass };
}
