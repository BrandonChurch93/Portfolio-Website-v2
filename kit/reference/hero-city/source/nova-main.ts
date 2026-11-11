// Local render harness for the hero city. Three kinds of frame:
//   shot(u, v)      the finished city with the lamp at a place on screen
//   cine(b)         the opening at b seconds, camera moving
//   life(t, pass)   only the things that move, at loop time t (pass 0 picture, pass 1 matte)
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { setMaxAnisotropy } from '../src/world/kit/textures';
import { studioEnvironment } from '../src/world/env';
import { Post } from '../src/world/post';
import { buildNova, NOVA } from './nova';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const W = num('w', 1600), H = num('h', 800);
const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: true });
renderer.toneMapping = q.get('tm') === 'aces' ? THREE.ACESFilmicToneMapping : q.get('tm') === 'agx' ? THREE.AgXToneMapping : THREE.NeutralToneMapping;
renderer.toneMappingExposure = num('exp', 1.0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.localClippingEnabled = true;
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());
RectAreaLightUniformsLib.init();

const MM = 0.001, D2R = Math.PI / 180;
const state = { ready: false, ms: 0 };
const api = { state, NOVA, shot: (_u: number, _v: number, _type?: string, _q?: number) => '', cine: (_b: number, _type?: string, _q?: number) => '', life: (_t: number, _pass: number) => '', view: (_az: number, _el: number, _d: number, _ty: number) => {}, meta: () => ({}) as unknown };
(window as unknown as { __stage: typeof api }).__stage = api;
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function main() {
  const t0 = performance.now();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = studioEnvironment(renderer, 'inspector');
  scene.environmentIntensity = num('env', 0.18);
  const G = new THREE.Group(); G.scale.setScalar(MM); scene.add(G);
  const noAO: THREE.Object3D[] = [];
  NOVA.waterK = num('wk', NOVA.waterK);
  const nova = buildNova({ scene, G, noAO });

  const lamp = new THREE.PointLight(0xffdcb4, num('lamp', 3.4), 0, 2);
  lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.bias = -0.0012; lamp.shadow.normalBias = 0.003;
  lamp.shadow.radius = num('srad', 5); lamp.shadow.blurSamples = 16; lamp.shadow.camera.near = 0.03; lamp.shadow.camera.far = 6;
  const house = new THREE.RectAreaLight(0xffe2c6, num('house', 0.2), 2.0, 1.3); house.position.set(-1.1, 1.7, 1.6); house.lookAt(0, 0.4, 0);
  const rim = new THREE.RectAreaLight(0xffe4c4, num('rim', 1.0), 2.2, 0.8); rim.position.set(0.9, 1.3, -1.7); rim.lookAt(0, 0.4, 0);
  const rim2 = new THREE.RectAreaLight(0xffd2a0, num('rim2', 0.5), 1.2, 1.0); rim2.position.set(-1.6, 0.9, -0.6); rim2.lookAt(0, 0.45, 0);
  const under = new THREE.SpotLight(0xff9a45, num('under', 1.6), 0, 1.3, 1, 1.4); under.position.set(0, 0.15, 0); under.target.position.set(0, 0, 0);
  scene.add(lamp, house, rim, rim2, under, under.target, new THREE.HemisphereLight(0x3a2a1e, 0x0c0a09, num('hemi', 0.06)));
  if (num('fog', 0)) scene.fog = new THREE.FogExp2(0x000000, num('fog', 0));

  const camera = new THREE.PerspectiveCamera(num('fov', 32), W / H, 0.3, 16);
  const END = { az: num('az', 0), el: num('el', 13), d: num('d', 1.6), ty: num('ty', 0.289) };
  const START = { az: num('az0', -46), el: num('el0', 62), d: num('d0', 1.72), ty: num('ty0', -0.02) };
  const setCam = (az: number, el: number, d: number, ty: number) => {
    const a = az * D2R, e = el * D2R;
    camera.position.set(d * Math.cos(e) * Math.sin(a), ty + d * Math.sin(e), d * Math.cos(e) * Math.cos(a));
    camera.lookAt(0, ty, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  };
  setCam(END.az, END.el, END.d, END.ty);

  const post = new Post(renderer, scene, camera, (q.get('tier') ?? 'high') as 'high');
  post.setScene(scene, camera, true);
  // lights and light-water take no occlusion; veils and glass are left out of that pass
  const exempt: THREE.Object3D[] = [];
  scene.traverse((o) => { if ((o instanceof THREE.Mesh || o instanceof THREE.Sprite) && (o.material as THREE.Material).type !== 'MeshPhysicalMaterial' && (o.material as THREE.Material).type !== 'MeshStandardMaterial') { if ((o.material as THREE.Material).transparent || o instanceof THREE.Sprite) { if (!noAO.includes(o)) noAO.push(o); } else exempt.push(o); } });
  post.aoExempt = () => exempt;
  post.hideForAO = () => noAO;
  post.setSize(W, H);
  const BLOOM = num('bloom', 0.22);
  post.bloom.strength = BLOOM; post.bloom.threshold = num('bt', 1.15); post.bloom.radius = num('br', 0.4);
  post.gtao?.updateGtaoMaterial({ radius: num('ao', 0.035) });

  // the lamp hangs on an upright plane just in front of the city, at the point the cursor covers
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), p = new THREE.Vector3(), ZL = num('zl', 0.6);
  const lampAt = (u: number, v: number) => {
    setCam(END.az, END.el, END.d, END.ty);
    ndc.set(u * 2 - 1, 1 - v * 2); ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    p.copy(o).addScaledVector(d, (ZL - o.z) / d.z);
    lamp.position.set(Math.max(-1.1, Math.min(1.1, p.x)), Math.max(0.3, Math.min(1.05, p.y)), ZL);
  };
  const U0 = num('u', 0.6), V0 = num('v', 0.24);
  const draw = () => { renderer.info.reset(); post.composer.render(); };
  const grab = (type = 'image/png', quality = 0.92) => canvas.toDataURL(type, quality);

  api.shot = (u, v, type, quality) => {
    lampAt(u, v); nova.setMode('static'); nova.set(NOVA.BE, 0); nova.life.visible = false; under.intensity = num('under', 1.6);
    draw(); return grab(type, quality);
  };
  api.view = (az, el, d, ty) => { END.az = az; END.el = el; END.d = d; END.ty = ty; };
  api.cine = (b, type, quality) => {
    lampAt(U0, V0);
    const k = sm(0, 1, Math.min(1, b / num('camEnd', 4.7))), e = k * k * (3 - 2 * k) * 0.5 + k * 0.5;
    setCam(mix(START.az, END.az, e), mix(START.el, END.el, e), mix(START.d, END.d, e), mix(START.ty, END.ty, e));
    nova.setMode('full'); nova.set(b, b); nova.life.visible = false; under.intensity = num('under', 1.6) * sm(1.0, 2.0, b);
    draw(); return grab(type, quality);
  };

  // the life layer: everything that does not move is drawn black, so it still hides what passes behind it
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 }), white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const movers = new Set(nova.movers), glows = new Set(nova.glows);
  type Kind = 'mover' | 'moverGlow' | 'flow' | 'hide' | 'hold';
  const items: { o: THREE.Mesh | THREE.Sprite; kind: Kind; orig: THREE.Material | THREE.Material[] }[] = [];
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh) && !(o instanceof THREE.Sprite)) return;
    const m = o.material as THREE.Material & { vertexColors?: boolean };
    let kind: Kind = 'hold';
    if (movers.has(o)) kind = glows.has(o) ? 'moverGlow' : 'mover';
    else if (glows.has(o) && m.vertexColors) kind = 'flow';
    else if (glows.has(o) || m.transparent || o instanceof THREE.Sprite) kind = 'hide';
    items.push({ o, kind, orig: o.material });
  });
  const restore = () => { for (const it of items) { it.o.material = it.orig as THREE.Material; it.o.visible = true; } };
  api.life = (t, pass) => {
    lampAt(U0, V0); nova.setMode('osc'); nova.set(NOVA.BE, t); nova.life.visible = true;
    for (const it of items) {
      if (it.kind === 'hold') it.o.material = black;
      else if (it.kind === 'hide') it.o.visible = false;
      else if (pass === 1) { if (it.kind === 'mover') it.o.material = white; else it.o.visible = false; }
    }
    under.intensity = 0;
    if (post.gtao) post.gtao.enabled = false; if (post.aoMix) post.aoMix.enabled = false;
    if (pass === 1) { const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping; renderer.setRenderTarget(null); renderer.render(scene, camera); renderer.toneMapping = tm; }
    else draw();
    const url = grab();
    restore(); if (post.gtao) post.gtao.enabled = true; if (post.aoMix) post.aoMix.enabled = true;
    return url;
  };
  api.meta = () => ({ W, H, END, START, U0, V0, items: items.length, dbg: nova.debug() });

  api.shot(U0, V0); api.shot(U0, V0);
  state.ms = Math.round(performance.now() - t0);
  state.ready = true;
}
main();
