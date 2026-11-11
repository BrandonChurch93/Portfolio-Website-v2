import * as THREE from 'three';
import { COLORS } from '../../config/site';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { disposeScene, frameTo, placeSmallLamp, smallEnvironment, type SmallFactory } from '../../world/small';
import { SCULPT, buildSculpture } from './model';

// The sculpture at rest for a door on the home page: turning slowly on its pedestal, the split leaning with the lamp.
const TURN = 0.11;

export const createSmall: SmallFactory = async (renderer) => {
  RectAreaLightUniformsLib.init();
  const m = await buildSculpture();
  const scene = new THREE.Scene();
  const env = smallEnvironment(renderer);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.75;
  scene.add(m.root);
  scene.background = new THREE.Color(COLORS.bg);
  scene.fog = new THREE.Fog(COLORS.bg, 1, 3);
  const c = new THREE.Vector3(0, SCULPT.CENTRE - 190, 0).multiplyScalar(SCULPT.SCALE);
  const spot = new THREE.SpotLight(0xffe2c4, 2.2, 0, 0.34, 0.6, 2);
  spot.position.set(0.12, 1.55, 0.38);
  spot.target.position.set(0, 0.12, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0003;
  const fill = new THREE.RectAreaLight(0xffdcb8, 3.0, 0.8, 0.5);
  fill.position.set(0.35, 0.4, 1.0);
  fill.lookAt(0, -0.18, 0.05);
  const rim = new THREE.RectAreaLight(0xffd6b0, 2.0, 0.6, 0.6);
  rim.position.set(-0.5, 0.5, -0.6);
  rim.lookAt(c);
  const lamp = new THREE.PointLight(0xffdcb4, 0.4, 0, 2);
  scene.add(spot, spot.target, fill, rim, lamp, m.glow, new THREE.HemisphereLight(0x3a2a1e, 0x0c0a09, 0.08));
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 8);
  const normal = new THREE.Vector3();
  return {
    scene,
    camera,
    update(t, lampUV, aspect) {
      frameTo(camera, c, 0.42, 18, 9, aspect, 0.96);
      const fog = scene.fog as THREE.Fog, cd = camera.position.distanceTo(c);
      fog.near = cd + 0.3; fog.far = cd + 2.4;
      placeSmallLamp(lamp, camera, c, lampUV, 0.5);
      m.turn.rotation.y = t * TURN;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
      const fwd = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).setY(0).normalize();
      normal.copy(right).multiplyScalar(0.92).addScaledVector(fwd, 0.25).add(new THREE.Vector3(0, (0.5 - lampUV.y) * 0.5, 0)).normalize();
      m.uniforms.uPlaneN.value.copy(normal);
      m.uniforms.uPlaneP.value.set(0, SCULPT.CENTRE * SCULPT.SCALE, 0).addScaledVector(right, (lampUV.x - 0.5) * 2 * -0.06);
    },
    dispose() { disposeScene(scene); env.dispose(); },
  };
};
