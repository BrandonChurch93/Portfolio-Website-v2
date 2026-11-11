import * as THREE from 'three';
import { COLORS } from '../../config/site';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { disposeScene, frameTo, placeSmallLamp, smallEnvironment, type SmallFactory } from '../../world/small';
import { HH, buildHandheld } from './model';

// The handheld at rest for a door on the home page: the game playing, the power lamp lit, the visitor's lamp moving.
export const createSmall: SmallFactory = async (renderer) => {
  RectAreaLightUniformsLib.init();
  const m = buildHandheld();
  const scene = new THREE.Scene();
  const env = smallEnvironment(renderer);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.6;
  scene.add(m.root);
  scene.background = new THREE.Color(COLORS.bg);
  scene.fog = new THREE.Fog(COLORS.bg, 1, 3);
  const c = m.centre.clone().multiplyScalar(HH.SCALE);
  const key = new THREE.SpotLight(0xffd9b0, 1.0, 0, 0.5, 0.85, 2);
  key.position.set(-0.14, 0.62, 0.06);
  key.target.position.copy(c);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.0015;
  const rim = new THREE.RectAreaLight(0xffe0c4, 1.2, 0.5, 0.25);
  rim.position.set(0.34, 0.26, -0.42);
  rim.lookAt(c);
  const lamp = new THREE.PointLight(0xffdcb4, 0.05, 0, 2);
  scene.add(key, key.target, rim, lamp, new THREE.HemisphereLight(0x3a2a1e, 0x0c0a09, 0.05));
  const camera = new THREE.PerspectiveCamera(26, 1, 0.02, 6);
  m.lcd.uniforms.uPower.value = 1;
  m.led.emissiveIntensity = 2.2;
  for (const ctl of m.controls) if (ctl.name === 'power') ctl.group.position.x += 3;
  return {
    scene,
    camera,
    update(t, lampUV, aspect) {
      frameTo(camera, c.clone().add(new THREE.Vector3(0, -0.012, 0)), 0.15, -17, 10, aspect, 0.98);
      const fog = scene.fog as THREE.Fog, cd = camera.position.distanceTo(c);
      fog.near = cd + 0.25; fog.far = cd + 1.6;
      placeSmallLamp(lamp, camera, c, lampUV, 0.12);
      m.screen.draw(1, null, t + 30, []);
      m.glass.uniforms.uLamp.value.copy(lamp.position);
      m.glass.uniforms.uLampK.value = 1;
    },
    dispose() { m.screen.dispose(); disposeScene(scene); env.dispose(); },
  };
};
