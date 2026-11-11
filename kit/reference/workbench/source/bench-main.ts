// Local render harness for the skills workbench. pass(name) returns one frame:
//   base                     the bench under its lamp, every tool resting
//   monitor|keys|ipad|camera only the light that tool gives off or sits in, on black, to be added over the base
//   all                      everything lit, for checking
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { setMaxAnisotropy } from '../src/world/kit/textures';
import { studioEnvironment } from '../src/world/env';
import { Post } from '../src/world/post';
import { buildBench } from './bench';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const W = num('w', 1600), H = num('h', 800);
const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: true });
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = num('exp', 1.0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());
RectAreaLightUniformsLib.init();

const MM = 0.001, D2R = Math.PI / 180;
const state = { ready: false, ms: 0 };
const api = { state, pass: (_n: string, _type?: string, _q?: number) => '', meta: () => ({}) as unknown };
(window as unknown as { __stage: typeof api }).__stage = api;

function main() {
  const t0 = performance.now();
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  scene.environment = studioEnvironment(renderer, 'inspector');
  const ENV = num('env', 0.2);
  const G = new THREE.Group(); G.scale.setScalar(MM); scene.add(G);
  const noAO: THREE.Object3D[] = [];
  const bench = buildBench(scene, G, noAO, num);
  scene.add(new THREE.HemisphereLight(0x3a2a1e, 0x0c0a09, 0.0001));

  const camera = new THREE.PerspectiveCamera(num('fov', 30), W / H, 0.2, 12);
  const az = num('az', 13) * D2R, el = num('el', 24) * D2R, d = num('d', 1.8), T = new THREE.Vector3(num('tx', 15), num('ty', 185), num('tz', 0)).multiplyScalar(MM);
  camera.position.set(T.x + d * Math.cos(el) * Math.sin(az), T.y + d * Math.sin(el), T.z + d * Math.cos(el) * Math.cos(az));
  camera.lookAt(T); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);

  const post = new Post(renderer, scene, camera, 'high');
  post.setScene(scene, camera, true);
  post.aoExempt = () => bench.screens; post.hideForAO = () => noAO;
  post.setSize(W, H);
  post.bloom.strength = num('bloom', 0.24); post.bloom.threshold = num('bt', 1.0); post.bloom.radius = num('br', 0.45);
  post.gtao?.updateGtaoMaterial({ radius: num('ao', 0.03) });

  api.pass = (name, type = 'image/png', quality = 0.92) => {
    bench.setPass(name); scene.environmentIntensity = name === 'base' || name === 'all' ? ENV : 0;
    renderer.info.reset(); post.composer.render();
    return canvas.toDataURL(type, quality);
  };
  api.meta = () => {
    scene.updateMatrixWorld(true);
    const boxes: Record<string, number[]> = {}, b = new THREE.Box3(), v = new THREE.Vector3();
    for (const [name, g] of Object.entries(bench.groups)) {
      b.setFromObject(g); let x0 = 9, y0 = 9, x1 = -9, y1 = -9;
      for (let i = 0; i < 8; i++) { v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera); const x = v.x / 2 + 0.5, y = 0.5 - v.y / 2; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      boxes[name] = [x0, y0, x1, y1].map((n) => Math.round(n * 1000) / 1000);
    }
    const corner = (x: number, z: number) => { v.set(x * MM, 0, z * MM).project(camera); return [Math.round((v.x / 2 + 0.5) * 10000) / 10000, Math.round((0.5 - v.y / 2) * 10000) / 10000]; };
    return { W, H, boxes, fl: corner(-700, 340), fr: corner(700, 340), bl: corner(-700, -340), br: corner(700, -340) };
  };
  api.pass('all'); api.pass('all');
  state.ms = Math.round(performance.now() - t0); state.ready = true;
}
main();
