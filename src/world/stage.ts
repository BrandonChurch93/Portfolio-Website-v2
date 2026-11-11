import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Tier } from '../config/site';
import { site } from '../content/site';
import { pixelRatioFor } from './tier-choice';
import { seeded } from './build';
import { studioScene } from './env';

// What every piece shares: renderer, Neutral tone mapping, soft shadows, a studio environment, the post chain, the
// lamp as a real light, and the "how this is made" view. One stage per piece, one WebGL context each.

export interface StageOptions {
  tier: Tier;
  fov?: number;
  near?: number;
  far?: number;
  bloom?: { strength: number; threshold: number; radius: number };
  ao?: number;
  aoIntensity?: number;
  envIntensity?: number;
  lampTarget?: [number, number, number];
  lampAngle?: number;
  exposure?: number;
  // The environment metal reflects: the neutral room, or a studio of soft lights for pieces made mostly of metal.
  env?: 'room' | 'studio';
}

const TIER_POST: Record<Tier, { ao: boolean; aoScale: number; shadow: number; smaa: boolean }> = {
  high: { ao: true, aoScale: 0.6, shadow: 2048, smaa: true },
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

// Last pass: a fixed pattern of half-level noise, so dark glows fade smoothly instead of stepping through 8-bit
// levels. Fixed per pixel, so a frozen frame is still the same image.
function ditherPass(): ShaderPass {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; float h(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); } void main(){ vec4 c = texture2D(tDiffuse, vUv); float n = h(gl_FragCoord.xy) + h(gl_FragCoord.xy + 17.0) - 1.0; gl_FragColor = vec4(c.rgb + n / 255.0, c.a); }',
  });
}

export class Stage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  renderPass: RenderPass;
  lamp: THREE.SpotLight;
  private ao: GTAOPass | null = null;
  bloom: UnrealBloomPass;
  private smaa: SMAAPass | null = null;
  private envRT: THREE.WebGLRenderTarget;
  private making = false;
  private exposureBefore = 1;
  // Triangles per square unit of a part's bounding sphere above which its wire is left out of the making view.
  wireDensity = Infinity;
  // When set, the making view draws edges sharper than this many degrees instead of every triangle, so flat faces
  // show their outline and not their triangulation.
  wireEdges = 0;
  private wire: THREE.Object3D[] = [];
  private stats: HTMLDivElement;
  tier: Tier;
  width = 1;
  height = 1;
  frameMs = 0;
  // A factor on the tier's pixel ratio, for moments in motion where full resolution is not needed.
  private resScale = 1;

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
    const envScene = o.env === 'studio' ? studioScene() : new RoomEnvironment();
    this.envRT = pmrem.fromScene(envScene, 0.04);
    envScene.traverse((x) => { if (x instanceof THREE.Mesh) { x.geometry.dispose(); (x.material as THREE.Material).dispose(); } });
    pmrem.dispose();
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = o.envIntensity ?? 0.2;
    this.camera = new THREE.PerspectiveCamera(o.fov ?? 32, 1, o.near ?? 0.05, o.far ?? 30);

    // The lamp is a wide, soft spot aimed at the piece: it lights like a bulb in front of it, and its shadows take one
    // map instead of a point light's six.
    this.lamp = new THREE.SpotLight(0xffdcb4, 3.2, 0, o.lampAngle ?? 1.15, 0.7, 2);
    this.lamp.target.position.set(...(o.lampTarget ?? [0, 0, 0]));
    this.scene.add(this.lamp.target);
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
      this.ao.updateGtaoMaterial({ radius: this.o.ao ?? 0.035, distanceExponent: 1.6, thickness: 0.6, scale: 1.25, samples: this.tier === 'high' ? 16 : 8 });
      this.ao.blendIntensity = this.o.aoIntensity ?? 1;
      this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: this.tier === 'high' ? 16 : 8 });
      // Occlusion is soft; it is worked out at a fraction of the screen's pixels and blended up.
      const aoPass = this.ao, aoSet = aoPass.setSize.bind(aoPass), sc = t.aoScale;
      aoPass.setSize = (w: number, h: number) => aoSet(Math.max(1, Math.round(w * sc)), Math.max(1, Math.round(h * sc)));
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
    c.addPass(ditherPass());
    this.lamp.shadow.mapSize.set(t.shadow, t.shadow);
    this.lamp.shadow.map?.dispose();
    this.lamp.shadow.map = null as unknown as THREE.WebGLRenderTarget;
  }

  setResolutionScale(k: number): void {
    if (k === this.resScale) return;
    this.resScale = k;
    this.resize();
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
    const dpr = pixelRatioFor(this.tier, devicePixelRatio || 1, w * h) * this.resScale;
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
  // The clay view for form shots: one clay material on everything through the render pass; light (glows, light-water,
  // sprites, points) hidden; no bloom.
  clay = false;
  private clayMat = new THREE.MeshStandardMaterial({ color: 0xbdb3a6, roughness: 0.85 });
  setClay(on: boolean, root: THREE.Object3D): void {
    this.clay = on;
    this.renderPass.overrideMaterial = on ? this.clayMat : null;
    this.bloom.enabled = !on;
    root.traverse((o) => {
      if (o instanceof THREE.Sprite || o instanceof THREE.Points) { o.userData.clayHidden = on; return; }
      if (!(o instanceof THREE.Mesh)) return;
      const m = o.material as THREE.Material;
      if (m.blending === THREE.AdditiveBlending || m instanceof THREE.MeshBasicMaterial || m instanceof THREE.ShaderMaterial || /screen/i.test(m.name)) o.userData.clayHidden = on;
    });
  }

  // Hides what clay hides; call after anything that sets visibility for the frame.
  hideForClay(root: THREE.Object3D): void {
    if (this.clay) root.traverse((o) => { if (o.userData.clayHidden) o.visible = false; });
  }

  setMaking(on: boolean, root: THREE.Object3D): void {
    if (on === this.making) return;
    this.making = on;
    if (on) {
      // Wire over the built geometry only (instanced crowds and foliage would turn to fuzz), the lit surface
      // dimmed underneath so the lines read and the materials still show through.
      const mat = new THREE.MeshBasicMaterial({ color: 0xe8bd8a, wireframe: true, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false });
      const list: THREE.Mesh[] = [];
      // Skip parts so dense their wire would only shimmer (knurling, lathed lenses): the readout still counts them.
      const dense = (o: THREE.Mesh) => { const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const r = g.boundingSphere?.radius ?? 1; const tris = (g.index ? g.index.count : g.getAttribute('position').count) / 3; return tris / (4 * Math.PI * r * r) > this.wireDensity; };
      root.traverse((o) => { if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && !o.userData.noWire && o.visible && !dense(o)) list.push(o); });
      this.exposureBefore = this.renderer.toneMappingExposure;
      this.renderer.toneMappingExposure = this.exposureBefore * 0.3;
      const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0xe8bd8a).multiplyScalar(2.6), transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
      // Edges lie on the surface they outline; draw them a hair nearer so the surface never hides them.
      lineMat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\ngl_Position.z -= 0.0004 * gl_Position.w;'); };
      for (const o of list) {
        const w = this.wireEdges > 0 ? new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, this.wireEdges), lineMat) : new THREE.Mesh(o.geometry, mat);
        w.matrixAutoUpdate = false;
        w.matrix.copy(o.matrix);
        w.renderOrder = 10;
        w.userData.noWire = true;
        o.parent?.add(w);
        this.wire.push(w);
      }
    } else {
      for (const w of this.wire) { w.parent?.remove(w); if (w instanceof THREE.LineSegments) w.geometry.dispose(); }
      this.wire = [];
      this.renderer.toneMappingExposure = this.exposureBefore;
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
