import * as THREE from 'three';
import { dropScale } from '../../world/lightwater';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { COLORS, type Tier } from '../../config/site';
import { clock } from '../../world/clock';
import type { Piece, PieceOptions } from '../../world/piece';
import { Stage } from '../../world/stage';
import { RKT, buildRocket, type RocketModel } from './model';

// The rocket on its pad in the pool where the page's water ends. As the Contact section scrolls into view the gantry
// builds and the stages are stacked, both ways with the scroll; at the end of the page, once per visit, it launches:
// ignition, the clamps let go, the arms swing away, a slow heavy climb out of the frame, the exhaust lighting the pad
// and the pool. After that the pad rests, lit by the pool.

const D2R = Math.PI / 180;
const REST = { az: 28, el: 11, d: 2.0 };
const DRIFT = { az: 2.0, el: 0.8, period: [26, 34] as const };
const TARGET = [46, 300, 0] as const;
const LAMP_Z = 0.55;
const LAMP_POWER = 1.8;
const LAUNCH_FLAG = 'played:rocket-launch';
const LAUNCH_RES = 0.7;
// How fast the water's front comes along the flume once the page's stream reaches the stage, mm/s.
const WATER_SPEED = 520;
// The entrance: the pool fills with light, the floods come on, the beacons start.
export const ENTRANCE = { pool: [0, 1.8] as const, floods: 1.3, flicker: 0.5, end: 3.2 } as const;
// Assembly, as fractions of the scroll through the section: the gantry, stage one, stage two, the nose, the arms, the lights.
export const ASSEMBLY = { gantry: [0, 0.3] as const, s1: [0.3, 0.45] as const, s2: [0.45, 0.6] as const, nose: [0.6, 0.72] as const, arms: [0.72, 0.85] as const, lights: [0.85, 0.95] as const, from: 800, tops: [330, 480, 640] as const, seat: 0.78 } as const;
// The launch, in seconds from ignition.
export const LAUNCH = { ignite: 0.3, clamps: 1.0, arms: [0.5, 1.6] as const, lift: 1.5, gone: 2600, end: 11 } as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const smooth = (k: number) => k * k * (3 - 2 * k);
// Lowered by the crane: it slows as it comes down and settles onto what is below.
const lower = (k: number) => 1 - (1 - k) ** 3;

let areaLib = false;

export function createRocket(): Piece {
  let stage: Stage | null = null;
  let model: RocketModel | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let off: (() => void) | null = null;
  let ro: ResizeObserver | null = null;
  let io: IntersectionObserver | null = null;
  let visible = true;
  let hold: number | null = null;
  let entranceAt: number | null = null;
  let entranceOverride: number | null = null;
  let pending = false;
  let progress = 0;
  let assemblyLive = 0;
  let assemblyOverride: number | null = null;
  let launchAt: number | null = null;
  let launchOverride: number | null = null;
  let launched = false;
  let waterAt: number | null = null;
  let lampUV = { x: 0.55, y: 0.3 };
  let view = { ...REST };
  let viewForced = false;
  let aim: THREE.Vector3 | null = null;
  let frameOpt = { shift: 0, scale: 1, x: 0 };

  const time = () => hold ?? clock.now();
  const still = () => clock.isFrozen() || hold !== null;
  const entranceTime = () => entranceOverride ?? (still() ? ENTRANCE.end : pending ? 0 : entranceAt === null ? ENTRANCE.end : time() - entranceAt);
  const target = () => new THREE.Vector3(...TARGET).multiplyScalar(RKT.SCALE);

  const place = (cam: THREE.PerspectiveCamera, v: { az: number; el: number; d: number; pull?: number }, at = aim) => {
    const c = at ?? target();
    let d = v.d;
    if (!at && stage) {
      const asp = stage.width / Math.max(1, stage.height);
      const hw = Math.tan(((stage.camera.fov / 2) * Math.PI) / 180) * asp;
      const th = Math.tan(((stage.camera.fov / 2) * Math.PI) / 180);
      d = asp < 0.8 ? Math.max(d, 0.3 / hw, 0.46 / th) * frameOpt.scale : Math.max(d, 0.62 / hw) * frameOpt.scale;
      d *= v.pull ?? 1;
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
    stage.lamp.position.set(THREE.MathUtils.clamp(p.x * 1.3, -1, 1), THREE.MathUtils.clamp(p.y, 0.05, 1.0), LAMP_Z);
  };

  // Seconds since ignition, or null if it has not launched (or will not, for the rest of this visit).
  const launchTime = (): number | null => {
    if (launchOverride !== null) return launchOverride;
    if (launched && launchAt === null) return LAUNCH.end;
    if (launchAt === null) return null;
    return time() - launchAt;
  };

  const apply = () => {
    if (!stage || !model) return;
    const m = model;
    const t = time();
    const o = entranceTime();
    placeLamp();
    // Assembly.
    const a = assemblyOverride ?? (still() ? 1 : assemblyLive);
    const g = span(a, ...ASSEMBLY.gantry) * (m.gantry.length + 1);
    m.gantry.forEach((sec, k) => {
      const kk = clamp01(g - k);
      sec.visible = kk > 0.001;
      sec.position.y = k * 40 + (1 - lower(kk)) * 40;
    });
    for (const p of m.tied) {
      const kk = clamp01(g - p.y / 40);
      p.obj.visible = kk > 0.001;
      p.obj.position.y = p.base + (1 - lower(kk)) * 40;
    }
    // Each stage comes down on the sling from above the frame and seats; the hook lets go and the cable goes back up.
    const lowered: number[] = [];
    m.sling.visible = false;
    [ASSEMBLY.s1, ASSEMBLY.s2, ASSEMBLY.nose].forEach(([a0, a1], i) => {
      const cut = a0 + (a1 - a0) * ASSEMBLY.seat;
      const u = lower(span(a, a0, cut));
      lowered.push(u);
      const y = (1 - u) * ASSEMBLY.from;
      m.stages[i].position.y = y;
      m.stages[i].visible = u > 0.001;
      if (a > a0 && a < a1) {
        const up = smooth(span(a, cut, a1));
        m.sling.visible = true;
        m.sling.position.y = ASSEMBLY.tops[i] + y + up * ASSEMBLY.from;
        m.cable.scale.y = 3000;
      }
    });
    const [s1] = lowered;
    const armsIn = smooth(span(a, ...ASSEMBLY.arms));
    const lights = smooth(span(a, ...ASSEMBLY.lights));
    // The launch.
    const L = launchTime();
    const lt = L ?? -1;
    const ign = L === null ? 0 : smooth(span(lt, 0, LAUNCH.ignite + 0.5));
    const clampsOff = L === null ? 0 : smooth(span(lt, LAUNCH.clamps, LAUNCH.clamps + 0.35));
    const armsAway = L === null ? 0 : smooth(span(lt, ...LAUNCH.arms));
    const ti = Math.max(0, lt - LAUNCH.lift);
    const rise = L === null ? 0 : 16 * ti * ti + 13 * ti * ti * ti;
    m.rocket.position.y = rise;
    m.rocket.visible = rise < LAUNCH.gone;
    for (const c of m.clamps) c.group.rotation.z = -1.1 * clampsOff * Math.min(1, s1 * 3);
    for (const s of m.arms) s.group.rotation.y = (1 - armsIn) * s.out + armsAway * s.out * 0.9;
    // Exhaust: grows with ignition, flickers, stretches as the rocket climbs, fades once it is far up.
    const burning = L !== null && lt >= LAUNCH.ignite && rise < LAUNCH.gone;
    const fade = 1 - smoothSafe(rise, 600, 2400);
    const flick = 0.85 + 0.15 * Math.sin(t * 47) * Math.sin(t * 31 + 1);
    const plumeK = burning ? ign * flick * (0.6 + 0.4 * fade) : 0;
    m.plumeMat.uniforms.uK.value = plumeK * (stage.clay ? 0 : 1);
    m.plumeMat.uniforms.uTime.value = t;
    m.plume.scale.set(1, Math.min(60 + 170 * ign + Math.min(rise * 0.1, 60), 8 - (RKT.POOL + 40) + rise), 1);
    m.plume.visible = plumeK > 0.001 && !stage.clay;
    m.engineLight.intensity = stage.clay ? 0 : plumeK * 0.08;
    const near = burning ? (1 - smoothSafe(rise, 50, 700)) * ign : 0;
    (m.flash.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.6, 0.25).multiplyScalar(near * 0.9 * flick * (stage.clay ? 0 : 1));
    m.smokeMat.uniforms.uT.value = L === null ? -1 : lt - LAUNCH.ignite;
    m.smokeMat.uniforms.uLit.value = plumeK * 0.8;
    m.smokeMat.uniforms.uPx.value = (stage.height * stage.renderer.getPixelRatio()) / (2 * Math.tan(((stage.camera.fov / 2) * Math.PI) / 180)) * RKT.SCALE;
    m.smoke.visible = L !== null && !stage.clay;
    // The pool: rings and light; it answers the launch, then settles.
    const surge = L === null ? 0 : smooth(span(lt, LAUNCH.ignite, LAUNCH.lift + 0.8)) * (1 - smoothSafe(lt, 4, 9));
    // The water along the flume: full in a still, arriving with the entrance in the lab, and in the page once the
    // page's stream reaches the stage.
    const fl = m.flume;
    const wet = entranceOverride !== null ? Math.max(0, o - 0.3) * 760 : still() ? fl.sEnd + 2000 : waterAt === null ? 0 : (t - waterAt) * WATER_SPEED;
    for (const w of m.water) { w.uniforms.uFill.value = wet; w.uniforms.uTime.value = t; w.uniforms.uGain.value = (w.userData.gain ?? 0.6) * (stage.clay ? 0 : 1); }
    const px = dropScale(stage.camera, stage.height * stage.renderer.getPixelRatio(), RKT.SCALE);
    m.drops.uniforms.uTime.value = t; m.drops.uniforms.uPx.value = px; m.drops.uniforms.uOp.value = wet > fl.sLand && !stage.clay ? 1 : 0;
    m.ride.uniforms.uTime.value = t; m.ride.uniforms.uFill.value = wet; m.ride.uniforms.uPx.value = px;
    const inlet = smooth(clamp01((wet - fl.sLand) / 260));
    m.inletLight.intensity = stage.clay ? 0 : 0.012 * smooth(clamp01(wet / 300));
    const pu = m.pool.userData.uniforms;
    pu.uInlet.value.z = inlet;
    const fill = smooth(span(o, ...ENTRANCE.pool));
    pu.uTime.value = t;
    pu.uSurge.value = surge;
    pu.uFill.value = fill;
    pu.uGain.value = stage.clay ? 0 : 1;
    const cam = m.root.worldToLocal(stage.camera.position.clone());
    pu.uCam.value.set(cam.x, -cam.z, cam.y - RKT.POOL);
    m.poolLight.intensity = stage.clay ? 0 : (0.7 + 2.2 * surge + 2.5 * plumeK * fade) * fill;
    // Lights: floods on once the rocket stands and the entrance has brought them up; beacons blink.
    const warm = span(o, ENTRANCE.floods, ENTRANCE.floods + ENTRANCE.flicker);
    const floodsOn = (o < ENTRANCE.floods ? 0 : warm >= 1 ? 1 : (Math.sin(o * 61) > 0.1 ? 0.3 + 0.7 * warm : 0.08)) * lights;
    for (const f of m.floods) f.intensity = 0.02 * floodsOn;
    m.floodLens.color.setRGB(1, 0.86, 0.66).multiplyScalar(0.12 + 3 * floodsOn);
    const blink = Math.floor(t * 1.3) % 2 === 0 ? 1 : 0.15;
    const beam = (still() ? 1 : blink) * smooth(span(o, 0.4, 1.2));
    m.beacons.color.setRGB(1, 0.5, 0.15).multiplyScalar(beam * 2);
    m.beaconLight.intensity = stage.clay ? 0 : beam * 0.02 * (m.tied.every((p) => p.obj.visible) ? 1 : 0);
    m.portholes.emissiveIntensity = 1.2 * lights;
    // The camera: a slow drift; it tilts up a little to follow the climb.
    const follow = Math.min(rise, 500) * RKT.SCALE * 0.14 * (1 - smoothSafe(lt, 5, 8));
    if (viewForced) place(stage.camera, view);
    else {
      const dz = still() ? 0 : Math.sin((t / DRIFT.period[0]) * Math.PI * 2) * DRIFT.az;
      const de = still() ? 0 : Math.sin((t / DRIFT.period[1]) * Math.PI * 2) * DRIFT.el;
      const come = 1 - smooth(span(o, 0, ENTRANCE.end));
      place(stage.camera, { ...REST, az: REST.az + dz - 12 * come, el: REST.el + de + 18 * come, pull: 1 + 0.6 * come }, aim ?? (follow > 0 ? target().add(new THREE.Vector3(0, follow, 0)) : null));
    }
    if (stage.scene.fog instanceof THREE.Fog) { const cd = stage.camera.position.distanceTo(target()); stage.scene.fog.near = cd + 0.4; stage.scene.fog.far = cd + 3.2; }
    stage.lamp.intensity = LAMP_POWER * smooth(span(o, 0, 0.8));
    // The launch renders at a lower resolution while it plays (motion, exhaust and smoke hide it) and steps back up.
    stage.setResolutionScale(L !== null && lt < LAUNCH.end - 1 && !still() ? LAUNCH_RES : 1);
    stage.hideForClay(m.root);
    if (launchAt !== null && lt > LAUNCH.end) { launchAt = null; launched = true; }
  };
  const smoothSafe = (v: number, a: number, b: number) => smooth(span(v, a, b));

  let held = false;
  const frame = (force = false) => {
    if (!stage || !visible) return;
    if (stage.tier === 'static' && held && !force && !clock.isFrozen() && launchAt === null) return;
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
      stage = new Stage(h, canvas, { tier: opts.tier, fov: 30, near: 0.05, far: 12, env: 'studio', envIntensity: 0.42, exposure: 1.1, bloom: { strength: 0.12, threshold: 1.3, radius: 0.35 }, ao: 0.012, aoIntensity: 1, lampTarget: [0.03, 0.25, 0], lampAngle: 0.9 });
      model = buildRocket();
      stage.wireDensity = 0.5;
      stage.wireEdges = 12;
      const s = stage.scene;
      s.background = new THREE.Color(COLORS.bg);
      s.fog = new THREE.Fog(COLORS.bg, 1.5, 5);
      s.add(model.root);
      const c = target();
      const key = new THREE.SpotLight(0xffd6b0, 0.45, 0, 0.6, 0.8, 2);
      key.position.set(-0.7, 1.4, 1.0);
      key.target.position.copy(c);
      // The key has no shadow of its own; the visitor's lamp throws the shadow, so it moves with the lamp.
      key.castShadow = false;
      const rim = new THREE.RectAreaLight(0xffdcb8, 2.0, 0.8, 0.6);
      rim.position.set(0.6, 0.9, -0.9);
      rim.lookAt(c);
      s.add(key, key.target, rim, model.poolLight, model.beaconLight, model.inletLight, new THREE.HemisphereLight(0x3a2a1e, 0x0c0a09, 0.08));
      for (const f of model.floods) s.add(f, f.target);
      stage.lamp.target.position.copy(c);
      stage.resize();
      entranceAt = null;
      pending = opts.entrance && !clock.isFrozen();
      launched = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(LAUNCH_FLAG) === '1';
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
      progress = p;
      if (pending && p > 0.02) { pending = false; entranceAt = time(); }
      if (waterAt === null && p > 0.04 && !still()) waterAt = time();
      assemblyLive = clamp01((p - 0.02) / 0.6);
      // The launch: at the end of the page, once per visit, when the rocket stands ready.
      const doc = document.documentElement;
      const atEnd = innerHeight + scrollY >= doc.scrollHeight - 4 && doc.scrollHeight > innerHeight * 1.5;
      if (atEnd && !launched && launchAt === null && assemblyLive >= 1 && !still()) {
        launchAt = time();
        try { sessionStorage.setItem(LAUNCH_FLAG, '1'); } catch { /* storage may be off; the launch still plays once here */ }
      }
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
    anchor(edge = 0) {
      if (!stage || !model) return null;
      const cam = new THREE.PerspectiveCamera().copy(stage.camera);
      place(cam, REST, null);
      cam.updateProjectionMatrix();
      const f = (v: THREE.Vector3) => { const p = v.clone().multiplyScalar(RKT.SCALE).project(cam); return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 }; };
      const { lip, far } = model.flume;
      const at = (k: number) => f(lip.clone().lerp(far, k));
      const inside = (p: { x: number; y: number }) => p.x >= edge && p.x <= 1 - edge && p.y >= 0 && p.y <= 1;
      if (!inside(at(0)) || inside(at(1))) return null;
      let lo = 0, hi = 1;
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (inside(at(m))) lo = m; else hi = m; }
      const e = at(lo);
      return { x: Math.min(1, Math.max(0, e.x)), y: Math.min(1, Math.max(0, e.y)) };
    },
    opening(t: number | null) { entranceOverride = t; frame(); },
    assembly(p: number | null) { assemblyOverride = p; frame(true); },
    launch(t: number | null) { launchOverride = t; frame(true); },
    aim(x: number | null, y = 0, z = 0) { aim = x === null ? null : new THREE.Vector3(x, y, z).multiplyScalar(RKT.SCALE); frame(true); },
    clay(on: boolean) { if (stage && model) stage.setClay(on, model.root); frame(true); },
    skip() { if (entranceAt !== null) entranceAt = Math.min(entranceAt, time() - ENTRANCE.end); },
  });
  void progress;
  return piece;
}

export default createRocket;
