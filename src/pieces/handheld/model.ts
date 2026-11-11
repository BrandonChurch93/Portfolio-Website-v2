import * as THREE from 'three';
import { Builder, at, lathe, rbox, xf } from '../../world/build';
import { circle, inset, rounded, rrect, screw, slab, type P2, type V } from '../../world/shape';
import { dielectric, metal, screenGlass } from '../../world/surface';
import { site } from '../../content/site';
import { HandheldScreen, RES } from './screen';

// The brass handheld, in millimetres (the root is scaled by 0.001). The console's own space: x across, y up, the
// front face at z = 0, the back at z = -25. It leans back on a brass rest in a stone plinth whose top is y = 0.

export const HH = { W: 196, H: 96, SCALE: 0.001, LEAN: -14, PIVOT: [0, -0.5, -8] as const, FACE: 0, BACK: -25 } as const;
const HW = site.pieces.handheld;
const D2R = Math.PI / 180;
const MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Menlo, monospace';
const SANS = '"Sora Variable", "Sora", system-ui, sans-serif';


// The outline: a landscape body with cut top corners (where the shoulder keys sit) and round grips below.
const OUTLINE: V[] = [[-98, -48, 24], [98, -48, 24], [98, 35, 4], [85, 48, 4], [-85, 48, 4], [-98, 35, 4]];
const DECK = { cx: 0, cy: 4.5, w: 105.2, h: 75, r: 6 } as const;
const POCKET = { w: 107, h: 77, r: 7 } as const;
const WIN = { cx: 0, cy: 9, w: 84, h: 56, r: 3 } as const;
const TITLE_Y = -26;
const WELL = { x: 74, y: 4, r: 17 } as const;
const BTN = { b: [67.5, -1.5] as P2, a: [80.5, 9.5] as P2, r: 6 } as const;
const PILL = { x: 12, y: -41, w: 12, h: 4.4 } as const;
const GRILLE = { x: 76, y: -31, r: 8.2 } as const;
const DECK_SCREWS: P2[] = [[-49, 39], [49, 39], [-49, -30], [49, -30]];
const BACK_SCREWS: P2[] = [[-86, 30], [86, 30], [-50, -41], [50, -41], [-30, 40], [30, 40]];

export interface Control { name: string; group: THREE.Group; rest: THREE.Matrix4; kind: 'push' | 'rock' | 'slide'; depth: number }

export interface HandheldModel {
  root: THREE.Group;
  pivot: THREE.Group;
  console: THREE.Group;
  controls: Control[];
  screen: HandheldScreen;
  lcd: THREE.ShaderMaterial;
  led: THREE.MeshStandardMaterial;
  glass: THREE.ShaderMaterial;
  centre: THREE.Vector3;
}

// The engravings on the front, painted at 12 pixels a millimetre over the whole face: red is cut into the brass and
// filled with dark enamel, green is brass inlaid flush into the bronze deck.
function engraving(): THREE.CanvasTexture {
  const S = 12, Wc = 200 * S, Hc = 100 * S;
  const X = (x: number) => (x + 100) * S, Y = (y: number) => (50 - y) * S;
  const layer = () => { const c = document.createElement('canvas'); c.width = Wc; c.height = Hc; const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.strokeStyle = '#fff'; return { c, g }; };
  const red = layer(), green = layer();
  // Graduated rings round both wells, like the bezel of an instrument.
  for (const sx of [-1, 1]) {
    const g = red.g, cx = X(sx * WELL.x), cy = Y(WELL.y);
    g.lineWidth = 0.26 * S;
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2, long = k % 6 === 0;
      const r0 = (WELL.r + 1.7) * S, r1 = (WELL.r + (long ? 3.4 : 2.5)) * S;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
    }
    g.lineWidth = 0.22 * S;
    g.beginPath(); g.arc(cx, cy, (WELL.r + 4.1) * S, 0, Math.PI * 2); g.stroke();
  }
  // Button letters, select and start.
  {
    const g = red.g;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `600 ${4.2 * S}px ${SANS}`;
    g.fillText(HW.a, X(WELL.x + 17.6), Y(WELL.y + 16.4));
    g.fillText(HW.b, X(WELL.x - 17.6), Y(WELL.y - 16.4));
    g.font = `700 ${2.9 * S}px ${MONO}`;
    (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${0.35 * S}px`;
    g.textAlign = 'right'; g.fillText(HW.select.toUpperCase(), X(-PILL.x - PILL.w / 2 - 2.2), Y(PILL.y));
    g.textAlign = 'left'; g.fillText(HW.start.toUpperCase(), X(PILL.x + PILL.w / 2 + 2.4), Y(PILL.y));
  }
  // The deck: a double border broken round its screws, the title, the power label and the game's mark.
  {
    const g = green.g;
    const line = (ins: number, w: number) => {
      g.lineWidth = w * S;
      const pts = rounded(rrect(DECK.cx, DECK.cy, DECK.w - ins * 2, DECK.h - ins * 2, DECK.r - ins));
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y)))); g.closePath(); g.stroke();
    };
    line(2.0, 0.34);
    line(2.9, 0.18);
    g.globalCompositeOperation = 'destination-out';
    for (const [x, y] of DECK_SCREWS) { g.beginPath(); g.arc(X(x), Y(y), 2.6 * S, 0, Math.PI * 2); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `600 ${4.8 * S}px ${SANS}`;
    (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${0.9 * S}px`;
    g.fillText(HW.title.toUpperCase(), X(0), Y(TITLE_Y));
    g.font = `600 ${2.2 * S}px ${MONO}`;
    (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${0.3 * S}px`;
    g.textAlign = 'left'; g.fillText(HW.power.toUpperCase(), X(-38.6), Y(TITLE_Y));
    // The game's mark, a drop of light.
    const dy = TITLE_Y - 1.1, dr = 1.9;
    g.beginPath(); g.moveTo(X(40), Y(dy + 4.2)); g.bezierCurveTo(X(40 + dr * 0.7), Y(dy + 2.2), X(40 + dr), Y(dy + 1), X(40 + dr), Y(dy)); g.arc(X(40), Y(dy), dr * S, 0, Math.PI); g.bezierCurveTo(X(40 - dr), Y(dy + 1), X(40 - dr * 0.7), Y(dy + 2.2), X(40), Y(dy + 4.2)); g.fill();
  }
  const out = document.createElement('canvas');
  out.width = Wc; out.height = Hc;
  const o = out.getContext('2d')!;
  const img = o.createImageData(Wc, Hc);
  const r = red.g.getImageData(0, 0, Wc, Hc).data, gg = green.g.getImageData(0, 0, Wc, Hc).data;
  for (let i = 0; i < img.data.length; i += 4) { img.data[i] = r[i + 3]; img.data[i + 1] = gg[i + 3]; img.data[i + 3] = 255; }
  o.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

// Engraving chunks for a metal whose face lies in the console's xy plane at z = face.
function engraved(tex: THREE.Texture, face: number, kind: 'cut' | 'inlay') {
  const uniforms = { uEng: { value: tex }, uFaceZ: { value: face } };
  const head = /* glsl */ `
uniform sampler2D uEng; uniform float uFaceZ;
vec2 engUv(vec2 xy){ return (xy + vec2(100.0, 50.0)) / vec2(200.0, 100.0); }
float engOn(){ return step(0.7, vObjN.z) * step(uFaceZ, vObj.z); }`;
  const ch = kind === 'cut' ? 'r' : 'g';
  return {
    uniforms,
    chunks: {
      head,
      color: kind === 'cut'
        ? `float engK = texture2D(uEng, engUv(vObj.xy)).r * engOn();\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.010, 0.0075, 0.006), engK);`
        : `float engK = texture2D(uEng, engUv(vObj.xy)).g * engOn();\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.52, 0.2), engK);`,
      rough: kind === 'cut' ? 'roughnessFactor = mix(roughnessFactor, 0.55, engK);' : 'roughnessFactor = mix(roughnessFactor, 0.24, engK);',
      metal: kind === 'cut' ? 'metalnessFactor = mix(metalnessFactor, 0.0, engK);' : '',
      normal: /* glsl */ `
  if (engOn() > 0.5) {
    float e = 0.11;
    vec2 u = engUv(vObj.xy);
    float gx = (texture2D(uEng, engUv(vObj.xy + vec2(e, 0.0))).${ch} - texture2D(uEng, engUv(vObj.xy - vec2(e, 0.0))).${ch}) / (2.0 * e);
    float gy = (texture2D(uEng, engUv(vObj.xy + vec2(0.0, e))).${ch} - texture2D(uEng, engUv(vObj.xy - vec2(0.0, e))).${ch}) / (2.0 * e);
    float D = ${kind === 'cut' ? '0.06' : '0.02'};
    normal = normalize(normal + (gx * vAxX + gy * vAxY) * D);
  }`,
    },
  };
}

// The LCD under the glass: pixels sampled sharp at any size, the gaps between them drawn while they are big enough to
// see, a black border round the lit area, and the window's wall darkening the edge.
function lcdMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uRes: { value: new THREE.Vector2(RES.w, RES.h) }, uPower: { value: 0 }, uGain: { value: 1.6 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
uniform sampler2D uMap; uniform vec2 uRes; uniform float uPower, uGain;
varying vec2 vUv;
void main(){
  vec2 p = (vUv - 0.5) * vec2(${WIN.w + 2}.0, ${WIN.h + 2}.0);
  vec2 a = vec2(40.0, 26.6667);
  vec2 q = p / (a * 2.0) + 0.5;
  float inside = step(abs(p.x), a.x) * step(abs(p.y), a.y);
  vec2 px = q * uRes;
  vec2 fw = max(fwidth(px), vec2(1e-4));
  vec2 cell = floor(px), f = fract(px) - 0.5;
  vec2 suv = (cell + 0.5 + clamp(f / fw, -0.5, 0.5)) / uRes;
  vec3 col = texture2D(uMap, suv).rgb;
  float gridFade = 1.0 - smoothstep(0.16, 0.42, max(fw.x, fw.y));
  vec2 e = abs(f);
  float line = max(smoothstep(0.41 - fw.x, 0.41 + fw.x, e.x), smoothstep(0.41 - fw.y, 0.41 + fw.y, e.y));
  col *= 1.0 - line * 0.6 * gridFade;
  vec3 base = vec3(0.010, 0.0065, 0.004);
  col = mix(base, base + col * uGain, uPower) * inside + vec3(0.004, 0.003, 0.0025) * (1.0 - inside);
  float edge = min(${WIN.w / 2}.0 - abs(p.x), ${WIN.h / 2}.0 - abs(p.y));
  col *= mix(0.35, 1.0, smoothstep(0.0, 2.2, edge));
  gl_FragColor = vec4(col, 1.0);
}`,
  });
  m.name = 'handheldScreen';
  return m;
}

// The cartridge label: the game's name printed in ink on ivory, a rule and a small line.
function cartLabel(): THREE.MeshPhysicalMaterial {
  const c = document.createElement('canvas'); c.width = 1536; c.height = 120;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d6c9ae'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#2a1c12'; g.textBaseline = 'middle';
  g.font = `700 64px ${SANS}`; (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '14px';
  g.fillText(HW.title.toUpperCase(), 40, 62);
  g.fillRect(500, 58, 560, 4);
  g.font = `600 40px ${MONO}`; (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '6px';
  g.textAlign = 'right'; g.fillText(HW.boot.toUpperCase(), c.width - 40, 62);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.55, clearcoat: 0.3 });
  m.name = 'hhLabel';
  return m;
}

// The plaque on the plinth: the game's name engraved and filled.
function plaqueText(): THREE.MeshPhysicalMaterial {
  const c = document.createElement('canvas'); c.width = 1536; c.height = 205;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 92px ${SANS}`; (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '30px';
  g.fillText(HW.title.toUpperCase(), c.width / 2, 106);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  const m = new THREE.MeshPhysicalMaterial({ color: 0x120c08, roughness: 0.5, alphaMap: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  m.name = 'hhPlaque';
  return m;
}

export function buildHandheld(): HandheldModel {
  const root = new THREE.Group();
  root.scale.setScalar(HH.SCALE);
  const pivot = new THREE.Group();
  pivot.position.set(...HH.PIVOT);
  pivot.rotation.x = HH.LEAN * D2R;
  root.add(pivot);
  const con = new THREE.Group();
  con.position.set(0, 48, 25);
  pivot.add(con);

  // ---- materials ------------------------------------------------------------------------------------
  const eng = engraving();
  const brassFace = engraved(eng, -0.05, 'cut');
  const brass = metal({ name: 'hhBrass', color: 0xdcae62, rough: 0.3, brush: 'x', tarnish: 0.35, aniso: 0.75, anisoRot: Math.PI / 2, extra: brassFace.chunks });
  brass.userData.uniforms = brassFace.uniforms;
  const brassPlain = metal({ name: 'hhBrassPlain', color: 0xd6a85e, rough: 0.3, brush: 'radial-z', tarnish: 0.25 });
  const deckFace = engraved(eng, -0.6, 'inlay');
  const deck = metal({ name: 'hhDeck', color: 0x4e3420, rough: 0.46, cast: 0.9, tarnish: 0.3, extra: deckFace.chunks });
  deck.userData.uniforms = deckFace.uniforms;
  const bronze = metal({ name: 'hhBronze', color: 0x77522f, rough: 0.36, brush: 'radial-z', tarnish: 0.2 });
  const steel = metal({ name: 'hhSteel', color: 0xbdb5aa, rough: 0.24, brush: 'radial-z' });
  const ivory = dielectric('hhIvory', 0xcdbfa6, 0.34, { coat: 0.6, vary: 0.05, scale: 0.08 });
  const rubber = dielectric('hhRubber', 0x1d1815, 0.78, { vary: 0.12, scale: 0.3, sheen: 0.3 });
  const ink = dielectric('hhInk', 0x0f0b09, 0.7, { vary: 0.05 });
  const cloth = dielectric('hhCloth', 0x16110d, 0.95, { vary: 0.2, scale: 1.4 });
  const stone = dielectric('hhStone', 0x1a1512, 0.42, { vary: 0.45, scale: 0.035, coat: 0.4 });
  const floor = dielectric('hhFloor', 0x17120f, 0.72, { vary: 0.2, scale: 0.004 });
  const glass = screenGlass('hhGlass');
  const led = new THREE.MeshStandardMaterial({ color: 0x3a1c08, emissive: new THREE.Color(0xff9a38), emissiveIntensity: 0, roughness: 0.2 });
  led.name = 'hhLed';

  const controls: Control[] = [];
  const control = (name: string, kind: Control['kind'], depth: number, x: number, y: number, z: number) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    con.add(g);
    g.updateMatrix();
    controls.push({ name, group: g, rest: g.matrix.clone(), kind, depth });
    return g;
  };

  // ---- the body: front and back shells meeting at a seam, the deck pocket, wells and openings -------------
  const body = new Builder();
  {
    const out = rounded(OUTLINE);
    const pocket = rounded(rrect(DECK.cx, DECK.cy, POCKET.w, POCKET.h, POCKET.r));
    const wells = [-1, 1].map((sx) => circle(sx * WELL.x, WELL.y, WELL.r));
    const pills = [-1, 1].map((sx) => rounded(rrect(sx * PILL.x, PILL.y, PILL.w + 1, PILL.h + 0.8, (PILL.h + 0.8) / 2 - 0.01)));
    const grilles = [-1, 1].map((sx) => circle(sx * GRILLE.x, GRILLE.y, GRILLE.r));
    body.add(slab(out, [pocket, ...wells, ...pills, ...grilles], -11, 0, 1.1), brass);
    body.add(slab(out, [], -25, -11, 1.8, 4), brassPlain);
    body.add(slab(rounded(inset(OUTLINE, 0.9)), [], -12.4, -9.6, 0), ink);
    // The floor of the deck pocket, open under the screen.
    body.add(slab(rounded(rrect(DECK.cx, DECK.cy, POCKET.w + 0.6, POCKET.h + 0.6, POCKET.r)), [rounded(rrect(WIN.cx, WIN.cy, WIN.w + 4, WIN.h + 4, 4))], -4.2, -3.2, 0), ink);
    // Well floors (the membrane), pill floors, speaker cloth behind the grilles.
    for (const sx of [-1, 1]) {
      body.add(slab(circle(sx * WELL.x, WELL.y, WELL.r + 0.3), [], -6, -4.6, 0), rubber);
      // The membrane: moulded rings round the well floor and a boot round each control.
      for (const rr of [15.6, 16.4]) { const ring = new THREE.TorusGeometry(rr, 0.22, 8, 160); body.add(ring, rubber, at(sx * WELL.x, WELL.y, -4.6)); }
      if (sx > 0) for (const [bx, by] of [BTN.a, BTN.b]) { const boot = new THREE.TorusGeometry(6.55, 0.55, 12, 96); body.add(boot, rubber, at(bx, by, -4.45)); }
      else {
        const w = 5.6, L = 15.0, rc = 2.2;
        const gasket: V[] = [[w, -L, rc], [w, -w, 0.8], [L, -w, rc], [L, w, rc], [w, w, 0.8], [w, L, rc], [-w, L, rc], [-w, w, 0.8], [-L, w, rc], [-L, -w, rc], [-w, -w, 0.8], [-w, -L, rc]];
        body.add(slab(rounded(gasket), [], -4.9, -3.9, 0.4, 2), rubber, at(-WELL.x, WELL.y, 0));
      }
      body.add(slab(rounded(rrect(sx * PILL.x, PILL.y, PILL.w + 1.6, PILL.h + 1.4, (PILL.h + 1.4) / 2 - 0.01)), [], -5, -3.4, 0), ink);
      body.add(slab(circle(sx * GRILLE.x, GRILLE.y, GRILLE.r + 0.3), [], -5, -3.6, 0), cloth);
      // The grille insert: a brass disc set a little below the face, drilled in rings.
      const holes: THREE.Vector2[][] = [circle(sx * GRILLE.x, GRILLE.y, 0.75, 20)];
      for (const [n, rr] of [[6, 2.5], [12, 5.0]] as const) for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + (n === 12 ? Math.PI / 12 : 0); holes.push(circle(sx * GRILLE.x + Math.cos(a) * rr, GRILLE.y + Math.sin(a) * rr, 0.75, 20)); }
      body.add(slab(circle(sx * GRILLE.x, GRILLE.y, GRILLE.r + 0.2), holes, -3.4, -0.7, 0.25, 2), brassPlain);
    }
    // Back grips: the back swells under each hand, with a rubber pad.
    for (const sx of [-1, 1]) {
      const swell = new THREE.SphereGeometry(1, 48, 24);
      body.add(swell, brassPlain, xf({ p: [sx * 70, -6, -24], s: [23, 34, 8.5] }));
      const pad = new THREE.SphereGeometry(1, 48, 24);
      body.add(pad, rubber, xf({ p: [sx * 70, -6, -24.2], s: [17.5, 27, 9.1] }));
    }
    // Battery door: a plate in a dark groove, latch ridges, a screw.
    const door = rounded(rrect(0, 2, 84, 46, 3));
    body.add(slab(rounded(rrect(0, 2, 85.6, 47.6, 3.6)), [door], -25.6, -24.6, 0), ink);
    body.add(slab(rounded(rrect(0, 2, 83.6, 45.6, 2.8)), [], -25.7, -24.4, 0.3, 2), brassPlain);
    for (let k = 0; k < 6; k++) body.add(rbox(14, 0.7, 0.9, 0.3), brassPlain, at(0, 18 + k * 1.6, -25.9));
    // The seam continues as a dark line round the edges; ports and slots on the top and the right side.
    body.add(rbox(66, 1.6, 9.4, 0.6), ink, at(0, 47.9, -17.5));
    body.add(rbox(15, 1.4, 3.8, 1.2), ink, at(-46, 47.9, -5.6));
    body.add(rbox(11, 1.4, 4.8, 1.4), ink, at(42, 47.9, -5.6));
    body.add(rbox(8.2, 0.6, 1.2, 0.2), brassPlain, at(42, 48.3, -5.6));
    body.add(rbox(1.6, 19, 5.6, 0.7), ink, at(97.8, 12, -11));
    for (let k = 0; k < 7; k++) { body.add(rbox(1.2, 1.4, 6.5, 0.55), ink, at(-24 - k * 2.6, 47.9, -17.5)); body.add(rbox(1.2, 1.4, 6.5, 0.55), ink, at(24 + k * 2.6, 47.9, -17.5)); }
    // Headphone jack on the right side, with a chamfered brass ring.
    const jack = new THREE.CylinderGeometry(1.9, 1.9, 1.6, 24); jack.rotateZ(Math.PI / 2);
    body.add(jack, ink, at(97.7, -14, -18));
    const ringG = new THREE.TorusGeometry(2.45, 0.42, 10, 32); ringG.rotateY(Math.PI / 2);
    body.add(ringG, brassPlain, at(98.2, -14, -18));
    // Lanyard eyelet on the left side.
    const eye = new THREE.TorusGeometry(2.8, 0.85, 12, 32); eye.rotateX(Math.PI / 2);
    body.add(eye, brassPlain, at(-99.2, -12, -18.5));
    body.add(rbox(4, 3.2, 5, 1), brassPlain, at(-97.6, -12, -18.5));
    // Screws: four on the deck, six on the back, one in the battery door.
    const sc = screw(1.75);
    for (const [x, y] of DECK_SCREWS) { body.add(sc.head, steel, at(x, y, -0.5)); body.add(sc.slot, ink, at(x, y, -0.5, [0, 0, (x * 7 + y * 3) * D2R])); }
    const sb = screw(1.9);
    for (const [x, y] of [...BACK_SCREWS, [0, -14] as P2]) {
      const z = x === 0 ? -25.7 : -25.15;
      body.add(sb.head, steel, xf({ p: [x, y, z], r: [0, Math.PI, (x * 5 + y) * D2R] }));
      body.add(sb.slot, ink, xf({ p: [x, y, z], r: [0, Math.PI, (x * 5 + y) * D2R] }));
    }
    // The power lamp: a domed lens in a brass bezel.
    const lens = new THREE.SphereGeometry(1.15, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); lens.rotateX(Math.PI / 2);
    const bez = new THREE.TorusGeometry(1.5, 0.38, 10, 28);
    body.add(bez, brassPlain, at(-42, TITLE_Y, -0.4));
    body.build(con, 'body');
    const lm = new THREE.Mesh(lens, led);
    lm.position.set(-42, TITLE_Y, -0.6);
    lm.name = 'led';
    con.add(lm);
  }

  // ---- the deck, the glass and the LCD ------------------------------------------------------------------
  const screen = new HandheldScreen();
  const lcd = lcdMaterial(screen.texture);
  {
    const b = new Builder();
    b.add(slab(rounded(rrect(DECK.cx, DECK.cy, DECK.w, DECK.h, DECK.r)), [rounded(rrect(WIN.cx, WIN.cy, WIN.w, WIN.h, WIN.r))], -3.2, -0.5, 0.45, 3), deck);
    b.build(con, 'deck');
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w + 2, WIN.h + 2), lcd);
    panel.position.set(WIN.cx, WIN.cy, -3.5);
    panel.name = 'lcd';
    con.add(panel);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w + 0.6, WIN.h + 0.6), glass);
    gl.position.set(WIN.cx, WIN.cy, -1.15);
    gl.name = 'glass';
    gl.renderOrder = 2;
    con.add(gl);
  }

  // ---- controls ---------------------------------------------------------------------------------------
  {
    // The D-pad: a bevelled cross with raised arrows and a turned ring at its pivot.
    const w = 4.8, L = 14.2, rc = 1.6;
    const cross: V[] = [[w, -L, rc], [w, -w, 0.6], [L, -w, rc], [L, w, rc], [w, w, 0.6], [w, L, rc], [-w, L, rc], [-w, w, 0.6], [-L, w, rc], [-L, -w, rc], [-w, -w, 0.6], [-w, -L, rc]];
    const g = control('dpad', 'rock', 1.2, -WELL.x, WELL.y, 0);
    const b = new Builder();
    b.add(slab(rounded(cross), [], -4.6, 1.5, 0.8, 3), bronze);
    for (let k = 0; k < 4; k++) {
      const tri = new THREE.Shape([new THREE.Vector2(0, 2.0), new THREE.Vector2(-1.7, -0.6), new THREE.Vector2(1.7, -0.6)]);
      const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1 });
      tg.translate(0, 9.6, 1.5);
      tg.rotateZ((k * Math.PI) / 2);
      b.add(tg, brassPlain);
    }
    const ring = new THREE.TorusGeometry(2.6, 0.28, 8, 40);
    b.add(ring, brassPlain, at(0, 0, 1.55));
    const dimple = lathe([[2.3, 0.15], [1.2, 0], [0, -0.2]], 32); dimple.rotateX(Math.PI / 2);
    b.add(dimple, bronze, at(0, 0, 1.5));
    b.build(g, 'dpad');

    // Two ivory domes riding on the membrane.
    for (const [name, [x, y]] of [['a', BTN.a], ['b', BTN.b]] as const) {
      const bg = control(name, 'push', 1.1, x, y, 0);
      const bb = new Builder();
      const prof: P2[] = [[0, 1.9], [0.35, 1.9], [2.4, 1.78], [4.2, 1.42], [5.3, 0.95], [5.85, 0.35], [6, -0.2], [6, -4.4], [6.7, -4.4], [6.7, -5]];
      const dome = lathe(prof.slice().reverse(), 48); dome.rotateX(Math.PI / 2);
      bb.add(dome, ivory);
      bb.build(bg, name);
    }

    // Select and start: rubber pills.
    for (const [name, sx] of [['select', -1], ['start', 1]] as const) {
      const pg = control(name, 'push', 0.8, sx * PILL.x, PILL.y, 0);
      const pb = new Builder();
      pb.add(slab(rounded(rrect(0, 0, PILL.w, PILL.h, PILL.h / 2 - 0.01)), [], -4, 0.9, 0.7, 3), rubber);
      pb.build(pg, name);
    }

    // Shoulder keys on hinge pins, with grip ridges.
    for (const [name, sx] of [['l', -1], ['r', 1]] as const) {
      const sg = control(name, 'rock', 1.4, sx * 72, 49.6, -17.6);
      const sbld = new Builder();
      sbld.add(rbox(25, 4.6, 11.6, 1.8, 3), bronze);
      for (let k = 0; k < 5; k++) sbld.add(rbox(0.7, 0.6, 9.6, 0.25), bronze, at(sx * (2 + k * 2.2), 2.4, 0));
      const pin = new THREE.CylinderGeometry(1.3, 1.3, 12.6, 20); pin.rotateX(Math.PI / 2);
      sbld.add(pin, brassPlain, at(-sx * 13.2, -1.2, 0));
      sbld.build(sg, name);
    }

    // The power slider and the volume wheel with its knurled rim.
    const ps = control('power', 'slide', 3, -48.5, 49.3, -5.6);
    const psb = new Builder();
    psb.add(rbox(4.4, 2.6, 2.6, 0.8), brassPlain);
    for (let k = 0; k < 3; k++) psb.add(rbox(0.5, 0.4, 2.2, 0.15), brassPlain, at(-1.1 + k * 1.1, 1.4, 0));
    psb.build(ps, 'power');
    const wg = control('wheel', 'slide', 0, 93.6, 12, -11);
    const wb = new Builder();
    const disc = new THREE.CylinderGeometry(7, 7, 3.2, 64); disc.rotateX(Math.PI / 2);
    wb.add(disc, brassPlain);
    for (let k = 0; k < 44; k++) { const a = (k / 44) * Math.PI * 2; wb.add(rbox(0.7, 0.9, 3.0, 0.2), brassPlain, at(Math.cos(a) * 7.05, Math.sin(a) * 7.05, 0, [0, 0, a])); }
    wb.build(wg, 'wheel');

    // The cartridge in its slot: bronze, a ribbed grip, an ivory label.
    const cart = new Builder();
    cart.add(rbox(58, 18, 6.2, 1.2, 3), bronze, at(0, 50, -17.5));
    for (let k = 0; k < 4; k++) cart.add(rbox(48, 0.7, 0.8, 0.3), bronze, at(0, 54.6 + k * 1.15, -14.35));
    cart.add(rbox(40, 3.4, 0.4, 0.2), ivory, at(0, 50.4, -14.3));
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(38.4, 3.0), cartLabel());
    lab.position.set(0, 50.4, -14.08);
    lab.name = 'cartLabel';
    con.add(lab);
    cart.build(con, 'cart');
  }

  const toWorld = (v: THREE.Vector3) => { pivot.updateMatrix(); con.updateMatrix(); return v.applyMatrix4(con.matrix).applyMatrix4(pivot.matrix); };
  // ---- the stand: a stone plinth, brass rails either side of the console's foot, a bent rest behind ---------
  {
    const b = new Builder();
    b.add(rbox(244, 22, 104, 3, 3), stone, at(0, -11, -10));
    b.add(rbox(252, 4.2, 112, 1.6, 2), bronze, at(0, -23.9, -10));
    b.add(rbox(236, 1.2, 1.0, 0.4, 2), brassPlain, at(0, -4.2, 42.2));
    b.add(rbox(52, 9, 1.6, 0.8, 3), brassPlain, at(0, -12.2, 42.4));
    const ps = screw(0.9);
    for (const sx of [-1, 1]) { b.add(ps.head, steel, at(sx * 23, -12.2, 43.2)); b.add(ps.slot, ink, at(sx * 23, -12.2, 43.2, [0, 0, sx * 0.6])); }
    const foot = toWorld(new THREE.Vector3(0, -48, 0));
    b.add(rbox(222, 3.2, 2.6, 1.0, 2), brassPlain, at(0, 1.5, foot.z + 2.2));
    b.add(rbox(222, 3.2, 2.6, 1.0, 2), brassPlain, at(0, 1.5, HH.PIVOT[2] - 2.6));
    // The rest: two rods bent up from the plinth to the console's back, joined by a bar that it leans on.
        const touch = (x: number) => toWorld(new THREE.Vector3(x, 22, -27.5));
    for (const sx of [-1, 1]) {
      const top = touch(sx * 36);
      const path = new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 36, 0, -52), new THREE.Vector3(sx * 36, 22, -52), new THREE.Vector3(sx * 36, top.y - 16, top.z - 9), top]);
      b.add(new THREE.TubeGeometry(path, 48, 1.8, 14), brassPlain);
      b.add(new THREE.CylinderGeometry(4.2, 4.6, 2.2, 32), brassPlain, at(sx * 36, 1.1, -52));
    }
    const l = touch(-36), r = touch(36);
    b.add(new THREE.TubeGeometry(new THREE.LineCurve3(l, r), 4, 1.8, 14), brassPlain);
    const fl = new THREE.PlaneGeometry(8000, 8000); fl.rotateX(-Math.PI / 2);
    b.add(fl, floor, at(0, -26, 0));
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(48, 6.4), plaqueText());
    plaque.position.set(0, -12.2, 43.25);
    plaque.name = 'plaque';
    root.add(plaque);
    for (const m of b.build(root, 'stand')) if (m.material === floor) m.userData.noWire = true;
  }

  const centre = toWorld(new THREE.Vector3(0, 0, -6));
  return { root, pivot, console: con, controls, screen, lcd, led, glass, centre };
}
