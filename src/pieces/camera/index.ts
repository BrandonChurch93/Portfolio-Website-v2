import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { COLORS, type Tier } from '../../config/site';
import { clock } from '../../world/clock';
import type { Piece, PieceOptions } from '../../world/piece';
import { Stage } from '../../world/stage';
import { CAM, IRIS, buildCamera, setIris, type CameraModel } from './model';

// The camera on its tripod. Its lens follows the visitor's lamp a little; the iris closes as the lamp lines up with the
// lens, as a meter would, and the lamp's light shows through the glass. As the page opens it turns in, fires and winds on.

const D2R = Math.PI / 180;
const REST = { az: 26, el: 8, d: 0.66 };
const DRIFT = { az: 2.4, el: 0.9, period: [23, 31] as const };
const LAMP_Z = 0.2;
const ENV = 1.9;
const LAMP_POWER = 0.34;
const TARGET_Y = -48;
// The entrance: the lamp warms, the camera turns in on its head, the shutter fires, the lever winds on.
export const ENTRANCE = { turn: [0.05, 1.15] as const, from: -70, fire: 1.3, wind: [1.55, 2.05] as const, end: 2.4 } as const;
const FIRE = { close: 0.12, open: 0.9 };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const smooth = (k: number) => k * k * (3 - 2 * k);
const easeOut = (k: number) => (k < 0.9 ? 1 - (1 - k / 0.9) ** 3 : 1 + Math.sin(((k - 0.9) / 0.1) * Math.PI) * 0.004);

let areaLib = false;

export function createCamera(): Piece {
  let stage: Stage | null = null;
  let model: CameraModel | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let off: (() => void) | null = null;
  let ro: ResizeObserver | null = null;
  let io: IntersectionObserver | null = null;
  let visible = true;
  let hold: number | null = null;
  let entranceAt: number | null = null;
  let entranceOverride: number | null = null;
  let pending = false;
  let lampUV = { x: 0.55, y: 0.3 };
  let view = { ...REST };
  let viewForced = false;
  let aim: THREE.Vector3 | null = null;
  let frameOpt = { shift: 0, scale: 1, x: 0 };
  let follow = { yaw: 0, pitch: 0, iris: IRIS.open };
  // The studio lights and their resting strengths, brought up in the entrance; the fill also carries the flash.
  let lights: { l: THREE.Light; k: number }[] = [];
  let fillLight: THREE.Light | null = null;

  const time = () => hold ?? clock.now();
  const still = () => clock.isFrozen() || hold !== null;
  const entranceTime = () => entranceOverride ?? (still() ? ENTRANCE.end : pending ? 0 : entranceAt === null ? ENTRANCE.end : time() - entranceAt);

  const target = () => new THREE.Vector3(0, TARGET_Y + (stage && stage.width / Math.max(1, stage.height) < 0.6 ? 26 : 0), 0).multiplyScalar(CAM.SCALE);

  const place = (cam: THREE.PerspectiveCamera, v: { az: number; el: number; d: number }, at = aim) => {
    const c = at ?? target();
    let d = v.d;
    let el = v.el;
    if (!at && stage) {
      const asp = stage.width / Math.max(1, stage.height);
      const hw = Math.tan(((stage.camera.fov / 2) * Math.PI) / 180) * asp;
      d = Math.max(d, (asp < 0.6 ? 0.122 : 0.17) / hw) * frameOpt.scale;
    }
    const a = v.az * D2R, e = el * D2R;
    cam.position.set(c.x + d * Math.cos(e) * Math.sin(a), c.y + d * Math.sin(e), c.z + d * Math.cos(e) * Math.cos(a));
    cam.lookAt(c);
    cam.updateMatrixWorld(true);
    if (stage && !at && (frameOpt.shift || frameOpt.x)) cam.setViewOffset(stage.width, stage.height, -frameOpt.x * stage.width, -frameOpt.shift * stage.height, stage.width, stage.height);
    else cam.clearViewOffset();
  };

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const restCam = new THREE.PerspectiveCamera();
  const placeLamp = () => {
    if (!stage) return;
    restCam.copy(stage.camera);
    place(restCam, REST, null);
    restCam.updateProjectionMatrix();
    ndc.set(lampUV.x * 2 - 1, 1 - lampUV.y * 2);
    ray.setFromCamera(ndc, restCam);
    const o = ray.ray.origin, d = ray.ray.direction;
    const p = o.clone().addScaledVector(d, (LAMP_Z - o.z) / d.z);
    stage.lamp.position.set(THREE.MathUtils.clamp(p.x * 1.4, -0.4, 0.4), THREE.MathUtils.clamp(p.y, -0.08, 0.3), LAMP_Z);
  };

  const axis = new THREE.Vector3(), front = new THREE.Vector3(), toLamp = new THREE.Vector3();
  const apply = () => {
    if (!stage || !model) return;
    const m = model;
    const t = time();
    const o = entranceTime();
    placeLamp();
    // The lens follows the lamp a little, on the tripod head.
    const goalYaw = (lampUV.x - 0.5) * 12 * D2R, goalPitch = (lampUV.y - 0.45) * 5 * D2R;
    const k = still() ? 1 : 0.05;
    follow.yaw += (goalYaw - follow.yaw) * k;
    follow.pitch += (goalPitch - follow.pitch) * k;
    const turn = easeOut(span(o, ...ENTRANCE.turn));
    m.body.rotation.set(follow.pitch * turn, (CAM.YAW + (1 - turn) * ENTRANCE.from) * D2R + follow.yaw * turn, 0);
    m.root.updateMatrixWorld(true);
    // How squarely the lamp faces the lens: the iris closes as it does, and its light shows through the glass.
    axis.set(0, 0, 1).transformDirection(m.lens.matrixWorld);
    front.set(0, 0, 54).applyMatrix4(m.lens.matrixWorld);
    toLamp.copy(stage.lamp.position).sub(front).normalize();
    const align = clamp01(axis.dot(toLamp));
    const lampK = stage.lamp.intensity / LAMP_POWER;
    const goalIris = THREE.MathUtils.lerp(IRIS.open, IRIS.closed + 2.5, smooth(span(align * lampK, 0.55, 0.97)));
    follow.iris += (goalIris - follow.iris) * (still() ? 1 : 0.04);
    // The shutter fires: the blades snap shut and open again.
    const df = o - ENTRANCE.fire;
    let shut = 0;
    if (df >= 0 && df < FIRE.close) shut = df / FIRE.close;
    else if (df >= FIRE.close && df < FIRE.close + FIRE.open) shut = 1 - smooth((df - FIRE.close) / FIRE.open);
    setIris(m.blades, THREE.MathUtils.lerp(follow.iris, 0.2, shut));
    // The flash fires with the shutter: a burst through the glass and on the room, gone in a quarter second.
    const flash = df >= 0 ? Math.exp(-df * 2.6) * Math.min(1, df / 0.06) : 0;
    m.glow.color.setRGB(1, 0.62, 0.3).multiplyScalar((0.14 + align ** 4 * 1.5 * lampK) * (1 - shut * 0.9) * (stage.clay ? 0 : 1));
    m.flash.color.setRGB(1, 0.86, 0.66).multiplyScalar(flash * 1.4 * (stage.clay ? 0 : 1));
    const up = smooth(span(o, 0, 0.7));
    for (const { l, k } of lights) l.intensity = k * up;
    stage.scene.environmentIntensity = ENV * (0.08 + 0.92 * up);
    const nod = df >= 0 && df < 0.6 ? Math.sin((df / 0.6) * Math.PI) * Math.exp(-df * 3) : 0;
    m.body.rotation.x -= nod * 1.6 * D2R;
    // The release goes down as it fires; the lever swings out and back to wind on.
    m.release.position.y = 41.5 - 1.1 * shut;
    const w = span(o, ...ENTRANCE.wind);
    m.lever.rotation.y = -Math.sin(w * Math.PI) * 2.0;
    m.speedDial.rotation.y = 0;
    for (const g of m.glass) { g.uniforms.uLamp.value.copy(stage.lamp.position); g.uniforms.uLampK.value = lampK; }
    // The camera: a slow drift around the rest view.
    if (viewForced) place(stage.camera, view);
    else {
      const dz = still() ? 0 : Math.sin((t / DRIFT.period[0]) * Math.PI * 2) * DRIFT.az;
      const de = still() ? 0 : Math.sin((t / DRIFT.period[1]) * Math.PI * 2) * DRIFT.el;
      place(stage.camera, { ...REST, az: REST.az + dz, el: REST.el + de });
    }
    if (stage.scene.fog instanceof THREE.Fog) { const cd = stage.camera.position.distanceTo(target()); stage.scene.fog.near = cd + 0.2; stage.scene.fog.far = cd + 1.5; }
    stage.lamp.intensity = LAMP_POWER * smooth(span(o, 0, 0.6));
    stage.hideForClay(m.root);
  };

  let held = false;
  const frame = (force = false) => {
    if (!stage || !visible) return;
    if (stage.tier === 'static' && held && !force && !clock.isFrozen()) return;
    apply();
    stage.render();
    held = true;
  };

  const piece: Piece = {
    async mount(h: HTMLElement, opts: PieceOptions) {
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      h.appendChild(canvas);
      if (!areaLib) { RectAreaLightUniformsLib.init(); areaLib = true; }
      await Promise.all(['600 20px "Sora Variable"', '600 20px "JetBrains Mono Variable"'].map((f) => document.fonts.load(f).catch(() => null)));
      stage = new Stage(h, canvas, { tier: opts.tier, fov: 26, near: 0.02, far: 6, env: 'studio', envIntensity: ENV, exposure: 1.3, bloom: { strength: 0.06, threshold: 2.2, radius: 0.12 }, ao: 0.006, aoIntensity: 1, lampTarget: [0, -0.02, 0], lampAngle: 0.9 });
      model = buildCamera();
      stage.wireDensity = 0.5;
      stage.wireEdges = 7;
      const s = stage.scene;
      s.background = new THREE.Color(COLORS.bg);
      s.fog = new THREE.Fog(COLORS.bg, 0.8, 2.2);
      s.add(model.root);
      const c = target();
      const key = new THREE.SpotLight(0xffd9b0, 0.6, 0, 0.55, 0.85, 2);
      key.position.set(-0.16, 0.6, 0.12);
      key.target.position.copy(c);
      // The key lights without a shadow of its own; the visitor's lamp throws the shadow, so it moves with the lamp.
      key.castShadow = false;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.bias = -0.0003;
      key.shadow.normalBias = 0.0015;
      key.shadow.radius = 4;
      key.shadow.camera.near = 0.1;
      key.shadow.camera.far = 1.5;
      const rim = new THREE.RectAreaLight(0xffe2c8, 2.4, 0.5, 0.3);
      rim.position.set(0.32, 0.12, -0.4);
      rim.lookAt(c);
      // A soft box in front and to the left, as a product shot is lit, so the front and the lens read.
      const fill = new THREE.RectAreaLight(0xffe4cc, 2.0, 0.5, 0.4);
      fill.position.set(-0.34, 0.04, 0.42);
      fill.lookAt(c);
      const rim2 = new THREE.RectAreaLight(0xffd2a8, 1.2, 0.3, 0.4);
      rim2.position.set(-0.42, 0.1, -0.2);
      rim2.lookAt(c);
      lights = [{ l: key, k: key.intensity }, { l: fill, k: fill.intensity }, { l: rim, k: rim.intensity }, { l: rim2, k: rim2.intensity }];
      fillLight = fill;
      s.add(key, key.target, fill, rim, rim2, new THREE.HemisphereLight(0x4a3626, 0x0c0a09, 0.12));
      stage.lamp.target.position.copy(c);
      stage.resize();
      entranceAt = null;
      pending = opts.entrance && !clock.isFrozen();
      frameOpt = { shift: opts.frame?.shift ?? 0, scale: opts.frame?.scale ?? 1, x: opts.frame?.x ?? 0 };
      apply();
      await stage.renderer.compileAsync(s, stage.camera);
      stage.render();
      ro = new ResizeObserver(() => { stage?.resize(); frame(true); });
      ro.observe(h);
      io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); });
      io.observe(h);
      off = clock.onFrame(() => frame());
      frame();
      opts.onReady?.();
    },
    setLamp(x, y) { lampUV = { x, y }; },
    setProgress(p) {
      if (pending && p > 0.02) { pending = false; entranceAt = time(); }
      frame();
    },
    setWaterLight() {},
    setMaking(on) { if (stage && model) stage.setMaking(on, model.root); frame(true); },
    setTier(tier: Tier) { stage?.setTier(tier); frame(true); },
    freeze(t) { hold = t; frame(); },
    view(az, el, dist) { view = { az, el, d: dist }; viewForced = true; frame(true); },
    dispose() {
      off?.(); ro?.disconnect(); io?.disconnect();
      stage?.dispose(); canvas?.remove();
      stage = null; model = null;
    },
  };
  Object.assign(piece, {
    opening(t: number | null) { entranceOverride = t; frame(); },
    aim(x: number | null, y = 0, z = 0) { aim = x === null ? null : new THREE.Vector3(x, y, z).multiplyScalar(CAM.SCALE); frame(true); },
    clay(on: boolean) { if (stage && model) stage.setClay(on, model.root); frame(true); },
    skip() { if (entranceAt !== null) entranceAt = Math.min(entranceAt, time() - ENTRANCE.end); },
  });
  return piece;
}

export default createCamera;
