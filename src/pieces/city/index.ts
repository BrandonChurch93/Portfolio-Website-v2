import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type { Tier } from '../../config/site';
import { clock } from '../../world/clock';
import type { Piece, PieceOptions } from '../../world/piece';
import { Stage } from '../../world/stage';
import { buildCity, CITY, type CityModel } from './model';

// The floating city: the home page's hero. Constants that only this piece uses live here, so the piece can be
// replaced whole in the review stage.

const D2R = Math.PI / 180;
// The settled view and the opening's first view (degrees, metres).
const REST = { az: 0, el: 13, d: 2.25, ty: 0.24 };
const START = { az: -38, el: 74, d: 2.05, ty: -0.12 };
// The lamp hangs on an upright plane this far in front of the city's centre, where the cursor covers it.
const LAMP_Z = 0.9;
// The opening, in seconds from its start.
export const OPENING = {
  plan: [0.35, 2.0],
  planFade: [2.6, 3.6],
  lift: [1.7, 3.5],
  riseDelay: 1.0,
  fill: [4.7, 6.6],
  pools: [6.0, 6.9],
  camera: [0.2, 7.2],
  movers: [4.6, 5.6],
  end: 7.4,
} as const;
const FILL = { from: -200, to: 720 };
const GRID = { plan: 0.9, rest: 0.11 };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const span = (t: number, [a, b]: readonly [number, number]) => clamp01((t - a) / (b - a));
const smooth = (k: number) => k * k * (3 - 2 * k);
const easeOut3 = (k: number) => 1 - (1 - k) ** 3;
const easeInOut2 = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

let areaLib = false;

export function createCity(): Piece {
  let stage: Stage | null = null;
  let model: CityModel | null = null;
  let host: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let off: (() => void) | null = null;
  let ro: ResizeObserver | null = null;
  let io: IntersectionObserver | null = null;
  let visible = true;
  let hold: number | null = null;
  let openingAt: number | null = null;
  let openingOverride: number | null = null;
  let progress = 0;
  let waterK = 1;
  let lampUV = { x: 0.6, y: 0.3 };
  let view = { ...REST };
  let viewForced = false;
  let under: THREE.SpotLight | null = null;
  let aim: THREE.Vector3 | null = null;
  let clayOn = false;

  const time = () => hold ?? clock.now();
  const openingTime = () => openingOverride ?? (openingAt === null ? OPENING.end : time() - openingAt);

  // On a narrow screen the camera backs off so the whole disc stays in frame.
  const fit = (d: number) => {
    if (!stage) return d;
    const a = stage.width / Math.max(1, stage.height);
    return d * Math.max(1, 1.3 / a);
  };

  const place = (cam: THREE.PerspectiveCamera, v: { az: number; el: number; d: number; ty: number }, at = aim) => {
    const a = v.az * D2R, e = v.el * D2R, d = at ? v.d : fit(v.d);
    const cx = at?.x ?? 0, cy = at?.y ?? v.ty, cz = at?.z ?? 0;
    cam.position.set(cx + d * Math.cos(e) * Math.sin(a), cy + d * Math.sin(e), cz + d * Math.cos(e) * Math.cos(a));
    cam.lookAt(cx, cy, cz);
    cam.updateMatrixWorld(true);
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
    stage.lamp.position.set(Math.max(-1.1, Math.min(1.1, p.x)), Math.max(0.3, Math.min(1.05, p.y)), LAMP_Z);
  };

  const apply = () => {
    if (!stage || !model) return;
    const t = time();
    const o = openingTime();
    const m = model;
    // Plan and grid.
    const plan = smooth(span(o, OPENING.plan));
    m.plan.uniforms.uDraw.value = plan * 1.12;
    m.plan.uniforms.uFade.value = smooth(span(o, [OPENING.plan[0], OPENING.plan[0] + 0.3])) * (1 - smooth(span(o, OPENING.planFade)));
    m.slab.emissiveIntensity = mix(0, GRID.plan, smooth(span(o, [0.2, 1.2]))) * (1 - smooth(span(o, OPENING.planFade))) + GRID.rest * smooth(span(o, OPENING.planFade));
    // The disc rises out of the drawing to its height.
    const lift = easeInOut2(span(o, OPENING.lift));
    m.city.position.y = mix(-(CITY.LIFT + 60), 0, lift);
    m.city.visible = lift > 0;
    // Buildings rise in their order.
    for (const r of m.rises) {
      const k = easeOut3(span(o, [r.t0 + OPENING.riseDelay, r.t0 + OPENING.riseDelay + r.dur]));
      r.group.scale.y = Math.max(1e-3, k);
      r.group.visible = k > 0;
    }
    // Water fills the moat, the canals, then pours.
    const fill = mix(FILL.from, FILL.to, smooth(span(o, OPENING.fill)));
    for (const w of m.water) { w.uniforms.uFill.value = fill; w.uniforms.uTime.value = t; w.uniforms.uGain.value = w.userData.gain * waterK; }
    const pk = smooth(span(o, OPENING.pools));
    for (const pm of m.pools) { pm.uniforms.uOp.value = pk; pm.uniforms.uTime.value = t; }
    m.spray.uniforms.uOp.value = pk;
    for (const mm of m.mists) mm.opacity = pk * 0.55;
    for (const cm of m.crowns) { cm.uniforms.uOp.value = pk; cm.uniforms.uTime.value = t; }
    m.spray.uniforms.uTime.value = t;
    m.spray.uniforms.uPx.value = (stage.height * stage.renderer.getPixelRatio() * 0.5) / Math.tan((stage.camera.fov * Math.PI) / 360) * CITY.SCALE;
    for (const L of m.glowLights) L.intensity = L.userData.base * smooth(span(o, OPENING.pools));
    if (under) under.intensity = clayOn ? 0 : 0.7 * smooth(span(o, OPENING.fill));
    if (clayOn) for (const L of m.glowLights) L.intensity = 0;
    for (const r of m.rooms) r.userData.uniforms.uOn.value = smooth(span(o, [3.4, 5.4]));
    m.glow.uCityY.value = m.city.position.y * CITY.SCALE;
    m.glow.uWaterOn.value = clayOn ? 0 : smooth(span(o, OPENING.fill)) * waterK;
    m.glow.uLampsOn.value = clayOn ? 0 : smooth(span(o, [3.4, 5.4]));
    const movers = span(o, OPENING.movers);
    for (const mv of m.movers) { mv.mesh.visible = movers > 0; mv.update(t); }
    // Camera: from high over the plan down to the settled low view; scroll lifts it a little.
    if (viewForced) place(stage.camera, view);
    else {
      const k = span(o, OPENING.camera);
      const e = smooth(k) * 0.5 + easeOut3(k) * 0.5;
      place(stage.camera, {
        az: mix(START.az, REST.az, e),
        el: mix(START.el, REST.el, e) + progress * 9,
        d: mix(START.d, REST.d, e) + progress * 0.15,
        ty: mix(START.ty, REST.ty, e) + progress * 0.05,
      });
    }
    if (clayOn) model.root.traverse((ob) => { if (ob.userData.clayHidden) ob.visible = false; });
    placeLamp();
  };

  const frame = () => {
    if (!stage || !visible) return;
    apply();
    stage.render();
  };

  const piece: Piece = {
    async mount(h: HTMLElement, opts: PieceOptions) {
      host = h;
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      h.appendChild(canvas);
      if (!areaLib) { RectAreaLightUniformsLib.init(); areaLib = true; }
      stage = new Stage(h, canvas, { tier: opts.tier, fov: 32, near: 0.05, far: 12, bloom: { strength: 0.22, threshold: 1.4, radius: 0.4 }, ao: 0.035, envIntensity: 0.11 });
      model = buildCity();
      const s = stage.scene;
      s.add(model.root);
      for (const w of model.water) w.userData.gain = w.uniforms.uGain.value;
      for (const L of model.glowLights) { L.userData.base = L.intensity; s.add(L); }
      const house = new THREE.RectAreaLight(0xffe2c6, 0.2, 2.0, 1.3); house.position.set(-1.1, 1.7, 1.6); house.lookAt(0, 0.4, 0);
      const rim = new THREE.RectAreaLight(0xffe4c4, 1.0, 2.2, 0.8); rim.position.set(0.9, 1.3, -1.7); rim.lookAt(0, 0.4, 0);
      const rim2 = new THREE.RectAreaLight(0xffd2a0, 0.5, 1.2, 1.0); rim2.position.set(-1.6, 0.9, -0.6); rim2.lookAt(0, 0.45, 0);
      under = new THREE.SpotLight(0xff9a45, 0.7, 0, 1.25, 1, 1.4); under.position.set(0, -0.16, 0); under.target.position.set(0, -0.2, 0);
      s.add(house, rim, rim2, under, under.target, new THREE.HemisphereLight(0x3a2a1e, 0x0c0a09, 0.06));
      stage.lamp.intensity = 5;
      stage.resize();
      openingAt = opts.entrance ? clock.now() : null;
      apply();
      await stage.renderer.compileAsync(s, stage.camera);
      ro = new ResizeObserver(() => { stage?.resize(); frame(); });
      ro.observe(h);
      io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); });
      io.observe(h);
      off = clock.onFrame(() => frame());
      frame();
      opts.onReady?.();
    },
    setLamp(x, y) {
      lampUV = { x, y };
    },
    setProgress(p) {
      progress = clamp01(p);
    },
    setWaterLight(k) {
      waterK = 0.6 + 0.4 * clamp01(k);
    },
    setMaking(on) {
      if (stage && model) stage.setMaking(on, model.root);
      frame();
    },
    setTier(tier: Tier) {
      stage?.setTier(tier);
      frame();
    },
    freeze(t) {
      hold = t;
      frame();
    },
    view(az, el, dist) {
      view = { az, el, d: dist, ty: REST.ty * Math.min(1, dist / REST.d) };
      viewForced = true;
      frame();
    },
    dispose() {
      off?.();
      ro?.disconnect();
      io?.disconnect();
      stage?.dispose();
      canvas?.remove();
      stage = null;
      model = null;
      host = null;
    },
  };
  // The opening is driven by its own time for the strips: opening(t) shows its frame at t seconds.
  // Test hook for close shots: aim(x, y, z) in millimetres of the city points the view() camera at that spot.
  Object.assign(piece, {
    opening(t: number | null) { openingOverride = t; frame(); },
    // Test hook for the form shots: the whole city in plain clay, light-water and glows hidden.
    clay(on: boolean) {
      if (!stage || !model) return;
      stage.renderPass.overrideMaterial = on ? new THREE.MeshStandardMaterial({ color: 0xbdb3a6, roughness: 0.85 }) : null;
      model.root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const m = o.material as THREE.Material;
        if (m.blending === THREE.AdditiveBlending || m instanceof THREE.MeshBasicMaterial || m instanceof THREE.ShaderMaterial || m.name === 'slab') o.userData.clayHidden = on;
      });
      clayOn = on;
      stage.bloom.enabled = !on;
      frame();
    },
    skip() { if (openingAt !== null && openingOverride === null) openingAt = Math.min(openingAt, time() - OPENING.end); },
    aim(x: number | null, y = 0, z = 0) { aim = x === null ? null : new THREE.Vector3(x, y, z).multiplyScalar(CITY.SCALE); frame(); },
  });
  return piece;
}

export default createCity;
