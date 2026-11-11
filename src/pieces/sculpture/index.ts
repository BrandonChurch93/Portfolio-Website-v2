import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { COLORS, type Tier } from '../../config/site';
import { clock } from '../../world/clock';
import type { Piece, PieceOptions } from '../../world/piece';
import { Stage } from '../../world/stage';
import { SCULPT, buildSculpture, type SculptureModel } from './model';

// The sculpture under a gallery spot. It turns slowly; the plane that splits finished surface from line follows the
// visitor's lamp, so the lamp decides which half is made. It enters as lines drawn along the knot, then the surface
// fills in to the split.

const D2R = Math.PI / 180;
const REST = { az: 18, el: 9, d: 1.7 };
const DRIFT = { az: 2.2, el: 0.9, period: [27, 35] as const };
const LAMP_Z = 0.45;
const LAMP_POWER = 0.5;
const TURN = 0.11;
export const ENTRANCE = { draw: [0.1, 1.3] as const, fill: [0.6, 2.2] as const, spin: [0, 2.6] as const, end: 2.8 } as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const smooth = (k: number) => k * k * (3 - 2 * k);

let areaLib = false;

export function createSculpture(): Piece {
  let stage: Stage | null = null;
  let model: SculptureModel | null = null;
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
  let making = false;
  const planeN = new THREE.Vector3(1, 0, 0.2).normalize();

  const time = () => hold ?? clock.now();
  const still = () => clock.isFrozen() || hold !== null;
  const entranceTime = () => entranceOverride ?? (still() ? ENTRANCE.end : pending ? 0 : entranceAt === null ? ENTRANCE.end : time() - entranceAt);
  const target = () => new THREE.Vector3(0, SCULPT.CENTRE - 190, 0).multiplyScalar(SCULPT.SCALE);

  const place = (cam: THREE.PerspectiveCamera, v: { az: number; el: number; d: number }, at = aim) => {
    const c = at ?? target();
    let d = v.d;
    if (!at && stage) {
      const asp = stage.width / Math.max(1, stage.height);
      const hw = Math.tan(((stage.camera.fov / 2) * Math.PI) / 180) * asp;
      d = Math.max(d, (asp < 0.6 ? 0.25 : 0.34) / hw) * frameOpt.scale;
      // A tall piece on a tall screen fits by its height: the whole sculpture and pedestal in about half the frame.
      if (asp < 0.8) d = Math.max(d, 0.78 / Math.tan(((stage.camera.fov / 2) * Math.PI) / 180));
    }
    const a = v.az * D2R, e = v.el * D2R;
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
    stage.lamp.position.set(THREE.MathUtils.clamp(p.x * 1.3, -0.7, 0.7), THREE.MathUtils.clamp(p.y, 0.0, 0.7), LAMP_Z);
  };

  const apply = () => {
    if (!stage || !model) return;
    const m = model;
    const t = time();
    const o = entranceTime();
    placeLamp();
    // It turns slowly on its table.
    // In the entrance it also turns in, a quarter turn that slows to the rest speed.
    const sp = span(o, ...ENTRANCE.spin);
    m.turn.rotation.y = t * TURN - (1 - (1 - (1 - sp) ** 3)) * 1.4;
    // The split plane: through the form's centre, its normal leaning toward the lamp across the view, so the side away
    // from the lamp is finished and the side toward it is line.
    const cam = stage.camera;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
    const fwd = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 2).setY(0).normalize();
    const lean = (lampUV.x - 0.5) * 2;
    const goal = right.clone().multiplyScalar(0.92).addScaledVector(fwd, 0.25).add(new THREE.Vector3(0, (0.5 - lampUV.y) * 0.5, 0)).normalize();
    planeN.lerp(goal, still() ? 1 : 0.05).normalize();
    m.uniforms.uPlaneN.value.copy(planeN);
    m.uniforms.uPlaneP.value.set(0, SCULPT.CENTRE * SCULPT.SCALE, 0).addScaledVector(right, lean * -0.06);
    // The entrance: lines drawn along the knot, then the surface comes in to the split.
    m.uniforms.uDraw.value = 0.0001 + 1.02 * smooth(span(o, ...ENTRANCE.draw));
    m.uniforms.uFill.value = smooth(span(o, ...ENTRANCE.fill));
    m.uniforms.uAll.value = making ? 1 : 0;
    m.uniforms.uSolid.value = making || stage.clay ? 1 : 0;
    m.uniforms.uGlow.value = stage.clay ? 0 : 1;
    m.glow.intensity = stage.clay || making ? 0 : 0.015 * smooth(clamp01(m.uniforms.uDraw.value));
    if (viewForced) place(stage.camera, view);
    else {
      const dz = still() ? 0 : Math.sin((t / DRIFT.period[0]) * Math.PI * 2) * DRIFT.az;
      const de = still() ? 0 : Math.sin((t / DRIFT.period[1]) * Math.PI * 2) * DRIFT.el;
      place(stage.camera, { ...REST, az: REST.az + dz, el: REST.el + de });
    }
    if (stage.scene.fog instanceof THREE.Fog) { const cd = stage.camera.position.distanceTo(target()); stage.scene.fog.near = cd + 0.3; stage.scene.fog.far = cd + 2.4; }
    stage.lamp.intensity = LAMP_POWER * smooth(span(o, 0, 0.8));
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
      await Promise.all(['500 20px "Sora Variable"', '600 20px "JetBrains Mono Variable"'].map((f) => document.fonts.load(f).catch(() => null)));
      stage = new Stage(h, canvas, { tier: opts.tier, fov: 28, near: 0.05, far: 8, env: 'studio', envIntensity: 0.75, exposure: 1.1, bloom: { strength: 0.08, threshold: 2.4, radius: 0.25 }, ao: 0.01, aoIntensity: 1, lampTarget: [0, 0.15, 0], lampAngle: 0.8 });
      model = await buildSculpture();
      stage.wireDensity = 0.5;
      stage.wireEdges = 12;
      const s = stage.scene;
      s.background = new THREE.Color(COLORS.bg);
      s.fog = new THREE.Fog(COLORS.bg, 1.2, 3.4);
      s.add(model.root);
      const c = target();
      // The gallery spot, straight above and a little in front: a pool of light on the pedestal, a soft shadow.
      const spot = new THREE.SpotLight(0xffe2c4, 2.2, 0, 0.34, 0.6, 2);
      spot.position.set(0.12, 1.55, 0.38);
      spot.target.position.set(0, 0.12, 0);
      spot.castShadow = true;
      spot.shadow.mapSize.set(2048, 2048);
      spot.shadow.bias = -0.0003;
      spot.shadow.normalBias = 0.002;
      spot.shadow.radius = 4;
      spot.shadow.camera.near = 0.5;
      spot.shadow.camera.far = 3;
      const rim = new THREE.RectAreaLight(0xffd6b0, 2.0, 0.6, 0.6);
      rim.position.set(-0.5, 0.5, -0.6);
      rim.lookAt(c);
      // A low soft fill from the front, so the pedestal's drum and plaque read below the pool of light.
      const fill = new THREE.RectAreaLight(0xffdcb8, 1.8, 0.8, 0.5);
      fill.position.set(0.35, 0.4, 1.0);
      fill.lookAt(0, -0.18, 0.05);
      s.add(spot, spot.target, rim, fill, model.glow, new THREE.HemisphereLight(0x3a2a1e, 0x0c0a09, 0.08));
      stage.lamp.target.position.copy(c);
      stage.resize();
      entranceAt = null;
      pending = opts.entrance && !clock.isFrozen();
      frameOpt = { shift: opts.frame?.shift ?? 0, scale: opts.frame?.scale ?? 1, x: opts.frame?.x ?? 0 };
      apply();
      await stage.warm();
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
    setMaking(on) { making = on; if (stage && model) stage.setMaking(on, model.root); frame(true); },
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
    aim(x: number | null, y = 0, z = 0) { aim = x === null ? null : new THREE.Vector3(x, y, z).multiplyScalar(SCULPT.SCALE); frame(true); },
    clay(on: boolean) { if (stage && model) stage.setClay(on, model.root); frame(true); },
    skip() { if (entranceAt !== null) entranceAt = Math.min(entranceAt, time() - ENTRANCE.end); },
  });
  return piece;
}

export default createSculpture;
