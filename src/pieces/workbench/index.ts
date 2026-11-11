import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { COLORS, type Tier } from '../../config/site';
import { clock } from '../../world/clock';
import { dropScale } from '../../world/lightwater';
import type { Piece, PieceOptions } from '../../world/piece';
import { Stage } from '../../world/stage';
import { BENCH, buildBench, type BenchModel } from './model';

// The workbench: the scene for skills. One fixed light (the desk lamp and the lit monitor); the visitor's lamp is a
// soft extra light in front. Objects lift and turn a little under the cursor, as play, with no meaning attached.

const D2R = Math.PI / 180;
const REST = { az: 13, el: 22, d: 2.3, ty: 0.14 };
const DRIFT = { az: 2.2, el: 0.8, period: [23, 31] as const };
const LAMP_Z = 0.85;
const LAMP_POWER = 8;
// The entrance: tools settle onto the desk one after another, the screens come on, the desk lamp warms.
export const ENTRANCE = { order: ['lamp', 'monitor', 'keyboard', 'mouse', 'tablet', 'camera', 'lens', 'cap'], step: 0.3, drop: 1.1, from: 170, end: 3.4 } as const;
// The water on the desk moves at this many millimetres a second once it arrives.
const WATER_SPEED = 520;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const smooth = (k: number) => k * k * (3 - 2 * k);
// Settles with weight: it falls faster and faster, gives a little on landing, then is still.
const settle = (k: number) => (k < 0.8 ? (k / 0.8) ** 2 : 1 + Math.sin(((k - 0.8) / 0.2) * Math.PI) * 0.03 * (1 - (k - 0.8) / 0.2));

let areaLib = false;

export function createWorkbench(): Piece {
  let stage: Stage | null = null;
  let model: BenchModel | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let off: (() => void) | null = null;
  let ro: ResizeObserver | null = null;
  let io: IntersectionObserver | null = null;
  let visible = true;
  let hold: number | null = null;
  let entranceAt: number | null = null;
  let entranceOverride: number | null = null;
  let progress = 0;
  let waterK = 1;
  let waterAt: number | null = null;
  let landAt = 0.55;
  let waterOverride: number | null = null;
  let lampUV = { x: 0.6, y: 0.3 };
  let view = { ...REST };
  let viewForced = false;
  let aim: THREE.Vector3 | null = null;
  let deskLamp: THREE.SpotLight | null = null;
  let monLight: THREE.RectAreaLight | null = null;
  const lift = new Map<string, number>();

  const time = () => hold ?? clock.now();
  // An entrance waits, dark, until the desk scrolls into view.
  let pending = false;
  // Under a frozen clock (the test hooks) the piece is at rest unless a strip drives its entrance.
  const entranceTime = () => entranceOverride ?? (clock.isFrozen() || hold !== null ? ENTRANCE.end : pending ? 0 : entranceAt === null ? ENTRANCE.end : time() - entranceAt);

  const place = (cam: THREE.PerspectiveCamera, v: { az: number; el: number; d: number; ty: number }, at = aim) => {
    const a = v.az * D2R;
    let d = v.d;
    let el = v.el;
    if (!at && stage) { const asp = stage.width / Math.max(1, stage.height); const hw = Math.tan(((stage.camera.fov / 2) * Math.PI) / 180) * asp; d = Math.max(d, (asp < 0.8 ? 0.7 : 0.78) / hw); if (asp < 0.8) el += 26; }
    const e = el * D2R;
    const cx = at?.x ?? 0, cy = at?.y ?? v.ty, cz = at?.z ?? 0;
    cam.position.set(cx + d * Math.cos(e) * Math.sin(a), cy + d * Math.sin(e), cz + d * Math.cos(e) * Math.cos(a));
    cam.lookAt(cx, cy, cz);
    cam.updateMatrixWorld(true);
  };

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const restCam = new THREE.PerspectiveCamera();
  const lampAt = new THREE.Vector3();
  const placeLamp = () => {
    if (!stage) return;
    restCam.copy(stage.camera);
    place(restCam, REST, null);
    restCam.updateProjectionMatrix();
    ndc.set(lampUV.x * 2 - 1, 1 - lampUV.y * 2);
    ray.setFromCamera(ndc, restCam);
    const o = ray.ray.origin, d = ray.ray.direction;
    lampAt.copy(o).addScaledVector(d, (LAMP_Z - o.z) / d.z);
    stage.lamp.position.set(Math.max(-1.4, Math.min(1.4, lampAt.x * 1.4)), Math.max(0.15, Math.min(1.1, lampAt.y)), LAMP_Z);
  };

  const apply = () => {
    if (!stage || !model) return;
    const t = time();
    const o = entranceTime();
    const m = model;
    // Entrance: each tool drops onto the desk in turn; the desk lamp warms first, the screens come on as they land.
    ENTRANCE.order.forEach((name, i) => {
      const tl = m.tools.find((x) => x.name === name);
      if (!tl) return;
      const k = settle(span(o, i * ENTRANCE.step, i * ENTRANCE.step + ENTRANCE.drop));
      const up = (1 - k) * ENTRANCE.from + (lift.get(name) ?? 0);
      const g = tl.group;
      g.matrix.copy(tl.rest);
      g.matrix.decompose(g.position, g.quaternion, g.scale);
      g.position.y += up;
      g.rotateY((1 - k) * 0.12 * (i % 2 ? 1 : -1) + (lift.get(name) ?? 0) * 0.004);
      g.visible = k > 0.001 || o >= ENTRANCE.end;
    });
    const glow = smooth(span(o, 0.2, 1.4));
    const screens = smooth(span(o, 0.6, 1.8));
    if (deskLamp) deskLamp.intensity = 4.5 * glow;
    m.lampBulb.color.setRGB(1, 0.82, 0.63).multiplyScalar(2.4 * glow);
    if (monLight) monLight.intensity = 3.2 * screens;
    for (const s of m.screens) s.emissiveIntensity = screens * (s.name === 'tabletScreen' ? 0.32 : 0.55);
    m.monitor.draw(t);
    m.tablet.draw(t);
    stage.lamp.intensity = LAMP_POWER * smooth(span(o, 0.4, 1.6));
    // The water on the desk: it arrives when the page's reading line reaches the corner, then runs at its speed.
    const p = m.waterPath;
    let fill: number;
    if (waterOverride !== null) fill = waterOverride;
    // During the entrance the water waits until the desk is set, then arrives at its own speed.
    else if (entranceOverride !== null || (entranceAt !== null && o < ENTRANCE.end)) fill = Math.max(0, o - (ENTRANCE.end - 0.4)) * WATER_SPEED * 2.4;
    else if (clock.isFrozen() || hold !== null) fill = progress >= landAt ? p.sEnd : 0;
    else fill = waterAt === null ? 0 : (t - waterAt) * WATER_SPEED;
    for (const w of m.water) { w.uniforms.uFill.value = fill; w.uniforms.uTime.value = t; w.uniforms.uGain.value = w.userData.gain * waterK; }
    const wetRun = clamp01((fill - p.sLand) / (p.sPour - p.sLand));
    m.wood.userData.uniforms.uWetX0.value = fill > p.sLand ? p.land.x - 30 : -1e4;
    m.wood.userData.uniforms.uWetX.value = p.land.x + (p.pour.x - p.land.x + 40) * wetRun;
    m.drops.uniforms.uTime.value = t;
    m.ride.uniforms.uTime.value = t;
    m.ride.uniforms.uFill.value = fill;
    m.ride.uniforms.uPx.value = dropScale(stage.camera, stage.height * stage.renderer.getPixelRatio(), BENCH.SCALE);
    m.drops.uniforms.uOp.value = fill > p.sLand ? 1 : 0;
    m.drops.uniforms.uPx.value = dropScale(stage.camera, stage.height * stage.renderer.getPixelRatio(), BENCH.SCALE);
    m.waterLight.intensity = (stage.clay ? 0 : 3) * smooth(clamp01((fill - p.sLand) / 300)) * waterK;
    // The camera: a slow drift around the rest view.
    if (viewForced) place(stage.camera, view);
    else {
      const still = clock.isFrozen() || hold !== null;
      const dz = still ? 0 : Math.sin((t / DRIFT.period[0]) * Math.PI * 2) * DRIFT.az;
      const de = still ? 0 : Math.sin((t / DRIFT.period[1]) * Math.PI * 2) * DRIFT.el;
      place(stage.camera, { ...REST, az: REST.az + dz, el: REST.el + de });
    }
    if (stage.scene.fog instanceof THREE.Fog) { const cd = stage.camera.position.length(); stage.scene.fog.near = cd + 0.6; stage.scene.fog.far = cd + 3.6; }
    stage.hideForClay(m.root);
    placeLamp();
  };

  // Tools near the lamp lift a few millimetres and turn a degree or two.
  const play = () => {
    if (!stage || !model) return;
    // A frozen clock is the rest state: no lift, whatever the lamp did before the freeze.
    if (clock.isFrozen()) { lift.clear(); return; }
    const tmp = new THREE.Vector3();
    for (const tl of model.tools) {
      tmp.setFromMatrixPosition(tl.rest).multiplyScalar(BENCH.SCALE);
      const d = Math.hypot(tmp.x - lampAt.x, tmp.z * 0.6 - lampAt.y * 0.3);
      const goal = Math.exp(-d / 0.12) * 6;
      lift.set(tl.name, (lift.get(tl.name) ?? 0) + (goal - (lift.get(tl.name) ?? 0)) * 0.1);
    }
  };

  const frame = () => {
    if (!stage || !visible) return;
    play();
    apply();
    stage.render();
  };

  const piece: Piece = {
    async mount(h: HTMLElement, opts: PieceOptions) {
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      h.appendChild(canvas);
      if (!areaLib) { RectAreaLightUniformsLib.init(); areaLib = true; }
      stage = new Stage(h, canvas, { tier: opts.tier, fov: 30, near: 0.05, far: 12, bloom: { strength: 0.18, threshold: 2.2, radius: 0.25 }, ao: 0.012, aoIntensity: 1, envIntensity: 0.05, lampTarget: [0, 0.05, 0.05], lampAngle: 1.1 });
      model = buildBench();
      stage.wireDensity = 0.08;
      const s = stage.scene;
      s.background = new THREE.Color(COLORS.bg);
      s.fog = new THREE.Fog(COLORS.bg, 2.6, 5.5);
      s.add(model.root, model.waterLight);
      const M = BENCH.SCALE;
      deskLamp = new THREE.SpotLight(0xffc98f, 4.5, 0, 58 * D2R, 0.85, 2);
      deskLamp.position.set(-422 * M, 438 * M, -16 * M);
      deskLamp.target.position.set(-180 * M, 0, 110 * M);
      deskLamp.castShadow = true;
      deskLamp.shadow.mapSize.set(2048, 2048);
      deskLamp.shadow.bias = -0.0006;
      deskLamp.shadow.normalBias = 0.004;
      deskLamp.shadow.radius = 5;
      deskLamp.shadow.camera.near = 0.05;
      deskLamp.shadow.camera.far = 3;
      monLight = new THREE.RectAreaLight(0xffc48a, 3.2, 0.704, 0.396);
      monLight.position.set(40 * M, 345 * M, -200 * M);
      monLight.lookAt(40 * M, 150 * M, 310 * M);
      const rim = new THREE.RectAreaLight(0xffe0c4, 0.5, 1.7, 0.5);
      rim.position.set(0.7, 0.95, -1.25);
      rim.lookAt(0, 0.15, 0);
      s.add(deskLamp, deskLamp.target, monLight, rim, new THREE.HemisphereLight(0x3a2a1e, 0x0c0a09, 0.04));
      stage.resize();
      entranceAt = null;
      pending = opts.entrance && !clock.isFrozen();
      const hidden: THREE.Object3D[] = [];
      s.traverse((ob) => { if (!ob.visible) { hidden.push(ob); ob.visible = true; } });
      apply();
      await stage.renderer.compileAsync(s, stage.camera);
      stage.render();
      for (const ob of hidden) ob.visible = false;
      ro = new ResizeObserver(() => { stage?.resize(); frame(); });
      ro.observe(h);
      io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); });
      io.observe(h);
      off = clock.onFrame(() => frame());
      frame();
      opts.onReady?.();
    },
    setLamp(x, y) { lampUV = { x, y }; },
    setProgress(p) {
      progress = p;
      if (pending && p > 0.08) { pending = false; entranceAt = time(); }
      if (p >= landAt && waterAt === null) waterAt = time();
      if (p < landAt - 0.3) waterAt = null;
      frame();
    },
    setWaterLight(k) { waterK = 0.6 + 0.4 * clamp01(k); },
    setMaking(on) { if (stage && model) stage.setMaking(on, model.root); frame(); },
    setTier(tier: Tier) { stage?.setTier(tier); frame(); },
    freeze(t) { hold = t; frame(); },
    view(az, el, dist) { view = { az, el, d: dist, ty: REST.ty }; viewForced = true; frame(); },
    dispose() {
      off?.(); ro?.disconnect(); io?.disconnect(); stage?.dispose(); canvas?.remove();
      stage = null; model = null;
    },
  };
  Object.assign(piece, {
    // The entrance at t seconds, for strips; null releases it.
    opening(t: number | null) { entranceOverride = t; frame(); },
    // The water on the desk at a given distance along its route (mm); null releases it.
    water(sv: number | null) { waterOverride = sv; frame(); },
    aim(x: number | null, y = 0, z = 0) { aim = x === null ? null : new THREE.Vector3(x, y, z).multiplyScalar(BENCH.SCALE); frame(); },
    // Where the water lands and pours, as fractions of the host at rest, so the page's stream can meet it.
    anchor() {
      if (!stage || !model) return null;
      const cam = new THREE.PerspectiveCamera().copy(stage.camera);
      place(cam, REST, null);
      cam.updateProjectionMatrix();
      const f = (v: THREE.Vector3) => { const q = v.clone().multiplyScalar(BENCH.SCALE).project(cam); return { x: (q.x + 1) / 2, y: (1 - q.y) / 2 }; };
      const wp = model.waterPath;
      // Where the desk's own fall crosses the top of the frame and its pour crosses the bottom: the page's stream
      // arrives and leaves exactly there, so the two read as one.
      const fallAt = (y: number) => f(new THREE.Vector3(wp.land.x - 6, wp.land.y + y, wp.land.z + 4));
      let lo = 0, hi = wp.fallTop;
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fallAt(m).y > 0) lo = m; else hi = m; }
      const top = fallAt(hi);
      const pourAt = (t: number) => f(new THREE.Vector3(wp.pour.x + 4 + wp.pourVx * t, 0.6 - 0.5 * wp.g * t * t, BENCH.FRONT - 8 + 60 * t));
      let a = 0, b = wp.pourT;
      for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (pourAt(m).y < 1) a = m; else b = m; }
      const bottom = pourAt(b);
      const land = f(wp.land), pour = f(wp.pour);
      landAt = land.y;
      return { land: { x: top.x, y: land.y }, pour: { x: Math.min(0.995, bottom.x), y: pour.y } };
    },
    clay(on: boolean) { if (stage && model) stage.setClay(on, model.root); frame(); },
    skip() { if (entranceAt !== null) entranceAt = Math.min(entranceAt, time() - ENTRANCE.end); },
  });
  return piece;
}

export default createWorkbench;
