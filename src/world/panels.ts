import * as THREE from 'three';

// Panel seams on a built surface: thin recessed joints on a grid projected along the surface's main axis, with a
// slight tone change from panel to panel. Joints fade out once they get finer than a pixel, so far away the surface
// stays clean and close up it reads as made of parts.
export interface PanelOptions {
  // Model units to world units.
  scale: number;
  // Panel size in model units, across and up.
  size: [number, number];
  // How dark a joint is, 0 to 1.
  depth?: number;
  // How much panels differ in tone.
  vary?: number;
}

export function panelize<M extends THREE.MeshStandardMaterial>(m: M, o: PanelOptions): M {
  const uniforms = {
    uPanelScale: { value: o.scale },
    uPanelSize: { value: new THREE.Vector2(...o.size) },
    uPanelDepth: { value: o.depth ?? 0.45 },
    uPanelVary: { value: o.vary ?? 0.06 },
  };
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPanelPos;\nvarying vec3 vPanelNrm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvPanelPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvPanelNrm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vPanelPos;
varying vec3 vPanelNrm;
uniform float uPanelScale, uPanelDepth, uPanelVary;
uniform vec2 uPanelSize;
float panelHash(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 19.19); return fract(p.x * p.y); }
vec2 panelSeam(){
  vec3 p = vPanelPos / uPanelScale, n = abs(normalize(vPanelNrm));
  vec2 q = n.y > max(n.x, n.z) ? p.xz : (n.x > n.z ? p.zy : p.xy);
  // On upright surfaces run the joints round the building, not across a single axis.
  if (n.y <= max(n.x, n.z)) q.x = atan(p.z, p.x) * length(p.xz);
  vec2 g = q / uPanelSize;
  vec2 w = fwidth(g);
  vec2 f = abs(fract(g) - 0.5);
  float jx = smoothstep(0.5 - w.x * 1.5, 0.5, f.x), jy = smoothstep(0.5 - w.y * 1.5, 0.5, f.y);
  float fade = 1.0 - smoothstep(0.12, 0.35, max(w.x, w.y));
  return vec2(max(jx, jy) * fade, panelHash(floor(g)) * fade + (1.0 - fade) * 0.5);
}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nvec2 seam = panelSeam();\ndiffuseColor.rgb *= (1.0 - uPanelDepth * seam.x) * (1.0 + uPanelVary * (seam.y - 0.5));');
  };
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${key()}|panels`;
  return m;
}
