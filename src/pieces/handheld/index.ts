import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { COLORS, type Tier } from '../../config/site';
import { clock } from '../../world/clock';
import type { Piece, PieceOptions } from '../../world/piece';
import { Stage } from '../../world/stage';
import { HH, buildHandheld, type HandheldModel } from './model';
import { BOOT } from './screen';

// The brass handheld: it leans on its rest and plays a small game made for the site. The game presses its own
// buttons; a visitor can press them too, and A makes the runner hop.

const D2R = Math.PI / 180;
const REST = { az: -17, el: 9, d: 0.5 };
const DRIFT = { az: 2.6, el: 1.0, period: [21, 29] as const };
const LAMP_Z = 0.19;
const LAMP_POWER = 0.07;
// The entrance: the console settles onto its rest, the power lamp lights, the screen opens and boots into the game.
export const ENTRANCE = { drop: [0.0, 1.5] as const, tip: [1.4, 2.0] as const, from: 125, power: 1.95, boot: 2.05, end: 2.05 + BOOT.wipe + 0.15 } as const;
// A piece met at rest shows the game this far in, so the run is under way.
const GAME_AHEAD = 30;
const PRESS = { hold: 0.12, release: 0.1 };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const smooth = (k: number) => k * k * (3 - 2 * k);
// Lowered by hand: it eases into view from above, slows as it nears the stand, and gives a fraction as it takes the
// weight.
const settle = (k: number) => { const q = Math.min(1, k / 0.88); const e = 1 - (1 - q) ** 2.2; return k < 0.88 ? e : 1 + Math.sin(((k - 0.88) / 0.12) * Math.PI) * 0.01; };

let areaLib = false;

export function createHandheld(): Piece {
  let stage: Stage | null = null;
  let model: HandheldModel | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let off: (() => void) | null = null;
  let ro: ResizeObserver | null = null;
  let io: IntersectionObserver | null = null;
  let visible = true;
  let hold: number | null = null;
  let entranceAt: number | null = null;
  let entranceOverride: number | null = null;
  let pending = false;
  let lampUV = { x: 0.6, y: 0.3 };
  let view = { ...REST };
  let viewForced = false;
  let aim: THREE.Vector3 | null = null;
  let yaw = 0;
  let gameT0 = -GAME_AHEAD;
  const hops: number[] = [];
  const pressedAt = new Map<string, { t: number; arm?: string }>();

  const time = () => hold ?? clock.now();
  const still = () => clock.isFrozen() || hold !== null;
  const entranceTime = () => entranceOverride ?? (still() ? ENTRANCE.end : pending ? 0 : entranceAt === null ? ENTRANCE.end : time() - entranceAt);

  const place = (cam: THREE.PerspectiveCamera, v: { az: number; el: number; d: number }, at = aim) => {
    if (!model) return;
    const c = at ?? model.centre.clone().multiplyScalar(HH.SCALE);
    let d = v.d;
    let el = v.el;
    if (!at && stage) {
      const asp = stage.width / Math.max(1, stage.height);
      const hw = Math.tan(((stage.camera.fov / 2) * Math.PI) / 180) * asp;
      d = Math.max(d, (asp < 0.8 ? 0.148 : 0.155) / hw);
      if (asp < 0.8) el += 10;
    }
    const a = v.az * D2R, e = el * D2R;
    cam.position.set(c.x + d * Math.cos(e) * Math.sin(a), c.y + d * Math.sin(e), c.z + d * Math.cos(e) * Math.cos(a));
    cam.lookAt(c);
    cam.updateMatrixWorld(true);
  };

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const restCam = new THREE.PerspectiveCamera();
  const placeLamp = () => {
    if (!stage || !model) return;
    restCam.copy(stage.camera);
    place(restCam, REST, null);
    restCam.updateProjectionMatrix();
    ndc.set(lampUV.x * 2 - 1, 1 - lampUV.y * 2);
    ray.setFromCamera(ndc, restCam);
    const o = ray.ray.origin, d = ray.ray.direction;
    const p = o.clone().addScaledVector(d, (LAMP_Z - o.z) / d.z);
    stage.lamp.position.set(THREE.MathUtils.clamp(p.x * 1.5, -0.4, 0.4), THREE.MathUtils.clamp(p.y, 0.02, 0.3), LAMP_Z);
  };

  const pressK = (name: string, t: number) => {
    const p = pressedAt.get(name);
    if (!p) return 0;
    const dt = t - p.t;
    if (dt < 0 || dt > PRESS.hold + PRESS.release) return 0;
    return dt < PRESS.hold ? 1 : 1 - (dt - PRESS.hold) / PRESS.release;
  };

  const apply = () => {
    if (!stage || !model) return;
    const m = model;
    const t = time();
    const o = entranceTime();
    // Entrance: the console comes down onto its rest with weight, tipping back into its lean.
    const k = settle(span(o, ...ENTRANCE.drop));
    m.pivot.position.set(HH.PIVOT[0], HH.PIVOT[1] + (1 - k) * ENTRANCE.from, HH.PIVOT[2]);
    // It answers the lamp with a small turn.
    const goal = (lampUV.x - 0.5) * 5 * D2R;
    yaw = still() ? goal : yaw + (goal - yaw) * 0.06;
    // Then it tips back onto its rest, and gives a fraction as the rest takes it.
    const tk = span(o, ...ENTRANCE.tip);
    const tip = tk < 0.8 ? (tk / 0.8) ** 2 : 1 + Math.sin(((tk - 0.8) / 0.2) * Math.PI) * 0.05;
    m.pivot.rotation.set(HH.LEAN * tip * D2R, yaw, 0);
    m.pivot.visible = k > 0.001 || o >= ENTRANCE.end;
    // Power: the lamp lights, the screen opens and boots, then the game runs.
    const power = o >= ENTRANCE.power ? 1 : 0;
    m.led.emissiveIntensity = power * (2.2 + 0.25 * Math.sin(t * 2.1));
    const boot = o < ENTRANCE.end && o >= ENTRANCE.boot ? o - ENTRANCE.boot : o < ENTRANCE.boot ? -1 : null;
    let g: number;
    if (entranceOverride !== null) g = Math.max(0, o - (ENTRANCE.boot + BOOT.title));
    else g = t - gameT0;
    m.screen.draw(o >= ENTRANCE.boot ? power : 0, boot !== null && boot >= 0 ? boot : null, g, hops);
    m.lcd.uniforms.uPower.value = o >= ENTRANCE.boot ? 1 : 0;
    // The controls: the game presses A on each jump and holds right while it runs; the visitor's presses add to it.
    const run = m.screen.run(g, hops);
    const playing = o >= ENTRANCE.boot + BOOT.title;
    for (const c of m.controls) {
      const gr = c.group;
      gr.matrix.copy(c.rest);
      gr.matrix.decompose(gr.position, gr.quaternion, gr.scale);
      const v = pressK(c.name, t);
      if (c.name === 'dpad') {
        const arm = pressedAt.get('dpad')?.arm;
        const right = playing && run.pressRight ? 1 : 0;
        const ax = v > 0 && arm ? arm : right ? 'right' : '';
        const kk = v > 0 && arm ? v : right;
        const deg = 4.5 * kk * D2R;
        if (ax === 'right') gr.rotateY(deg);
        else if (ax === 'left') gr.rotateY(-deg);
        else if (ax === 'up') gr.rotateX(-deg);
        else if (ax === 'down') gr.rotateX(deg);
      } else if (c.kind === 'push') {
        const auto = c.name === 'a' && playing ? run.aK : 0;
        gr.position.z -= c.depth * Math.max(v, auto);
      } else if (c.name === 'l' || c.name === 'r') {
        gr.position.y -= c.depth * v;
      } else if (c.name === 'power') {
        gr.position.x += 3 * (o >= ENTRANCE.power ? 1 : 0);
      }
    }
    // The camera: a slow drift around the rest view.
    if (viewForced) place(stage.camera, view);
    else {
      const dz = still() ? 0 : Math.sin((t / DRIFT.period[0]) * Math.PI * 2) * DRIFT.az;
      const de = still() ? 0 : Math.sin((t / DRIFT.period[1]) * Math.PI * 2) * DRIFT.el;
      place(stage.camera, { ...REST, az: REST.az + dz, el: REST.el + de });
    }
    if (stage.scene.fog instanceof THREE.Fog) { const cd = stage.camera.position.distanceTo(m.centre.clone().multiplyScalar(HH.SCALE)); stage.scene.fog.near = cd + 0.25; stage.scene.fog.far = cd + 1.6; }
    stage.lamp.intensity = LAMP_POWER * smooth(span(o, 0, 0.6));
    stage.hideForClay(m.root);
    placeLamp();
    m.glass.uniforms.uLamp.value.copy(stage.lamp.position);
    m.glass.uniforms.uLampK.value = stage.lamp.intensity / LAMP_POWER;
  };

  const frame = () => {
    if (!stage || !visible) return;
    apply();
    stage.render();
  };

  // Pressing a control with the pointer.
  const hit = (e: PointerEvent): { name: string; point: THREE.Vector3 } | null => {
    if (!stage || !model || !canvas) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
    ray.setFromCamera(ndc, stage.camera);
    const groups = model.controls.map((c) => c.group);
    const hits = ray.intersectObjects(groups, true);
    if (!hits.length) return null;
    let o: THREE.Object3D | null = hits[0].object;
    while (o && !groups.includes(o as THREE.Group)) o = o.parent;
    return o ? { name: o.name, point: hits[0].point } : null;
  };
  const onDown = (e: PointerEvent) => {
    const h = hit(e);
    if (!h || !model) return;
    const t = time();
    let arm: string | undefined;
    if (h.name === 'dpad') {
      const g = model.controls.find((c) => c.name === 'dpad')!.group;
      const p = g.worldToLocal(h.point.clone());
      arm = Math.abs(p.x) > Math.abs(p.y) ? (p.x > 0 ? 'right' : 'left') : p.y > 0 ? 'up' : 'down';
    }
    pressedAt.set(h.name, { t, arm });
    if (h.name === 'a') { hops.push(t - gameT0); if (hops.length > 8) hops.shift(); }
  };
  const onMove = (e: PointerEvent) => { if (canvas) canvas.style.cursor = hit(e) ? 'pointer' : ''; };

  const piece: Piece = {
    async mount(h: HTMLElement, opts: PieceOptions) {
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      h.appendChild(canvas);
      if (!areaLib) { RectAreaLightUniformsLib.init(); areaLib = true; }
      await Promise.all(['500 20px "Sora Variable"', '600 20px "Sora Variable"', '500 20px "JetBrains Mono Variable"'].map((f) => document.fonts.load(f).catch(() => null)));
      stage = new Stage(h, canvas, { tier: opts.tier, fov: 26, near: 0.02, far: 6, env: 'studio', envIntensity: 0.6, bloom: { strength: 0.1, threshold: 1.6, radius: 0.25 }, ao: 0.006, aoIntensity: 1, lampTarget: [0, 0.05, -0.008], lampAngle: 0.9 });
      model = buildHandheld();
      stage.wireDensity = 0.5;
      stage.wireEdges = 12;
      const s = stage.scene;
      s.background = new THREE.Color(COLORS.bg);
      s.fog = new THREE.Fog(COLORS.bg, 0.8, 2.2);
      s.add(model.root);
      const c = model.centre.clone().multiplyScalar(HH.SCALE);
      const key = new THREE.SpotLight(0xffd9b0, 1.0, 0, 0.5, 0.85, 2);
      key.position.set(-0.14, 0.62, 0.06);
      key.target.position.copy(c);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.bias = -0.0003;
      key.shadow.normalBias = 0.0015;
      key.shadow.radius = 4;
      key.shadow.camera.near = 0.1;
      key.shadow.camera.far = 1.5;
      const rim = new THREE.RectAreaLight(0xffe0c4, 1.2, 0.5, 0.25);
      rim.position.set(0.34, 0.26, -0.42);
      rim.lookAt(c);
      s.add(key, key.target, rim, new THREE.HemisphereLight(0x3a2a1e, 0x0c0a09, 0.05));
      stage.lamp.target.position.copy(c);
      stage.resize();
      entranceAt = null;
      pending = opts.entrance && !clock.isFrozen();
      gameT0 = -GAME_AHEAD;
      apply();
      await stage.renderer.compileAsync(s, stage.camera);
      stage.render();
      ro = new ResizeObserver(() => { stage?.resize(); frame(); });
      ro.observe(h);
      io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); });
      io.observe(h);
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      off = clock.onFrame(() => frame());
      frame();
      opts.onReady?.();
    },
    setLamp(x, y) { lampUV = { x, y }; },
    setProgress(p) {
      if (pending && p > 0.02) { pending = false; entranceAt = time(); gameT0 = entranceAt + ENTRANCE.boot + BOOT.title; }
      frame();
    },
    setWaterLight() {},
    setMaking(on) { if (stage && model) stage.setMaking(on, model.root); frame(); },
    setTier(tier: Tier) { stage?.setTier(tier); frame(); },
    freeze(t) { hold = t; frame(); },
    view(az, el, dist) { view = { az, el, d: dist }; viewForced = true; frame(); },
    dispose() {
      off?.(); ro?.disconnect(); io?.disconnect();
      canvas?.removeEventListener('pointerdown', onDown);
      canvas?.removeEventListener('pointermove', onMove);
      model?.screen.dispose();
      stage?.dispose(); canvas?.remove();
      stage = null; model = null;
    },
  };
  Object.assign(piece, {
    opening(t: number | null) { entranceOverride = t; frame(); },
    aim(x: number | null, y = 0, z = 0) { aim = x === null ? null : new THREE.Vector3(x, y, z).multiplyScalar(HH.SCALE); frame(); },
    clay(on: boolean) { if (stage && model) stage.setClay(on, model.root); frame(); },
    skip() { if (entranceAt !== null) { entranceAt = Math.min(entranceAt, time() - ENTRANCE.end); gameT0 = entranceAt + ENTRANCE.boot + BOOT.title; } },
    // Presses a control as a visitor would, for tests and strips.
    press(name: string, arm?: string) { const t = time(); pressedAt.set(name, { t, arm }); if (name === 'a') hops.push(t - gameT0); frame(); },
  });
  return piece;
}

export default createHandheld;
