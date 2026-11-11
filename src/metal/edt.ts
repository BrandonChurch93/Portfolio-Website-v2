// Signed distance from antialiased coverage, by the Felzenszwalb and Huttenlocher exact Euclidean distance transform.
// Edge pixels are seeded from their coverage, so the edge lands between pixels where the coverage says it does.
// Pure: no DOM. Positive outside the shape, negative inside, in pixels.

const INF = 1e20;

// One dimensional squared distance transform of f (length n), in place into d. v and z are scratch.
function edt1d(f: Float64Array, d: Float64Array, v: Int32Array, z: Float64Array, n: number): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = dq * dq + f[v[k]];
  }
}

function edt2d(grid: Float64Array, w: number, h: number): void {
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, d, v, z, h);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, d, v, z, w);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
}

// coverage: 0 to 1 per pixel (or 0 to 255 when max is 255). Returns signed distance in pixels.
export function signedDistance(coverage: ArrayLike<number>, w: number, h: number, max = 1): Float32Array {
  const size = w * h;
  const outer = new Float64Array(size);
  const inner = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    const a = coverage[i] / max;
    if (a >= 1) {
      outer[i] = 0;
      inner[i] = INF;
    } else if (a <= 0) {
      outer[i] = INF;
      inner[i] = 0;
    } else {
      const e = 0.5 - a;
      outer[i] = e > 0 ? e * e : 0;
      inner[i] = e < 0 ? e * e : 0;
    }
  }
  edt2d(outer, w, h);
  edt2d(inner, w, h);
  const out = new Float32Array(size);
  for (let i = 0; i < size; i++) out[i] = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
  return out;
}
