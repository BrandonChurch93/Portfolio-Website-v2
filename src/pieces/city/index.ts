import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { COLORS, READING_LINE, type Tier } from '../../config/site';
import { clock } from '../../world/clock';
import type { Piece, PieceOptions } from '../../world/piece';
import { Stage } from '../../world/stage';
import { buildCity, CITY, LAND, type CityModel } from './model';

// The floating city: the home page's hero. Constants that only this piece uses live here, so the piece can be
// replaced whole in the review stage.

const D2R = Math.PI / 180;
// The settled view and the opening's first view (degrees, metres).
const REST = { az: 0, el: 14, d: 2.45, ty: 0.2 };
const START = { az: -38, el: 74, d: 2.05, ty: -0.12 };
// The lamp hangs on an upright plane this far in front of the city's centre, where the cursor covers it.
const LAMP_Z = 0.8;
const LAMP_SWING = 1.7;
const LAMP_POWER = 6.5;
const OPENING_RES = 0.62;
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
  lampOn: [1.7, 3.4],
  end: 7.4,
} as const;
const FILL = { from: -200, to: 820 };
const GRID = { plan: 0.9, rest: 0.065 };

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
  let frameOpt: { shift: number; scale: number } = { shift: 0, scale: 1 };

  const time = () => hold ?? clock.now();
  const openingTime = () => openingOverride ?? (openingAt === null ? OPENING.end : time() - openingAt);

  // On a narrow screen the camera backs off so the whole disc stays in frame.
  const fit = (d: number) => {
    if (!stage) return d;
    const a = stage.width / Math.max(1, stage.height);
    // Wide enough that the disc and its falls (about 1.1 m across) fill the frame's width with a margin.
    const hw = Math.tan(((stage.camera.fov / 2) * Math.PI) / 180) * a;
    return Math.max(d, 0.53 / hw);
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
    // The lamp swings wider than the cursor's own ray, so moving the cursor sweeps the light right round the city.
    stage.lamp.position.set(Math.max(-1.5, Math.min(1.5, p.x * LAMP_SWING)), Math.max(0.14, Math.min(1.05, p.y)), LAMP_Z);
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
    m.slab.emissiveIntensity = GRID.plan * (1 - smooth(span(o, OPENING.planFade))) + GRID.rest * smooth(span(o, OPENING.planFade));
    m.slab.userData.planDraw.value = o >= OPENING.plan[1] + 0.3 ? 2 : smooth(span(o, OPENING.plan)) * 1.05;
    // The screen starts dark: the lamp comes up only once the plan is drawn.
    stage.lamp.intensity = LAMP_POWER * smooth(span(o, OPENING.lampOn));
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
    for (const mm of m.mists) mm.opacity = pk * 0.28;
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
        d: mix(START.d, REST.d * frameOpt.scale, e) + progress * 0.15,
        ty: mix(START.ty, REST.ty, e) + progress * 0.05,
      });
    }
    // The opening is in motion; it renders at three quarters of the tier's resolution, then steps up when it settles.
    stage.setResolutionScale(o < OPENING.end && !clock.isFrozen() ? OPENING_RES : 1);
    const shift = viewForced ? 0 : frameOpt.shift * smooth(span(o, OPENING.camera));
    if (shift > 0) stage.camera.setViewOffset(stage.width, stage.height, 0, -shift * stage.height, stage.width, stage.height);
    else if (stage.camera.view) stage.camera.clearViewOffset();
    if (clayOn) model.root.traverse((ob) => { if (ob.userData.clayHidden) ob.visible = false; });
    // Fog starts past the city wherever the camera stands, so a far phone view is not fogged out.
    if (stage.scene.fog instanceof THREE.Fog) { const cd = stage.camera.position.length(); stage.scene.fog.near = cd + 0.7; stage.scene.fog.far = cd + 3.8; }
    placeLamp();
  };

  // The static tier draws one frame and holds it; only a change of size, tier or view draws again.
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
      host = h;
      frameOpt = { shift: opts.frame?.shift ?? 0, scale: opts.frame?.scale ?? 1 };
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      h.appendChild(canvas);
      if (!areaLib) { RectAreaLightUniformsLib.init(); areaLib = true; }
      stage = new Stage(h, canvas, { tier: opts.tier, fov: 32, near: 0.05, far: 12, bloom: { strength: 0.24, threshold: 1.8, radius: 0.22 }, ao: 0.016, aoIntensity: 1.0, envIntensity: 0.06, lampTarget: [0, 0.12, 0], lampAngle: 1.2 });
      model = await buildCity();
      const s = stage.scene;
      // The page's own dark behind the city, and fog to the same dark far off, so the ground has no horizon line.
      s.background = new THREE.Color(COLORS.bg);
      s.fog = new THREE.Fog(COLORS.bg, 2.7, 5.2);
      s.add(model.root);
      for (const w of model.water) w.userData.gain = w.uniforms.uGain.value;
      for (const L of model.glowLights) { L.userData.base = L.intensity; s.add(L); }
      const house = new THREE.RectAreaLight(0xffe2c6, 0.03, 2.0, 1.3); house.position.set(-1.1, 1.7, 1.6); house.lookAt(0, 0.4, 0);
      const rim = new THREE.RectAreaLight(0xffe4c4, 0.16, 2.2, 0.8); rim.position.set(0.9, 1.3, -1.7); rim.lookAt(0, 0.4, 0);
      const rim2 = new THREE.RectAreaLight(0xffd2a0, 0.1, 1.2, 1.0); rim2.position.set(-1.6, 0.9, -0.6); rim2.lookAt(0, 0.45, 0);
      under = new THREE.SpotLight(0xff9a45, 0.7, 0, 1.25, 1, 1.4); under.position.set(0, -0.16, 0); under.target.position.set(0, -0.2, 0);
      s.add(house, rim, rim2, under, under.target, new THREE.HemisphereLight(0x3a2a1e, 0x0c0a09, 0.03));
      stage.resize();
      // Under a frozen clock (the test hooks) time does not run, so the piece starts at rest; strips drive the opening
      // through opening(t).
      openingAt = opts.entrance && !clock.isFrozen() ? clock.now() - (opts.entranceFrom ?? 0) : null;
      apply();
      // Compile every program now, with everything shown, so nothing compiles mid-opening.
      const hidden: THREE.Object3D[] = [];
      s.traverse((ob) => { if (!ob.visible) { hidden.push(ob); ob.visible = true; } });
      await stage.warm();
      stage.render();
      for (const ob of hidden) ob.visible = false;
      apply();
      ro = new ResizeObserver(() => { stage?.resize(); frame(true); });
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
    // Progress is the reading line through the hero: at rest it sits at the reading line; the camera lifts only as
    // the hero scrolls away.
    setProgress(p) {
      progress = clamp01((p - READING_LINE) / 0.8);
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
      frame(true);
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
        if (o instanceof THREE.Sprite || o instanceof THREE.Points) { o.userData.clayHidden = on; return; }
        if (!(o instanceof THREE.Mesh)) return;
        const m = o.material as THREE.Material;
        if (m.blending === THREE.AdditiveBlending || m instanceof THREE.MeshBasicMaterial || m instanceof THREE.ShaderMaterial || m.name === 'slab') o.userData.clayHidden = on;
      });
      clayOn = on;
      stage.bloom.enabled = !on;
      frame();
    },
    // Where the opening is, for a page that times things to it (seconds, and when it ends).
    openingState() { return { t: openingTime(), end: OPENING.end }; },
    // Where the front fall lands on screen at rest, as a fraction of the host: the page's stream starts there.
    anchor() {
      if (!stage) return null;
      const cam = new THREE.PerspectiveCamera().copy(stage.camera);
      place(cam, { ...REST, d: REST.d * frameOpt.scale }, null);
      if (frameOpt.shift > 0) cam.setViewOffset(stage.width, stage.height, 0, -frameOpt.shift * stage.height, stage.width, stage.height);
      else cam.clearViewOffset();
      cam.updateProjectionMatrix();
      // The run leaves the bottom of the host straight toward the viewer, so the stream starts at the bottom edge.
      const p = new THREE.Vector3(0, -CITY.LIFT * CITY.SCALE, (LAND + 300) * CITY.SCALE).project(cam);
      return { x: (p.x + 1) / 2, y: 1 };
    },
    skip() { if (openingAt !== null && openingOverride === null) openingAt = Math.min(openingAt, time() - OPENING.end); },
    aim(x: number | null, y = 0, z = 0) { aim = x === null ? null : new THREE.Vector3(x, y, z).multiplyScalar(CITY.SCALE); frame(); },
  });
  return piece;
}

export default createCity;
