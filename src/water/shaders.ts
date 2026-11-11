// GLSL for the water. WebGL2. Positions are page CSS px (y down); uScroll and uView map them to the viewport.
// Everything is additive light on a transparent canvas: rgb carries the light, alpha stays 0.

const NOISE = `
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * noise(p); p = p * 2.07 + 13.7; a *= 0.5; } return s; }
// Water color by intensity: deep amber, site amber, pale gold. Never white.
vec3 ramp(float I){
  vec3 c = mix(vec3(0.78, 0.26, 0.03), vec3(1.0, 0.6, 0.2), smoothstep(0.05, 0.75, I));
  c = mix(c, vec3(1.0, 0.84, 0.52), smoothstep(0.85, 1.9, I));
  return c * I;
}
`;

const VIEW = `
uniform vec2 uView;
uniform float uScroll;
vec4 toClip(vec2 page){ vec2 v = vec2(page.x, page.y - uScroll) / uView * 2.0 - 1.0; return vec4(v.x, -v.y, 0.0, 1.0); }
`;

// ---- the body: one triangle strip per branch, two vertices per sample ------------------------------

export const BODY_VS = `#version 300 es
in vec2 aPos; in vec2 aNrm; in vec4 aD; in vec2 aE;
// aD: s, f, half width, kind. aE: side (-1 or 1), drop.
${VIEW}
uniform float uHead, uWiden, uStartS, uPhone;
out vec4 vD; out float vV; out float vDrop; out vec2 vPage;
void main(){
  float s = aD.x, hw = aD.z;
  // The leading edge gathers into a bead; a strand that starts at a landing grows out of the splash.
  float bead = 1.0 + 0.55 * exp(-pow((uHead - s) / 14.0, 2.0)) * step(0.5, aD.w) * step(aD.w, 1.5);
  float grow = mix(0.35, 1.0, smoothstep(0.0, 34.0, s - uStartS));
  // The front narrows to a rounded tip instead of ending in a blunt cap.
  float front = mix(0.55, 1.0, smoothstep(uHead + 2.0, uHead - 22.0, s));
  // The stream breathes: its width swells and narrows along the way, slowly changing with time.
  float breathe = 1.0 + 0.16 * sin(s * 0.012 + aD.y * 1.3) + 0.09 * sin(s * 0.031 + 2.0 - aD.y * 0.7);
  float w = hw * bead * grow * front * breathe * uWiden;
  vec2 p = aPos + aNrm * aE.x * w;
  vD = aD; vV = aE.x * uWiden; vDrop = aE.y; vPage = p;
  gl_Position = toClip(p);
}`;

export const BODY_FS = `#version 300 es
precision highp float;
${NOISE}
in vec4 vD; in float vV; in float vDrop; in vec2 vPage;
uniform float uTime, uHead, uMode, uHalo, uStatic;
out vec4 frag;
void main(){
  float s = vD.x, f = vD.y, kind = vD.w, v = vV, av = abs(v);
  float fall = step(2.5, kind), sheet = step(0.5, kind) * (1.0 - fall);
  float reveal = smoothstep(uHead + 2.0, uHead - 26.0, s);
  float head = exp(-pow((uHead - s) / 46.0, 2.0)) * reveal;
  float t = uTime;
  // u: the pattern, carried along at the water's own speed. In a fall travel time grows slower than distance, so
  // the same pattern stretches and races as the water speeds up.
  float u = (f - t) * 240.0;

  if (uHalo > 0.5){
    // Two scales of glow: a tight warm one that hugs the stream and a wide faint one that lights the page.
    float tight = exp(-v * v * 34.0), wide = exp(-v * v * 3.2);
    float pulse = 0.82 + 0.18 * noise(vec2(u * 0.004, t * 0.3));
    float flare = exp(-pow((uHead - s) / 26.0, 2.0)) * smoothstep(uHead + 30.0, uHead - 4.0, s);
    vec3 glow = vec3(1.0, 0.5, 0.12) * (tight * 0.7 + wide * 0.36) * pulse * reveal + vec3(1.0, 0.66, 0.3) * (tight * 1.6 + wide * 0.6) * flare;
    frag = vec4(glow * (1.0 - fall * 0.25), 0.0);
    return;
  }

  float body, I;
  if (uMode < 0.5){
    // Approach A, as the reference: three sine threads, noise caustics, a surge pulse.
    body = smoothstep(1.0, 0.8, av);
    float warp = noise(vec2(u * 0.011, v * 1.3)) - 0.5;
    float th = exp(-pow((v - 0.56 * sin(u * 0.021 + warp * 3.4)) / 0.17, 2.0));
    th += exp(-pow((v + 0.5 * sin(u * 0.0165 + 1.7 + warp * 2.2)) / 0.13, 2.0)) * 0.8;
    float caust = pow(noise(vec2(u * 0.028, v * 2.6 + t * 0.5)), 3.0) * 1.7;
    float surge = pow(0.5 + 0.5 * sin(s * 0.0085 - t * 2.9), 10.0);
    I = body * (0.2 + 0.52 * th + caust * 0.5 + surge * 0.55) + head * 1.9 * body;
  } else {
    // Approach B: a ribbon of light lit like a lens: a bright core thread that wanders slowly, two thin threads braiding
    // round it, fine caustic ridges underneath and sparse glints, all carried at the water's own speed. The rim is soft.
    body = smoothstep(1.0, 0.5, av);
    float lens = 1.0 - av * av;
    // Glass: the rim of the ribbon catches light too, so it reads as a body of water, not a line.
    float rim = exp(-pow((av - 0.78) / 0.12, 2.0));
    float wa = noise(vec2(u * 0.006, t * 0.11)) - 0.5, wb = noise(vec2(u * 0.009 + 17.0, t * 0.13)) - 0.5;
    float core = exp(-pow((v - wa * 0.45) / 0.38, 2.0));
    float thA = exp(-pow((v - 0.55 * sin(u * 0.018 + wa * 4.0)) / 0.1, 2.0));
    float thB = exp(-pow((v + 0.5 * sin(u * 0.014 + 1.9 + wb * 4.0)) / 0.085, 2.0));
    float a = fbm(vec2(u * 0.016, v * 1.6 + t * 0.2));
    float r1 = pow(1.0 - abs(2.0 * a - 1.0), 6.0);
    float glint = smoothstep(0.86, 0.985, noise(vec2(u * 0.11 + 4.0, v * 4.0 + t * 0.8))) * smoothstep(0.95, 0.4, av);
    float edge = smoothstep(0.62, 0.9, av) * smoothstep(1.02, 0.88, av);
    I = body * (0.56 * lens + 0.8 * core + 0.55 * thA + 0.45 * thB + r1 * 0.32 + glint * 1.2 + rim * 0.38) + edge * 0.22 + head * 2.4 * body * (0.4 + 0.6 * lens);
    // Falling, it thins and tears into strands and drops; the longer the drop, the more torn.
    float tear = smoothstep(30.0, 260.0, vDrop) * fall;
    float strands = smoothstep(0.36 + 0.26 * tear, 0.66, noise(vec2(v * 1.8 + 3.0, u * 0.0045)));
    float beads = smoothstep(0.7, 0.92, noise(vec2(v * 3.0 + 9.0, u * 0.024)));
    I *= mix(1.0, strands * 1.25 + beads * 0.8, tear);
    // A running sheet is a thin bright bead with ripples travelling along it.
    I += sheet * body * 0.25 * (0.6 + 0.4 * sin(u * 0.07 - 1.5));
  }
  vec3 col = ramp(I) * reveal;
  // The dry channel ahead of the front: a faint warm trace of where the water will go.
  col += vec3(0.5, 0.32, 0.16) * smoothstep(0.75, 0.95, av) * smoothstep(1.0, 0.95, av) * 0.12 * (1.0 - reveal);
  frag = vec4(col, 0.0);
}`;

// ---- particles: stateless capsules, each a segment from A to B ------------------------------------------

export const PART_VS = `#version 300 es
${VIEW}
${NOISE}
uniform int uType;            // 0 riders, 1 head sparks, 2 crown, 3 thrown drops, 4 sheet, 5 boil, 6 dots (approach A)
uniform float uTime, uHead, uHeadMove, uGravity, uShutter, uScale;
uniform sampler2D uRoute;     // rows are branches; columns uniform in travel time: x, y, s, half width
uniform int uRow; uniform float uF0, uF1; uniform int uCols;
uniform vec4 uLand;           // x, y, impact time, direction
uniform float uLandStrength;
uniform float uN;             // how many crown fingers this tier draws
uniform vec4 uHeadPos;        // x, y, direction x, direction y
out vec2 vL; out vec2 vSeg; out float vR; out float vI; out float vHot;

vec4 routeAt(float f){
  float k = clamp((f - uF0) / max(uF1 - uF0, 1e-4), 0.0, 1.0) * float(uCols - 1);
  int i = int(floor(k));
  vec4 a = texelFetch(uRoute, ivec2(i, uRow), 0), b = texelFetch(uRoute, ivec2(min(i + 1, uCols - 1), uRow), 0);
  return mix(a, b, fract(k));
}

void main(){
  int id = gl_InstanceID;
  float fi = float(id);
  vec2 A = vec2(0.0), B = vec2(0.0);
  float r = 1.5, I = 0.0, hot = 0.0;
  if (uType == 0){
    // Motes riding the flow: each moves at exactly the water's speed, so they race down falls.
    float span = uF1 - uF0;
    float f = uF0 + fract(hash1(fi * 1.7) + uTime / max(span, 0.5)) * span;
    vec4 p = routeAt(f), q = routeAt(f - 0.008);
    // Most ride inside the body; one in four drifts just outside it, in the glow.
    float out_ = step(0.55, hash1(fi * 8.3));
    float side = (hash1(fi * 3.1) - 0.5) * mix(1.4, 6.5, out_) + 0.35 * sin(uTime * (0.7 + hash1(fi)) + fi);
    vec2 d = normalize(p.xy - q.xy + 1e-4), n = vec2(-d.y, d.x);
    A = p.xy + n * side * p.w; B = q.xy + n * side * p.w;
    float shown = smoothstep(uHead + 2.0, uHead - 20.0, p.z);
    float tw = 0.45 + 0.55 * noise(vec2(fi * 7.3, uTime * 2.2));
    r = (0.7 + pow(hash1(fi * 5.7), 2.0) * 1.4) * uScale;
    I = shown * tw * mix(1.6, 1.1, out_);
    hot = hash1(fi * 9.1);
  } else if (uType == 1){
    // Sparks thrown at the moving front.
    float P = 0.22 + hash1(fi * 2.3) * 0.3;
    float ph = (uTime + hash1(fi) * P) / P, k = floor(ph), age = fract(ph) * P;
    float ang = (hash1(fi * 4.1 + k * 1.3) - 0.5) * 2.2;
    float sp = 50.0 + hash1(fi * 7.7 + k) * 140.0;
    vec2 dir = uHeadPos.zw, n = vec2(-dir.y, dir.x);
    vec2 v0 = (dir * cos(ang) + n * sin(ang)) * sp + vec2(0.0, -90.0);
    vec2 p = uHeadPos.xy + v0 * age + vec2(0.0, 0.5 * uGravity * 0.6 * age * age);
    vec2 v = v0 + vec2(0.0, uGravity * 0.6 * age);
    A = p; B = p - v * uShutter;
    r = (0.8 + hash1(fi * 3.3 + k) * 1.2) * uScale;
    I = uHeadMove * (1.0 - age / P) * 1.2;
    hot = 0.8;
  } else if (uType == 2 || uType == 3 || uType == 6){
    // Crown instances come in pairs (a finger and the bead at its tip); drops in threes (the drop and two
    // samples back along its arc, so the eye reads the curve).
    float sub = uType == 2 ? mod(fi, 5.0) : (uType == 3 ? mod(fi, 4.0) : 0.0);
    fi = uType == 2 ? floor(fi / 5.0) : (uType == 3 ? floor(fi / 4.0) : fi);
    float tau = uTime - uLand.z;
    if (tau < 0.0){ gl_Position = vec4(2.0, 2.0, 0.0, 1.0); return; }
    float dir = uLand.w;
    vec2 o = uLand.xy;
    float g = uGravity;
    if (uType == 2){
      // The crown: fingers of a ring seen side on, rising and collapsing. The first impact is the big one; while water
      // keeps arriving, smaller crowns keep forming, each cycle with its own size so none repeats.
      float P = 0.36 + hash1(fi * 1.9) * 0.22;
      float first = step(tau, 0.62);
      float ph = first > 0.5 ? tau : (tau - 0.62) / P + hash1(fi * 5.3);
      float k = first > 0.5 ? 0.0 : floor(ph) + 1.0;
      float a = first > 0.5 ? tau : fract(ph) * P;
      float amp = first > 0.5 ? 1.0 : 0.58 + 0.3 * hash1(fi * 11.0 + k * 3.7);
      float theta = (fi + hash1(fi + k)) / max(uN, 1.0) * 6.2832;
      float c = cos(theta);
      float bias = dir == 0.0 ? 1.0 : 1.0 + 0.6 * sign(c) * dir;
      float vy = (250.0 + 130.0 * hash1(fi * 2.9 + k)) * amp * uLandStrength * bias * uScale;
      float R = (5.0 + a * (110.0 + 60.0 * hash1(fi * 8.1 + k)) * amp) * uScale;
      float h = max(0.0, vy * a - 0.5 * g * a * a);
      float lean = 0.7 + 0.35 * hash1(fi * 6.6);
      // Each finger is a curved wall in four segments, flaring outward as it rises, with a bead at its rim.
      vec2 base = o + vec2(c * R, -sin(theta) * R * 0.28);
      float u0 = min(sub, 3.0) / 4.0, u1 = (min(sub, 3.0) + 1.0) / 4.0;
      vec2 P0 = base + vec2(c * h * lean * u0 * u0, -h * u0), P1 = base + vec2(c * h * lean * u1 * u1, -h * u1);
      A = P1; B = P0;
      r = (2.3 + 1.4 * hash1(fi * 4.4)) * uScale * (1.3 - 0.5 * u1);
      if (sub > 3.5){ vec2 tip = base + vec2(c * h * lean, -h); A = tip; B = tip; r = (2.4 + 1.6 * hash1(fi * 7.1)) * uScale; }
      float life = 1.0 - smoothstep(0.0, 2.0 * vy / g, a);
      I = life * (0.55 + 0.45 * amp) * (0.6 + 0.4 * abs(sin(theta)));
      hot = 0.5;
    } else {
      // Thrown drops on ballistic arcs. They fall back and flash once where they land.
      float P = 0.55 + hash1(fi * 2.7) * 0.6;
      float first = step(tau, 0.9);
      float ph = first > 0.5 ? tau : (tau - 0.9) / P + hash1(fi * 3.9);
      float k = first > 0.5 ? 0.0 : floor(ph) + 1.0;
      float a = (first > 0.5 ? tau - hash1(fi * 1.1) * 0.08 : fract(ph) * P) - sub * 0.038;
      if (a < 0.0){ gl_Position = vec4(2.0, 2.0, 0.0, 1.0); return; }
      float amp = first > 0.5 ? 1.35 : 0.9;
      float ang = (hash1(fi * 4.7 + k * 2.1) - 0.5) * 2.6 + dir * 0.45;
      float sp = (200.0 + 430.0 * pow(hash1(fi * 9.2 + k), 1.6)) * amp * uLandStrength * uScale;
      if (uType == 6){ ang = (hash1(fi * 4.7 + k) - 0.5) * 3.0; sp = (70.0 + 210.0 * hash1(fi + k)) * 1.5; }
      vec2 v0 = vec2(sin(ang), -cos(ang)) * sp;
      vec2 p = o + v0 * a + vec2(0.0, 0.5 * g * a * a);
      vec2 v = v0 + vec2(0.0, g * a);
      float landed = step(o.y + 3.0, p.y) * step(0.0, v.y);
      A = p; B = p - v * uShutter * (1.0 - landed);
      float trail = sub < 0.5 ? 1.0 : (sub < 1.5 ? 0.55 : (sub < 2.5 ? 0.32 : 0.18));
      r = (uType == 6 ? 1.6 + hash1(fi) * 2.8 : 0.9 + 1.4 * hash1(fi * 6.1 + k)) * uScale;
      float tLand = (-v0.y + sqrt(max(0.0, v0.y * v0.y + 2.0 * g * 3.0))) / g;
      I = (uType == 6 ? 1.0 - a / P : 1.0) * (1.0 - smoothstep(tLand, tLand + 0.09, a)) * 1.2 * trail;
      r *= mix(0.65, 1.0, trail);
      hot = 0.9;
    }
  } else if (uType == 4){
    // The thin sheet that spreads along the surface from the impact and thins as it goes.
    float tau = uTime - uLand.z;
    if (tau < 0.0){ gl_Position = vec4(2.0, 2.0, 0.0, 1.0); return; }
    float P = 0.5;
    float k = floor(tau / P), a = mod(tau, P) + (tau > 0.8 ? 0.0 : 0.0);
    float first = step(tau, 0.8);
    a = first > 0.5 ? tau : a;
    float side = fi < 0.5 ? -1.0 : 1.0;
    float L = (first > 0.5 ? 150.0 : 70.0 + 30.0 * hash1(k + fi)) * sqrt(a) * uScale;
    float lean = uLand.w == 0.0 ? 1.0 : (side == uLand.w ? 1.15 : 0.55);
    A = uLand.xy + vec2(side * L * lean, 0.0); B = uLand.xy + vec2(side * L * lean * 0.35, 0.0);
    r = 1.6 * uScale;
    I = (1.0 - smoothstep(0.0, first > 0.5 ? 0.8 : P, a)) * (first > 0.5 ? 1.0 : 0.7);
    hot = 0.7;
  } else {
    // The boil where water keeps arriving: a churn of short bright strokes.
    float tau = uTime - uLand.z;
    if (tau < 0.0){ gl_Position = vec4(2.0, 2.0, 0.0, 1.0); return; }
    float j = floor(uTime * 18.0 + hash1(fi) * 7.0);
    vec2 jit = vec2(hash1(fi * 3.0 + j) - 0.5, -hash1(fi * 5.0 + j) * 0.8) * vec2(34.0, 18.0) * uScale;
    A = uLand.xy + jit; B = A + vec2(hash1(fi + j * 2.0) - 0.5, -0.6) * 7.0 * uScale;
    r = (1.6 + hash1(fi * 2.0 + j) * 2.4) * uScale;
    I = 1.05 * smoothstep(0.0, 0.08, tau) * (0.5 + 0.5 * hash1(fi * 9.0 + j));
    hot = 1.0;
  }
  // A quad around the segment, in page px.
  vec2 d = B - A; float len = length(d);
  vec2 ax = len > 1e-3 ? d / len : vec2(0.0, 1.0), px = vec2(-ax.y, ax.x);
  int c = gl_VertexID;
  float cx = (c == 1 || c == 3) ? 1.0 : -1.0, cy = (c >= 2) ? 1.0 : -1.0;
  float pad = r * 2.5;
  vec2 along = cy > 0.0 ? A + ax * (len + pad) : A - ax * pad;
  vec2 pos = along + px * cx * pad;
  vL = vec2(dot(pos - A, ax), dot(pos - A, px));
  vSeg = vec2(len, 0.0); vR = r; vI = I; vHot = hot;
  gl_Position = toClip(pos);
}`;

export const PART_FS = `#version 300 es
precision highp float;
in vec2 vL; in vec2 vSeg; in float vR; in float vI; in float vHot;
out vec4 frag;
void main(){
  float along = clamp(vL.x, 0.0, vSeg.x);
  float d = length(vec2(vL.x - along, vL.y));
  float g = exp(-d * d / (vR * vR * 0.9));
  // Brighter at the head of a streak, as a lit drop is.
  float headK = vSeg.x > 0.5 ? mix(0.55, 1.0, clamp(along / vSeg.x, 0.0, 1.0)) : 1.0;
  float I = g * vI * mix(1.0, headK, step(0.5, vSeg.x));
  vec3 c = mix(vec3(1.0, 0.52, 0.14), vec3(1.0, 0.8, 0.45), vHot);
  frag = vec4(c * I, 0.0);
}`;

// ---- pools: an ellipse of water with rings that spread, cross and fade -----------------------------------

export const POOL_VS = `#version 300 es
${VIEW}
in vec2 aQuad;
uniform vec4 uPool; // x, y, rx, ry
out vec2 vQ;
void main(){ vQ = aQuad * 1.25; gl_Position = toClip(uPool.xy + vQ * uPool.zw); }`;

export const POOL_FS = `#version 300 es
precision highp float;
${NOISE}
in vec2 vQ;
uniform float uTime, uWet, uKick, uKickTime;
uniform vec4 uPool;
out vec4 frag;
void main(){
  // It spreads from the inflow at the back as it fills.
  float r = length(vQ - vec2(0.0, -0.55) * (1.0 - uWet)) / max(0.15, sqrt(uWet));
  if (r > 1.25){ frag = vec4(0.0); return; }
  float inside = smoothstep(1.0, 0.96, r);
  // Rings from the inflow at the back of the pool and from drops landing at random spots, each cycle different.
  vec2 px = vQ * uPool.zw;
  float rings = 0.0;
  for (int k = 0; k < 6; k++){
    float fk = float(k);
    float P = 1.6 + fk * 0.23;
    float ph = uTime / P + fk * 0.37, c = floor(ph), a = fract(ph);
    vec2 src = k < 2 ? vec2((hash1(c + fk) - 0.5) * 0.2, -0.55) : vec2(hash1(c * 1.7 + fk) - 0.5, hash1(c * 2.3 + fk) - 0.5) * vec2(1.4, 1.0);
    // Rings are circles on the water, foreshortened exactly as the pool is: circles in its own coordinates.
    vec2 d = vQ - src;
    float R = a * (k < 2 ? 1.6 : 0.9);
    float w = 0.016 + a * 0.022;
    rings += exp(-pow((length(d) - R) / w, 2.0)) * (1.0 - a) * (k < 2 ? 1.8 : 1.05);
  }
  // A launch sends one big ring across the pool.
  float ka = uTime - uKickTime;
  float kick = uKick * step(0.0, ka) * exp(-pow((length(vQ) - ka * 0.9) / 0.06, 2.0)) * exp(-ka * 0.8) * 1.6;
  float under = 0.1 + exp(-r * r * 1.3) * 0.5;
  float a1 = fbm(px * 0.045 + vec2(uTime * 0.18, -uTime * 0.11)), a2 = fbm(px * 0.06 + 7.0 - vec2(uTime * 0.13, uTime * 0.09));
  float caust = pow(1.0 - abs(a1 - a2), 12.0) * 0.32 * smoothstep(0.3, 0.75, fbm(px * 0.012 + 3.0 + uTime * 0.05));
  float shimmer = 0.06 * fbm(px * 0.05 + uTime * 0.3);
  float meniscus = exp(-pow((r - 0.975) / 0.022, 2.0)) * 0.55 + exp(-pow((r - 0.95) / 0.07, 2.0)) * 0.12;
  float inflow = exp(-length((vQ - vec2(0.0, -0.55)) * vec2(1.0, 1.6)) * 4.0) * 0.45;
  float I = (under + caust + shimmer + inflow + rings * 0.38 + kick) * inside + meniscus;
  vec3 col = mix(vec3(0.75, 0.26, 0.03), vec3(1.0, 0.68, 0.28), smoothstep(0.1, 0.9, I)) * I * min(1.0, uWet * 1.5);
  frag = vec4(col, 0.0);
}`;
