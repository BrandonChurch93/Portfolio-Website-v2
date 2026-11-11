import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Tier } from '../config/site';
import { site } from '../content/site';
import { pixelRatioFor } from './tier-choice';
import { seeded } from './build';

// What every piece shares: renderer, Neutral tone mapping, soft shadows, a studio environment, the post chain, the
// lamp as a real light, and the "how this is made" view. One stage per piece, one WebGL context each.

export interface StageOptions {
  tier: Tier;
  fov?: number;
  near?: number;
  far?: number;
  bloom?: { strength: number; threshold: number; radius: number };
  ao?: number;
  envIntensity?: number;
  exposure?: number;
}

const TIER_POST: Record<Tier, { ao: boolean; aoScale: number; shadow: number; smaa: boolean }> = {
  high: { ao: true, aoScale: 1, shadow: 2048, smaa: true },
  mid: { ao: true, aoScale: 0.5, shadow: 1024, smaa: true },
  low: { ao: false, aoScale: 0, shadow: 1024, smaa: false },
  static: { ao: true, aoScale: 0.5, shadow: 2048, smaa: true },
};

// Seeded so the occlusion denoise draws the same pixels on every load: a frozen frame is always the same image.
function seededNoise(size = 64): THREE.DataTexture {
  const r = seeded(4242);
  const simplex = new SimplexNoise({ random: r });
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
    const k = (i * size + j) * 4;
    data[k] = (simplex.noise(i, j) * 0.5 + 0.5) * 255;
    data[k + 1] = (simplex.noise(i + size, j) * 0.5 + 0.5) * 255;
    data[k + 2] = (simplex.noise(i, j + size) * 0.5 + 0.5) * 255;
    data[k + 3] = (simplex.noise(i + size, j + size) * 0.5 + 0.5) * 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

export class Stage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  renderPass: RenderPass;
  lamp: THREE.PointLight;
  private ao: GTAOPass | null = null;
  bloom: UnrealBloomPass;
  private smaa: SMAAPass | null = null;
  private envRT: THREE.WebGLRenderTarget;
  private making = false;
  private wire: THREE.Mesh[] = [];
  private stats: HTMLDivElement;
  tier: Tier;
  width = 1;
  height = 1;
  frameMs = 0;

  constructor(private host: HTMLElement, private canvas: HTMLCanvasElement, private o: StageOptions) {
    this.tier = o.tier;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = o.exposure ?? 1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x0c0a09, 0);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    pmrem.dispose();
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = o.envIntensity ?? 0.2;
    this.camera = new THREE.PerspectiveCamera(o.fov ?? 32, 1, o.near ?? 0.05, o.far ?? 30);

    this.lamp = new THREE.PointLight(0xffdcb4, 3.2, 0, 2);
    this.lamp.castShadow = true;
    this.lamp.shadow.bias = -0.0012;
    this.lamp.shadow.normalBias = 0.003;
    this.lamp.shadow.radius = 5;
    this.lamp.shadow.camera.near = 0.03;
    this.lamp.shadow.camera.far = 8;
    this.scene.add(this.lamp);

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    const b = o.bloom ?? { strength: 0.22, threshold: 1.1, radius: 0.4 };
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), b.strength, b.radius, b.threshold);
    this.buildPost();

    this.stats = document.createElement('div');
    this.stats.className = 'piece-stats';
    this.stats.setAttribute('aria-hidden', 'true');
    host.appendChild(this.stats);
  }

  private buildPost(): void {
    const c = this.composer;
    while (c.passes.length > 1) c.removePass(c.passes[c.passes.length - 1]);
    this.ao?.dispose();
    this.smaa?.dispose();
    this.ao = null;
    this.smaa = null;
    const t = TIER_POST[this.tier];
    if (t.ao) {
      this.ao = new GTAOPass(this.scene, this.camera, 256, 256);
      this.ao.updateGtaoMaterial({ radius: this.o.ao ?? 0.035, distanceExponent: 1, thickness: 1, scale: 1, samples: this.tier === 'high' ? 16 : 8 });
      this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: this.tier === 'high' ? 16 : 8 });
      const pd = (this.ao as unknown as { pdMaterial: THREE.ShaderMaterial }).pdMaterial;
      pd.uniforms.tNoise.value = seededNoise();
      // Light (glows, light-water, additive veils) casts no occlusion: keep it out of the normal and depth pass.
      const ao = this.ao as unknown as { _overrideVisibility(): void; _visibilityCache: THREE.Object3D[] };
      const base = ao._overrideVisibility.bind(ao);
      ao._overrideVisibility = () => {
        base();
        this.scene.traverse((o) => {
          if (o instanceof THREE.Sprite && o.visible) { o.visible = false; ao._visibilityCache.push(o); return; }
          if (!(o instanceof THREE.Mesh) || !o.visible) return;
          const m = o.material as THREE.Material;
          if (o.userData.noAO || m.blending === THREE.AdditiveBlending || m instanceof THREE.MeshBasicMaterial || m instanceof THREE.ShaderMaterial) { o.visible = false; ao._visibilityCache.push(o); }
        });
      };
      c.addPass(this.ao);
    }
    c.addPass(this.bloom);
    c.addPass(new OutputPass());
    if (t.smaa) { this.smaa = new SMAAPass(); c.addPass(this.smaa); }
    this.lamp.shadow.mapSize.set(t.shadow, t.shadow);
    this.lamp.shadow.map?.dispose();
    this.lamp.shadow.map = null as unknown as THREE.WebGLRenderTarget;
  }

  setTier(tier: Tier): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.buildPost();
    this.resize();
  }

  resize(): void {
    const r = this.host.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    const dpr = pixelRatioFor(this.tier, devicePixelRatio || 1);
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // The making view: the same scene as clean wireframe over the lit surface, plus a readout.
  setMaking(on: boolean, root: THREE.Object3D): void {
    if (on === this.making) return;
    this.making = on;
    if (on) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xd4a574, wireframe: true, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false });
      const list: THREE.Mesh[] = [];
      root.traverse((o) => { if (o instanceof THREE.Mesh && !o.userData.noWire && o.visible) list.push(o); });
      for (const o of list) {
        const w = o instanceof THREE.InstancedMesh ? new THREE.InstancedMesh(o.geometry, mat, o.count) : new THREE.Mesh(o.geometry, mat);
        if (o instanceof THREE.InstancedMesh && w instanceof THREE.InstancedMesh) w.instanceMatrix = o.instanceMatrix;
        w.matrixAutoUpdate = false;
        w.matrix.copy(o.matrix);
        w.renderOrder = 10;
        w.userData.noWire = true;
        o.parent?.add(w);
        this.wire.push(w);
      }
    } else {
      for (const w of this.wire) w.parent?.remove(w);
      this.wire = [];
    }
    this.host.dataset.making = on ? 'on' : 'off';
  }

  render(): void {
    const t0 = performance.now();
    this.renderer.info.reset();
    this.renderer.info.autoReset = false;
    this.composer.render();
    this.frameMs = performance.now() - t0;
    if (this.making) {
      const i = this.renderer.info.render;
      const w = site.ui.stats;
      this.stats.textContent = `${Math.round(i.triangles).toLocaleString('en-US')} ${w.triangles} · ${i.calls} ${w.calls} · ${this.frameMs.toFixed(1)} ${w.frame}`;
    }
  }

  dispose(): void {
    this.composer.dispose();
    this.ao?.dispose();
    this.envRT.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) { for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose(); m.dispose(); }
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.stats.remove();
  }
}
