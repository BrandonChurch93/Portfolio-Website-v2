import * as THREE from 'three';
import { studioScene } from './env';

// A small view of a piece: the same model at rest, drawn by a renderer shared with other small views (the doors on
// the home page draw three in one canvas). Each piece offers its own factory, so the page never reaches into a piece.
export interface SmallView {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  // t: clock seconds; lamp: the visitor's lamp as fractions of this view's rect; aspect: the rect's width over height.
  update(t: number, lamp: { x: number; y: number }, aspect: number): void;
  dispose(): void;
}

export type SmallFactory = (renderer: THREE.WebGLRenderer) => Promise<SmallView>;

// A studio environment for a small view, made with the shared renderer.
export function smallEnvironment(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const pm = new THREE.PMREMGenerator(renderer);
  const s = studioScene();
  const rt = pm.fromScene(s, 0.04);
  s.traverse((x) => { if (x instanceof THREE.Mesh) { x.geometry.dispose(); (x.material as THREE.Material).dispose(); } });
  pm.dispose();
  return rt;
}

// Places a camera so a sphere of the given radius around the target fills the view, from an azimuth and elevation
// in degrees, whatever the view's shape.
export function frameTo(cam: THREE.PerspectiveCamera, target: THREE.Vector3, radius: number, az: number, el: number, aspect: number, fill = 0.92): void {
  cam.aspect = aspect;
  const v = THREE.MathUtils.degToRad(cam.fov) / 2;
  const h = Math.atan(Math.tan(v) * aspect);
  const d = radius / Math.sin(Math.min(v, h)) / fill;
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  cam.position.set(target.x + d * Math.cos(e) * Math.sin(a), target.y + d * Math.sin(e), target.z + d * Math.cos(e) * Math.cos(a));
  cam.lookAt(target);
  cam.near = Math.max(0.01, d - radius * 3);
  cam.far = d + radius * 6;
  cam.updateProjectionMatrix();
}

// The visitor's lamp in a small view: a soft point light on a plane in front of the target, following the lamp.
export function placeSmallLamp(light: THREE.PointLight, cam: THREE.PerspectiveCamera, target: THREE.Vector3, lamp: { x: number; y: number }, spread: number): void {
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  const toCam = cam.position.clone().sub(target).normalize();
  light.position.copy(target).addScaledVector(toCam, spread * 1.2).addScaledVector(right, (lamp.x - 0.5) * spread * 2).addScaledVector(up, (0.5 - lamp.y) * spread * 1.6);
}

export function disposeScene(scene: THREE.Scene): void {
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) { for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose(); m.dispose(); }
    }
  });
}
