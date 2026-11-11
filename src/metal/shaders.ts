// GLSL for the plate renderer. WebGL2.
// Coordinates inside a plate are device pixels from the top left. The bake runs once per plate size and writes
// everything that does not depend on the lamp; the light pass runs when the lamp, the scroll or the water change.

export const VERT = `#version 300 es
in vec2 a;
void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const COMMON = `
precision highp float;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
`;

// ---- bake --------------------------------------------------------------------------------------

export const BAKE = `#version 300 es
${COMMON}
uniform sampler2D uSdf;      // r: words and lines, g: panel. Signed distance in device px, negative inside.
uniform vec2 uRes;           // plate size, device px
uniform float uS;            // device px per design unit
uniform float uRad, uInset, uThick, uBevel;
uniform int uFinish;         // 0 aged, 1 polished, 2 bronze, 3 panel
uniform float uCutDepth, uCutWall, uPanelDepth, uRaise;
uniform float uGrain, uPatina, uSeed, uScratch, uPillow;
uniform vec4 uScrew[6];      // x, y, radius, slot angle (below -5: rivet, no slot)
uniform vec4 uWin;           // center x, y, half w, half h (device px)
uniform float uWinOn, uWinR, uWinDepth;
layout(location = 0) out vec4 o0; // normal x, normal y, cavity, wear
layout(location = 1) out vec4 o1; // second metal, enamel, grime, rough offset

vec2 sdf(vec2 p){ return texture(uSdf, p / uRes).rg; }

float plateD(vec2 p){ return sdBox(p - uRes * 0.5, uRes * 0.5 - uInset, uRad); }

float scratches(vec2 p){
  if (uScratch <= 0.0) return 0.0;
  float s = 0.0;
  for (int i = 0; i < 36; i++){
    float fi = float(i) + uSeed * 7.0;
    vec2 c = vec2(hash(vec2(fi, 1.3)), hash(vec2(fi, 7.9))) * uRes;
    float ang = (hash(vec2(fi, 3.1)) - 0.5) * (hash(vec2(fi, 9.4)) > 0.75 ? 2.6 : 0.35);
    float len = (12.0 + 70.0 * pow(hash(vec2(fi, 5.5)), 2.0)) * uS;
    vec2 d = vec2(cos(ang), sin(ang));
    vec2 q = p - c;
    float t = clamp(dot(q, d), -len * 0.5, len * 0.5);
    float dist = length(q - d * t);
    float fade = 1.0 - pow(abs(t) / (len * 0.5), 2.0);
    s = max(s, exp(-dist * dist / (0.09 * uS * uS + 0.06)) * fade * (0.2 + 0.5 * hash(vec2(fi, 2.2))));
  }
  return s * uScratch;
}

float height(vec2 p){
  float d = plateD(p);
  float x = clamp(-d / uBevel, 0.0, 1.0);
  float h = uThick * sqrt(1.0 - (1.0 - x) * (1.0 - x));
  // A small control has a gently domed face, so it reflects a gradient of the room instead of one flat tone.
  if (uPillow > 0.0){ vec2 c = (p - uRes * 0.5) / (uRes * 0.5); h += uPillow * (1.0 - min(1.0, c.x * c.x * 0.35 + c.y * c.y)) * x; }
  vec2 m = sdf(p);
  float cutT = clamp(-m.r / uCutWall, 0.0, 1.0);
  float cut = cutT * cutT * (3.0 - 2.0 * cutT);
  if (uFinish == 0 || uFinish == 1){
    h -= uCutDepth * cut;
  } else if (uFinish == 2){
    // Brass set flush into bronze: no step at all; the two metals meet by color and gloss alone.
    // The bronze is cast, so its face carries a faint broad unevenness that makes highlights wander.
    h += (fbm(p / uS * 0.014 + uSeed) - 0.5) * 0.55 * uS;
  } else {
    float panT = clamp(-m.g / (uCutWall * 1.6), 0.0, 1.0);
    h -= uPanelDepth * panT * panT * (3.0 - 2.0 * panT);
    // Letters stand proud. Small strokes are only a few pixels wide, so the wall is narrow and centered on the glyph
    // edge: what reads is a flat bright top with a crisp rim, never a hollow inline letter.
    float rT = clamp((-m.r + 0.5) / max(0.5 * uS, 0.7) + 0.5, 0.0, 1.0);
    h += uRaise * 0.6 * rT * rT * (3.0 - 2.0 * rT) * panT;
  }
  h -= scratches(p) * 0.12 * uS;
  if (uWinOn > 0.5){
    float dw = sdBox(p - uWin.xy, uWin.zw, uWinR);
    h += 1.4 * uS * smoothstep(9.0 * uS, 6.0 * uS, dw) * smoothstep(-0.6 * uS, 1.6 * uS, dw);
    h -= uWinDepth * clamp(-dw / (2.0 * uS), 0.0, 1.0);
  }
  for (int i = 0; i < 6; i++){
    vec4 s = uScrew[i];
    if (s.z <= 0.0) continue;
    vec2 q = p - s.xy;
    float r = length(q) / s.z;
    if (r < 1.45){
      h -= smoothstep(1.42, 1.06, r) * 1.6 * uS;
      if (r < 1.0){
        h += 2.6 * uS * (1.0 - r * r * 0.82);
        if (s.w > -5.0){
          float y = abs(-q.x * sin(s.w) + q.y * cos(s.w)) / s.z;
          h -= smoothstep(0.19, 0.1, y) * smoothstep(0.98, 0.86, r) * 2.4 * uS;
        }
      }
    }
  }
  return h;
}

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float e = 0.75;
  float hx = height(p + vec2(e, 0.0)) - height(p - vec2(e, 0.0));
  float hy = height(p + vec2(0.0, e)) - height(p - vec2(0.0, e));
  // y down in the plate, y up in the world: the normal's y takes the plate gradient as is.
  vec3 N = normalize(vec3(-hx, hy, 2.0 * e));

  vec2 q = p / uS;
  // Brushed grain: long thin streaks along x, in two scales, written into the normal's y.
  float g = (noise(vec2(q.x * 0.018 + uSeed, q.y * 2.6)) - 0.5) + (noise(vec2(q.x * 0.07, q.y * 6.3 + uSeed)) - 0.5) * 0.55;
  vec2 m = sdf(p);
  float inMetal2 = 0.0;
  float ink = 0.0;
  float cov = clamp(0.5 - m.r, 0.0, 1.0);
  if (uFinish == 0 || uFinish == 1) ink = cov;
  if (uFinish == 2) inMetal2 = cov;
  if (uFinish == 3) inMetal2 = clamp(0.5 - m.g, 0.0, 1.0) * (1.0 - cov);
  float blast = (uFinish == 3) ? inMetal2 : 0.0;
  vec2 bead = vec2(noise(q * 1.9 + 3.0) - 0.5, noise(q * 1.9 + 11.0) - 0.5) + vec2(hash(q * 5.3) - 0.5, hash(q * 5.3 + 4.0) - 0.5) * 0.6;
  float letterTop = (uFinish == 3) ? cov * clamp(0.5 - m.g, 0.0, 1.0) : 0.0;
  N = normalize(N + vec3(0.0, g * uGrain * mix(1.0, 0.35, inMetal2) * (1.0 - blast) * (1.0 - letterTop * 0.85), 0.0) + vec3(hash(q * 3.7) - 0.5, hash(q * 3.7 + 9.0) - 0.5, 0.0) * 0.012 + vec3(bead * 0.09 * blast, 0.0));

  // Enamel fills the cut to a flat surface; only the metal lip around it keeps the groove wall.
  N = normalize(mix(N, vec3(0.0, 0.0, 1.0), smoothstep(0.0, 1.0, clamp(-m.r - 0.35 * uS, 0.0, 1.0)) * ink));
  float d = plateD(p);
  // Patina gathers where hands do not reach: the rim, the grooves, around fasteners. Over the open face it is a fine
  // oxidation speckle and a very gentle drift, never large clouds, which read as a smudge inside a highlight.
  float drift = fbm(q * 0.0045 + uSeed * 3.1);
  float speck = smoothstep(0.64, 0.92, noise(q * 0.34 + uSeed)) * 0.55 + smoothstep(0.72, 0.96, noise(q * 1.1 + uSeed * 2.0)) * 0.4;
  float pat = drift * 0.5 + speck * 0.5;
  float rim = smoothstep(64.0, 3.0, -d / uS);
  float groove = (uFinish < 2) ? exp(-pow((m.r + 1.2 * uS) / (1.8 * uS), 2.0)) : 0.0;
  float near = 0.0;
  for (int i = 0; i < 6; i++){ vec4 s = uScrew[i]; if (s.z > 0.0) near = max(near, smoothstep(2.6, 1.3, length(p - s.xy) / s.z)); }
  float grime = uPatina * clamp(rim * (0.9 + 0.4 * drift) + groove * 0.5 + near * 0.55 + speck * 0.06 + (drift - 0.5) * 0.2, 0.0, 1.0) * (1.0 - inMetal2 * 0.65);
  float cavity = clamp(groove * 0.6 + smoothstep(1.0 * uS, -2.0 * uS, -d) * 0.0, 0.0, 1.0);
  // Wear: the crest of the bevel and the lips of the cuts are rubbed bright by hands.
  float crest = exp(-pow((-d - uBevel * 0.85) / (uBevel * 0.35), 2.0));
  float lip = exp(-pow((m.r - 0.6 * uS) / (0.9 * uS), 2.0));
  // Raised letter tops are rubbed bright by hands, like the bevel crest.
  float wear = clamp((crest * 0.8 + lip * 0.6) * (0.4 + 0.6 * uPatina) + letterTop * 0.7, 0.0, 1.0);
  float head = 0.0;
  for (int i = 0; i < 6; i++){ vec4 s = uScrew[i]; if (s.z > 0.0) head = max(head, smoothstep(1.02, 0.9, length(p - s.xy) / s.z)); }
  float roughVar = (speck - 0.25) * 0.05 * uPatina + scratches(p) * 0.18 - head * 0.3;

  o0 = vec4(N.xy * 0.5 + 0.5, cavity, wear);
  o1 = vec4(inMetal2, ink, grime, roughVar * 0.5 + 0.5);
}`;

// ---- light -------------------------------------------------------------------------------------

export const LIGHT = `#version 300 es
${COMMON}
uniform sampler2D uB0, uB1, uPhoto;
uniform vec2 uRes;
uniform float uS, uDpr;
uniform vec2 uOrigin;        // plate top left in the viewport, CSS px
uniform vec2 uView;          // viewport size, CSS px
uniform float uRad, uInset;
uniform vec3 uLamp;          // CSS px, x right, y down, z toward the viewer
uniform float uLampI;
uniform vec3 uWater;         // CSS px
uniform float uWaterI;
uniform vec2 uTilt;          // radians: about x, about y
uniform vec3 uF0a, uF0b, uInk;
uniform float uRa, uRb, uAniso;
uniform vec4 uWin;
uniform float uWinOn, uWinR, uWinDepth, uPhotoAspect, uPhotoOn;
uniform vec2 uPhotoFocus;
uniform float uPhotoZoom;
out vec4 frag;

const float PI = 3.14159265;

float panel(vec2 d, vec2 lo, vec2 hi, float b){
  return smoothstep(lo.x - b, lo.x + b, d.x) * (1.0 - smoothstep(hi.x - b, hi.x + b, d.x)) * smoothstep(lo.y - b, lo.y + b, d.y) * (1.0 - smoothstep(hi.y - b, hi.y + b, d.y));
}

vec3 studio(vec3 R, float rough){
  // The room behind the viewer, as a photographer lights metal: a dark room with a large soft key above and to the
  // left, a tall strip on the right and a low warm bounce card. A plate near mid-screen reflects the key's lower edge,
  // so its face carries a band of light that slides as it scrolls. R is y up, z toward the viewer.
  float b = 0.025 + rough * 0.5;
  vec2 d = R.xy / max(R.z + 0.35, 0.2);
  float key = panel(d, vec2(-1.05, 0.05), vec2(0.28, 0.6), b);
  float keyCore = panel(d, vec2(-0.85, 0.16), vec2(0.1, 0.48), b * 1.6);
  float strip = panel(d, vec2(0.36, -0.7), vec2(0.5, 0.9), b);
  float card = panel(d, vec2(-1.0, -0.5), vec2(0.9, -0.05), b * 1.6);
  vec3 c = vec3(0.022, 0.019, 0.016) + vec3(0.15, 0.125, 0.1) * smoothstep(-0.4, 1.4, d.y);
  c += vec3(1.0, 0.93, 0.84) * (key * 0.95 + keyCore * 0.6);
  c += vec3(1.0, 0.82, 0.6) * strip * 0.8;
  c += vec3(0.62, 0.44, 0.25) * card * 0.4;
  return c;
}

float D_aniso(vec3 H, vec3 N, vec3 T, vec3 B, float ax, float ay){
  float x = dot(H, T) / ax, y = dot(H, B) / ay, z = dot(H, N);
  float k = x * x + y * y + z * z;
  return 1.0 / (PI * ax * ay * k * k);
}

float V_smith(float nl, float nv, float a){
  float a2 = a * a;
  return 0.5 / max(nl * sqrt(nv * nv * (1.0 - a2) + a2) + nv * sqrt(nl * nl * (1.0 - a2) + a2), 1e-4);
}

vec3 spec(vec3 N, vec3 V, vec3 L, vec3 T, vec3 B, float rough, float aniso, vec3 F0){
  vec3 H = normalize(L + V);
  float nl = max(dot(N, L), 0.0), nv = max(dot(N, V), 1e-3);
  float a = max(rough * rough, 0.002);
  float ax = max(a * (1.0 - aniso * 0.7), 0.0015), ay = min(a * (1.0 + aniso * 2.2), 1.0);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  return F * D_aniso(H, N, T, B, ax, ay) * V_smith(nl, nv, a) * nl;
}

vec3 rotX(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }
vec3 rotY(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float d = sdBox(p - uRes * 0.5, uRes * 0.5 - uInset, uRad);
  float cov = clamp(0.5 - d, 0.0, 1.0);
  if (cov <= 0.0){ frag = vec4(0.0); return; }
  vec2 uv = gl_FragCoord.xy / uRes;
  vec4 b0 = texture(uB0, uv), b1 = texture(uB1, uv);
  vec3 N = vec3(b0.xy * 2.0 - 1.0, 0.0);
  N.z = sqrt(max(1.0 - dot(N.xy, N.xy), 0.0));
  N = rotY(rotX(N, uTilt.x), uTilt.y);
  float metal2 = b1.x, ink = b1.y, grime = b1.z, roughVar = b1.w * 2.0 - 1.0;
  float cavity = b0.z, wear = b0.w;

  // World: CSS px, x right, y up, z toward the viewer. The camera floats over the viewport center.
  vec2 css = uOrigin + p / uDpr;
  vec3 P = vec3(css.x, -css.y, 0.0);
  vec3 cam = vec3(uView.x * 0.5, -uView.y * 0.5, max(uView.x, uView.y) * 1.25);
  vec3 V = normalize(cam - P);
  vec3 T = normalize(vec3(1.0, 0.0, 0.0) - N * N.x);
  vec3 B = cross(N, T);

  vec3 F0 = mix(uF0a, uF0b, metal2);
  F0 *= 1.0 - grime * 0.58;
  F0 = mix(F0, F0 * 1.12 + 0.02, wear * 0.5);
  float rough = clamp(mix(uRa, uRb, metal2) + grime * 0.26 + roughVar - wear * 0.1, 0.06, 0.95);
  float aniso = uAniso * (1.0 - metal2 * 0.6) * (1.0 - grime * 0.5);

  vec3 R = reflect(-V, N);
  vec3 col = studio(R, rough) * F0 * (1.0 - cavity * 0.55);
  // Real brass is never a perfect mirror: micro scratches scatter a little of the whole room, so a plate that
  // reflects the dark floor still keeps enough light for its enamel words to read.
  col += F0 * vec3(0.16, 0.14, 0.12) * (1.0 - cavity * 0.55);

  vec3 Lv = vec3(uLamp.x, -uLamp.y, uLamp.z) - P;
  float ld = length(Lv);
  vec3 L = Lv / ld;
  float fall = uLampI / (1.0 + pow(ld / (max(uView.x, uView.y) * 0.75), 2.0));
  col += spec(N, V, L, T, B, rough, aniso, F0) * fall * vec3(1.0, 0.94, 0.86);
  col += spec(N, V, L, T, B, min(1.0, rough * 1.8 + 0.1), aniso * 0.5, F0) * fall * 0.1 * vec3(1.0, 0.94, 0.86);

  if (uWaterI > 0.0){
    vec3 Wv = vec3(uWater.x, -uWater.y, uWater.z) - P;
    float wd = length(Wv);
    float wf = uWaterI / (1.0 + pow(wd / 170.0, 2.0));
    col += spec(N, V, Wv / wd, T, B, rough, aniso, F0) * wf * vec3(1.0, 0.5, 0.14);
    col += F0 * wf * 0.05 * vec3(1.0, 0.5, 0.14) * max(dot(N, Wv / wd), 0.0);
  }

  // Enamel: a black glassy fill. Dark, with its own small sharp highlight.
  vec3 enamel = uInk + studio(R, 0.4) * 0.018 + spec(N, V, L, T, B, 0.42, 0.0, vec3(0.04)) * fall * 0.22;
  col = mix(col, enamel, ink);

  if (uWinOn > 0.5){
    float dw = sdBox(p - uWin.xy, uWin.zw, uWinR);
    float inside = clamp(-dw / (0.9 * uS) - 1.4, 0.0, 1.0);
    if (inside > 0.0){
      // Sight line: where the eye meets the glass floor, and whether the near wall hides it.
      vec3 Vd = V;
      float depthPx = uWinDepth;
      vec2 seeOff = vec2(-Vd.x, Vd.y) / max(Vd.z, 0.3) * depthPx;
      float wallSeen = smoothstep(-0.6 * uS, 0.6 * uS, sdBox(p + seeOff - uWin.xy, uWin.zw, uWinR));
      vec2 lampOff = vec2(L.x, -L.y) / max(L.z, 0.15) * depthPx * 3.2;
      float pen = 0.8 * uS + length(lampOff) * 0.1;
      float lit = 1.0 - smoothstep(-pen, pen, sdBox(p + lampOff - uWin.xy, uWin.zw, uWinR) + 0.6 * uS);
      float ao = smoothstep(0.0, 14.0 * uS, -dw) * 0.3 + 0.7;
      vec3 photo = vec3(0.05, 0.045, 0.04);
      if (uPhotoOn > 0.5){
        vec2 puv = (p - (uWin.xy - uWin.zw)) / (2.0 * uWin.zw);
        // Cover the window, zoomed by uPhotoZoom, centered on the focus point but never past the picture's edge.
        float wa = uWin.z / uWin.w;
        vec2 span = (wa > uPhotoAspect ? vec2(1.0, uPhotoAspect / wa) : vec2(wa / uPhotoAspect, 1.0)) / max(uPhotoZoom, 1.0);
        vec2 c = clamp(uPhotoFocus, span * 0.5, 1.0 - span * 0.5);
        puv = c + (puv - 0.5) * span;
        photo = pow(texture(uPhoto, puv).rgb, vec3(2.2));
      }
      float onPrint = fall * max(dot(vec3(0.0, 0.0, 1.0), L), 0.0);
      vec3 under = photo * (0.42 + 0.95 * onPrint) * mix(0.12, 1.0, lit) * ao;
      // The wall: brass, facing into the window, lit by the lamp when it faces it.
      vec2 wn = normalize(p - uWin.xy + 1e-3);
      vec3 WN = normalize(vec3(-wn.x, wn.y, 0.25));
      // The wall faces into the window; the side that faces the lamp catches it, the far side falls into shade.
      vec3 wall = studio(reflect(-V, WN), 0.45) * uF0a * 0.25 + uF0a * max(dot(WN, L), 0.0) * fall * 0.55 + spec(WN, V, L, T, B, 0.4, 0.0, uF0a) * fall * 0.6;
      under = mix(under, wall, wallSeen);
      // Glass: a faint reflection of the room, and a soft glare where the lamp catches it.
      vec3 G = vec3(0.0, 0.0, 1.0);
      float fr = 0.04 + 0.96 * pow(1.0 - max(dot(G, V), 0.0), 5.0);
      float smudge = fbm(p / uS * 0.03 + 4.0) * 0.08;
      vec3 glass = studio(reflect(-V, G), 0.08 + smudge) * fr * 0.4 + spec(G, V, L, vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), 0.12 + smudge, 0.0, vec3(0.04)) * fall * 0.55 * vec3(1.0, 0.84, 0.62);
      col = mix(col, under + glass, inside);
    }
  }

  // Keep the hue as it gets bright: an exposure curve on the brightest channel scales all three together, so hot
  // brass rolls off smoothly toward full gold and never turns lemon or white, and has no flat clipped plateau.
  float mx = max(col.r, max(col.g, col.b));
  if (mx > 1e-5) col *= (1.0 - exp(-mx * 1.15)) / (mx * 0.955);
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  frag = vec4(col * cov, cov);
}`;
