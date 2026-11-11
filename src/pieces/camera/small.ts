import * as THREE from 'three';
import { COLORS } from '../../config/site';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { disposeScene, frameTo, placeSmallLamp, smallEnvironment, type SmallFactory } from '../../world/small';
import { CAM, IRIS, buildCamera, setIris } from './model';

// The camera at rest for a door on the home page: on its tripod on the paper sweep, the iris set, the lamp moving.
export const createSmall: SmallFactory = async (renderer) => {
  RectAreaLightUniformsLib.init();
  const m = await buildCamera();
  const scene = new THREE.Scene();
  const env = smallEnvironment(renderer);
  scene.environment = env.texture;
  scene.environmentIntensity = 1.9;
  scene.add(m.root);
  scene.background = new THREE.Color(COLORS.bg);
  scene.fog = new THREE.Fog(COLORS.bg, 1, 3);
  const c = new THREE.Vector3(0, -48, 0).multiplyScalar(CAM.SCALE);
  const key = new THREE.SpotLight(0xffd9b0, 0.6, 0, 1.1, 1, 2);
  key.position.set(-0.14, 0.62, 0.06);
  key.target.position.copy(c);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.0015;
  key.shadow.radius = 4;
  // A soft front fill as a wide spot: an area light would stop at its own plane, which crosses the sweep in this view.
  const fill = new THREE.SpotLight(0xffe4cc, 0.5, 0, 1.2, 1, 2);
  fill.position.set(-0.34, 0.04, 0.42);
  fill.target.position.copy(c);
  const rim = new THREE.RectAreaLight(0xffe2c8, 2.4, 0.5, 0.3);
  rim.position.set(0.32, 0.12, -0.4);
  rim.lookAt(c);
  const lamp = new THREE.PointLight(0xffdcb4, 0.25, 0, 2);
  scene.add(key, key.target, fill, fill.target, rim, lamp, new THREE.HemisphereLight(0x4a3626, 0x0c0a09, 0.12));
  const camera = new THREE.PerspectiveCamera(26, 1, 0.02, 6);
  setIris(m.blades, IRIS.open);
  m.glow.color.setRGB(1, 0.62, 0.3).multiplyScalar(0.14);
  return {
    scene,
    camera,
    update(_t, lampUV, aspect) {
      frameTo(camera, c, 0.15, 26, 17, aspect, 0.95);
      const fog = scene.fog as THREE.Fog, cd = camera.position.distanceTo(c);
      fog.near = cd + 0.2; fog.far = cd + 1.5;
      placeSmallLamp(lamp, camera, c, lampUV, 0.18);
      m.body.rotation.y = CAM.YAW * (Math.PI / 180) + (lampUV.x - 0.5) * 0.2;
      for (const g of m.glass) { g.uniforms.uLamp.value.copy(lamp.position); g.uniforms.uLampK.value = 1; }
    },
    dispose() { disposeScene(scene); env.dispose(); },
  };
};
