// K-Means (k-means++ init, Lloyd iterations) and cluster-quality metrics.
// Data is a flat Float64Array of n rows × d columns.

import { mulberry32 } from "./random.js";

function sqDist(X, i, d, C, j) {
  let s = 0;
  const a = i * d, b = j * d;
  for (let t = 0; t < d; t++) {
    const diff = X[a + t] - C[b + t];
    s += diff * diff;
  }
  return s;
}

function initPlusPlus(X, n, d, k, rand) {
  const C = new Float64Array(k * d);
  const first = Math.floor(rand() * n);
  for (let t = 0; t < d; t++) C[t] = X[first * d + t];
  const dist = new Float64Array(n).fill(Infinity);
  // Greedy k-means++ (like scikit-learn): try a few candidates per step, keep the best.
  const trials = 2 + Math.floor(Math.log(k));
  for (let c = 1; c < k; c++) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      const dd = sqDist(X, i, d, C, c - 1);
      if (dd < dist[i]) dist[i] = dd;
      total += dist[i];
    }
    let bestIdx = -1, bestPot = Infinity;
    for (let tr = 0; tr < trials; tr++) {
      let r = rand() * total, idx = 0;
      for (; idx < n - 1; idx++) { r -= dist[idx]; if (r <= 0) break; }
      let pot = 0;
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let t = 0; t < d; t++) { const diff = X[i * d + t] - X[idx * d + t]; s += diff * diff; }
        pot += Math.min(dist[i], s);
      }
      if (pot < bestPot) { bestPot = pot; bestIdx = idx; }
    }
    for (let t = 0; t < d; t++) C[c * d + t] = X[bestIdx * d + t];
  }
  return C;
}

function lloyd(X, n, d, k, C, maxIter = 300, tol = 1e-4) {
  const labels = new Int32Array(n);
  const counts = new Float64Array(k);
  const sums = new Float64Array(k * d);
  let inertia = 0, iter = 0;
  // tolerance relative to data variance, like scikit-learn
  let variance = 0;
  const mean = new Float64Array(d);
  for (let i = 0; i < n; i++) for (let t = 0; t < d; t++) mean[t] += X[i * d + t] / n;
  for (let i = 0; i < n; i++) for (let t = 0; t < d; t++) variance += (X[i * d + t] - mean[t]) ** 2 / n;
  const tolAbs = (tol * variance) / d;
  for (iter = 0; iter < maxIter; iter++) {
    inertia = 0;
    counts.fill(0);
    sums.fill(0);
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < k; j++) {
        const dd = sqDist(X, i, d, C, j);
        if (dd < bd) { bd = dd; best = j; }
      }
      labels[i] = best;
      inertia += bd;
      counts[best]++;
      for (let t = 0; t < d; t++) sums[best * d + t] += X[i * d + t];
    }
    let shift = 0;
    for (let j = 0; j < k; j++) {
      if (counts[j] === 0) {
        // Empty cluster: move it to the point farthest from its centroid.
        let far = 0, fd = -1;
        for (let i = 0; i < n; i++) { const dd = sqDist(X, i, d, C, labels[i]); if (dd > fd) { fd = dd; far = i; } }
        for (let t = 0; t < d; t++) C[j * d + t] = X[far * d + t];
        shift = Infinity;
        continue;
      }
      for (let t = 0; t < d; t++) {
        const v = sums[j * d + t] / counts[j];
        shift += (v - C[j * d + t]) ** 2;
        C[j * d + t] = v;
      }
    }
    if (shift <= tolAbs) break;
  }
  // Final assignment with the converged centroids.
  inertia = 0;
  for (let i = 0; i < n; i++) {
    let best = 0, bd = Infinity;
    for (let j = 0; j < k; j++) { const dd = sqDist(X, i, d, C, j); if (dd < bd) { bd = dd; best = j; } }
    labels[i] = best;
    inertia += bd;
  }
  return { labels, centroids: C, inertia, iterations: iter + 1 };
}

/** Best of nInit k-means++ runs. */
export function kmeans(X, n, d, k, { nInit = 10, seed = 42, maxIter = 300 } = {}) {
  const rand = mulberry32(seed * 7919 + k);
  let best = null;
  for (let r = 0; r < nInit; r++) {
    const C = initPlusPlus(X, n, d, k, rand);
    const res = lloyd(X, n, d, k, C, maxIter);
    if (!best || res.inertia < best.inertia) best = res;
  }
  return best;
}

/** Mean silhouette over a fixed subset of points (like sklearn's sample_size). */
export function silhouette(X, n, d, labels, k, sampleIdx) {
  const idx = sampleIdx || Array.from({ length: n }, (_, i) => i);
  const m = idx.length;
  const sumTo = new Float64Array(k);
  const cnt = new Float64Array(k);
  for (const i of idx) cnt[labels[i]]++;
  let total = 0;
  for (let a = 0; a < m; a++) {
    const i = idx[a];
    sumTo.fill(0);
    for (let b = 0; b < m; b++) {
      if (a === b) continue;
      const j = idx[b];
      let s = 0;
      for (let t = 0; t < d; t++) { const diff = X[i * d + t] - X[j * d + t]; s += diff * diff; }
      sumTo[labels[j]] += Math.sqrt(s);
    }
    const own = labels[i];
    if (cnt[own] <= 1) continue; // silhouette of a singleton is 0
    const ai = sumTo[own] / (cnt[own] - 1);
    let bi = Infinity;
    for (let c = 0; c < k; c++) if (c !== own && cnt[c] > 0) bi = Math.min(bi, sumTo[c] / cnt[c]);
    total += (bi - ai) / Math.max(ai, bi);
  }
  return total / m;
}

export function calinskiHarabasz(X, n, d, labels, centroids, k) {
  const mean = new Float64Array(d);
  for (let i = 0; i < n; i++) for (let t = 0; t < d; t++) mean[t] += X[i * d + t] / n;
  const cnt = new Float64Array(k);
  let W = 0;
  for (let i = 0; i < n; i++) {
    cnt[labels[i]]++;
    for (let t = 0; t < d; t++) W += (X[i * d + t] - centroids[labels[i] * d + t]) ** 2;
  }
  let B = 0;
  for (let j = 0; j < k; j++) for (let t = 0; t < d; t++) B += cnt[j] * (centroids[j * d + t] - mean[t]) ** 2;
  return (B / (k - 1)) / (W / (n - k));
}

export function daviesBouldin(X, n, d, labels, centroids, k) {
  const scatter = new Float64Array(k);
  const cnt = new Float64Array(k);
  for (let i = 0; i < n; i++) {
    const j = labels[i];
    cnt[j]++;
    let s = 0;
    for (let t = 0; t < d; t++) s += (X[i * d + t] - centroids[j * d + t]) ** 2;
    scatter[j] += Math.sqrt(s);
  }
  for (let j = 0; j < k; j++) scatter[j] /= Math.max(1, cnt[j]);
  let total = 0;
  for (let i = 0; i < k; i++) {
    let worst = 0;
    for (let j = 0; j < k; j++) {
      if (i === j) continue;
      let s = 0;
      for (let t = 0; t < d; t++) s += (centroids[i * d + t] - centroids[j * d + t]) ** 2;
      worst = Math.max(worst, (scatter[i] + scatter[j]) / Math.sqrt(s));
    }
    total += worst;
  }
  return total / k;
}

export function sampleIndices(n, size, seed = 42) {
  if (n <= size) return Array.from({ length: n }, (_, i) => i);
  const rand = mulberry32(seed);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < size; i++) {
    const j = i + Math.floor(rand() * (n - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, size);
}
