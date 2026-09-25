// The segmentation pipeline: clean -> RFM features -> transform -> K-Means
// model selection -> segment labelling. Shared by the Netlify Functions
// (production) and the parity script. python/pipeline.py is the pandas +
// scikit-learn version of the same steps.

import { kmeans, silhouette, calinskiHarabasz, daviesBouldin, sampleIndices } from "./kmeans.js";
import { ARCHETYPES, assignArchetypes } from "./segments.js";

const DAY = 86400000;
export const K_RANGE = [2, 8];
export const WINSOR = [0.005, 0.995];
export const SILHOUETTE_SAMPLE = 2000;
export const PALETTE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#2aa12a", "#9085e9", "#e66767"];

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Stage 2: drop rows that can't be used, and count why. */
export function clean(tx) {
  const report = { missingCustomer: 0, badDate: 0, returns: 0, badValue: 0, duplicates: 0 };
  const seen = new Set();
  const valid = [];
  for (const t of tx) {
    if (!t.customer) { report.missingCustomer++; continue; }
    if (!Number.isFinite(t.date)) { report.badDate++; continue; }
    if (/^c/i.test(t.invoice) || t.quantity < 0 || t.amount < 0) { report.returns++; continue; }
    if (!Number.isFinite(t.amount) || t.amount <= 0) { report.badValue++; continue; }
    if (seen.has(t.key)) { report.duplicates++; continue; }
    seen.add(t.key);
    valid.push(t);
  }
  return { valid, report };
}

/** Stage 3: one row per customer with recency, frequency, monetary, tenure. */
export function buildFeatures(valid) {
  let maxDate = -Infinity, minDate = Infinity;
  for (const t of valid) {
    if (t.date > maxDate) maxDate = t.date;
    if (t.date < minDate) minDate = t.date;
  }
  // Snapshot = the day after the last order (midnight), as is standard for RFM.
  const snapshot = Math.floor(maxDate / DAY) * DAY + DAY;
  const byCust = new Map();
  for (const t of valid) {
    let c = byCust.get(t.customer);
    if (!c) {
      c = { first: t.date, last: t.date, orders: new Set(), monetary: 0, loc: new Map() };
      byCust.set(t.customer, c);
    }
    if (t.date < c.first) c.first = t.date;
    if (t.date > c.last) c.last = t.date;
    // Without an invoice column, one customer-day counts as one order.
    c.orders.add(t.invoice || String(Math.floor(t.date / DAY)));
    c.monetary += t.amount;
    if (t.location) c.loc.set(t.location, (c.loc.get(t.location) || 0) + 1);
  }
  const ids = [...byCust.keys()].sort();
  const n = ids.length;
  const R = new Float64Array(n), F = new Float64Array(n), M = new Float64Array(n), T = new Float64Array(n);
  const locIndex = new Map();
  const locations = [];
  const L = new Int32Array(n).fill(-1);
  let orders = 0, revenue = 0;
  ids.forEach((id, i) => {
    const c = byCust.get(id);
    R[i] = Math.floor((snapshot - c.last) / DAY);
    F[i] = c.orders.size;
    M[i] = Math.round(c.monetary * 100) / 100;
    T[i] = Math.floor((snapshot - c.first) / DAY);
    orders += F[i];
    revenue += M[i];
    if (c.loc.size) {
      const top = [...c.loc.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
      if (!locIndex.has(top)) { locIndex.set(top, locations.length); locations.push(top); }
      L[i] = locIndex.get(top);
    }
  });
  return { ids, R, F, M, T, L, locations, snapshot, minDate, maxDate, orders, revenue };
}

export function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Stage 4a: log1p -> winsorise -> z-score. Returns the matrix and the fitted scaler. */
export function transform(feat, scaler) {
  const n = feat.ids.length;
  const cols = [feat.R, feat.F, feat.M];
  const d = cols.length;
  const X = new Float64Array(n * d);
  const fit = scaler || { lo: [], hi: [], mean: [], std: [] };
  for (let t = 0; t < d; t++) {
    const logs = new Float64Array(n);
    for (let i = 0; i < n; i++) logs[i] = Math.log1p(cols[t][i]);
    if (!scaler) {
      const sorted = Float64Array.from(logs).sort();
      fit.lo[t] = quantile(sorted, WINSOR[0]);
      fit.hi[t] = quantile(sorted, WINSOR[1]);
    }
    let mean = 0;
    for (let i = 0; i < n; i++) { logs[i] = Math.min(fit.hi[t], Math.max(fit.lo[t], logs[i])); mean += logs[i]; }
    mean /= n;
    let v = 0;
    for (let i = 0; i < n; i++) v += (logs[i] - mean) ** 2;
    const std = Math.sqrt(v / n) || 1;
    if (!scaler) { fit.mean[t] = mean; fit.std[t] = std; }
    for (let i = 0; i < n; i++) X[i * d + t] = (logs[i] - fit.mean[t]) / fit.std[t];
  }
  return { X, n, d, scaler: fit };
}

/** RFM quintile scores 1–5 (R reversed: more recent = higher). Ties broken by order, like pandas rank(method="first"). */
export function rfmScores(feat) {
  const n = feat.ids.length;
  const score = (arr, reverse) => {
    const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => arr[a] - arr[b] || a - b);
    const out = new Uint8Array(n);
    idx.forEach((i, rank) => {
      const q = Math.min(5, Math.floor((rank * 5) / n) + 1);
      out[i] = reverse ? 6 - q : q;
    });
    return out;
  };
  return { r: score(feat.R, true), f: score(feat.F, false), m: score(feat.M, false) };
}

/** Stage 4b: fit K for each candidate and score it. */
export function scanK(X, n, d, { kMin = K_RANGE[0], kMax = K_RANGE[1], seed = 42, nInit = 4 } = {}) {
  const sample = sampleIndices(n, SILHOUETTE_SAMPLE, seed);
  const out = [];
  const maxK = Math.min(kMax, Math.max(kMin, Math.floor(n / 10)));
  for (let k = kMin; k <= maxK; k++) {
    const res = kmeans(X, n, d, k, { nInit, seed });
    out.push({
      k,
      inertia: round(res.inertia, 2),
      silhouette: round(silhouette(X, n, d, res.labels, k, sample), 4),
      calinskiHarabasz: round(calinskiHarabasz(X, n, d, res.labels, res.centroids, k), 1),
      daviesBouldin: round(daviesBouldin(X, n, d, res.labels, res.centroids, k), 4),
    });
  }
  return out;
}

/** Auto-pick: best silhouette among k >= 3 (two groups is rarely useful to act on). */
export function pickK(candidates) {
  const pool = candidates.filter((c) => c.k >= 3);
  const list = pool.length ? pool : candidates;
  return list.reduce((a, b) => (b.silhouette > a.silhouette ? b : a)).k;
}

function round(v, p) {
  const f = 10 ** p;
  return Math.round(v * f) / f;
}

function median(arr) {
  const s = Float64Array.from(arr).sort();
  return s.length ? quantile(s, 0.5) : 0;
}

/** Stage 5: fit the final model and describe each cluster. */
export function fitAndLabel(feat, X, n, d, k, scaler, { seed = 42 } = {}) {
  const res = kmeans(X, n, d, k, { nInit: 10, seed });
  const scores = rfmScores(feat);
  const clusters = Array.from({ length: k }, () => ({ idx: [] }));
  for (let i = 0; i < n; i++) clusters[res.labels[i]].idx.push(i);
  const totalRevenue = feat.revenue;
  const described = clusters.map((c, j) => {
    const pick = (arr) => c.idx.map((i) => arr[i]);
    const mean = (arr) => c.idx.reduce((s, i) => s + arr[i], 0) / Math.max(1, c.idx.length);
    const revenue = c.idx.reduce((s, i) => s + feat.M[i], 0);
    const orders = c.idx.reduce((s, i) => s + feat.F[i], 0);
    const locCount = new Map();
    for (const i of c.idx) if (feat.L[i] >= 0) locCount.set(feat.L[i], (locCount.get(feat.L[i]) || 0) + 1);
    const topLocations = [...locCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([li, cnt]) => ({ name: feat.locations[li], share: round(cnt / c.idx.length, 3) }));
    return {
      cluster: j,
      size: c.idx.length,
      revenue: round(revenue, 2),
      orders,
      avg: {
        recency: round(mean(feat.R), 1),
        frequency: round(mean(feat.F), 2),
        monetary: round(mean(feat.M), 0),
        aov: round(revenue / Math.max(1, orders), 0),
        tenure: round(mean(feat.T), 0),
      },
      median: { recency: median(pick(feat.R)), frequency: median(pick(feat.F)), monetary: round(median(pick(feat.M)), 0) },
      scores: { r: round(mean(scores.r), 2), f: round(mean(scores.f), 2), m: round(mean(scores.m), 2) },
      centroid: Array.from(res.centroids.slice(j * d, j * d + d), (v) => round(v, 4)),
      topLocations,
    };
  });
  const arche = assignArchetypes(described.map((c) => [c.scores.r, c.scores.f, c.scores.m]));
  described.forEach((c, j) => {
    const a = ARCHETYPES[arche[j]];
    c.key = a.key;
    c.name = a.name;
    c.description = a.blurb;
    c.value = c.scores.r * 0.8 + c.scores.f + c.scores.m * 1.2;
  });
  // Order segments by value so ids/colours read best -> worst.
  const order = [...described].sort((a, b) => b.value - a.value);
  const remap = new Int32Array(k);
  const segments = order.map((c, id) => {
    remap[c.cluster] = id;
    const { cluster, value, ...rest } = c;
    return {
      id,
      ...rest,
      color: PALETTE[id % PALETTE.length],
      share: round(c.size / n, 4),
      revenueShare: round(c.revenue / totalRevenue, 4),
      centroidRaw: {
        recency: round(Math.expm1(c.centroid[0] * scaler.std[0] + scaler.mean[0]), 1),
        frequency: round(Math.expm1(c.centroid[1] * scaler.std[1] + scaler.mean[1]), 2),
        monetary: round(Math.expm1(c.centroid[2] * scaler.std[2] + scaler.mean[2]), 0),
      },
    };
  });
  const seg = new Uint8Array(n);
  for (let i = 0; i < n; i++) seg[i] = remap[res.labels[i]];
  return { segments, seg, inertia: round(res.inertia, 2), iterations: res.iterations };
}

/**
 * Compact, JSON-friendly customer table (columnar). 3D positions are not
 * stored: the browser rebuilds them from r/f/m with the saved scaler
 * (see positionsFromColumns), which keeps each run about 40% smaller.
 */
export function customerColumns(feat, X, d, seg) {
  const n = feat.ids.length;
  const cols = { id: feat.ids, r: [], f: [], m: [], t: [], seg: [], loc: [] };
  for (let i = 0; i < n; i++) {
    cols.r.push(feat.R[i]);
    cols.f.push(feat.F[i]);
    cols.m.push(feat.M[i]);
    cols.t.push(feat.T[i]);
    cols.seg.push(seg[i]);
    cols.loc.push(feat.L[i]);
  }
  return cols;
}

/**
 * Scaled positions for the 3D view: x = frequency, y = monetary, z = recency
 * flipped (recent = forward). Order counts and days are whole numbers, which
 * draws visible stripes, so the view adds a small deterministic jitter
 * (display only; the model never sees it).
 */
export function positionsFromColumns(c, scaler, { jitter = true } = {}) {
  const n = c.id.length;
  const out = new Float32Array(n * 3);
  const z = (v, t) => (Math.min(scaler.hi[t], Math.max(scaler.lo[t], Math.log1p(v))) - scaler.mean[t]) / scaler.std[t];
  const h = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x) - 0.5; };
  for (let i = 0; i < n; i++) {
    const jf = jitter ? h(i, 1) * 0.8 : 0;
    const jr = jitter ? h(i, 2) * 1.0 : 0;
    out[i * 3] = z(Math.max(0.5, c.f[i] + jf), 1);
    out[i * 3 + 1] = z(c.m[i], 2);
    out[i * 3 + 2] = -z(Math.max(0, c.r[i] + jr), 0);
  }
  return out;
}

/** Rebuild the feature object from a stored run's customer columns. */
export function featuresFromColumns(c, locations) {
  const n = c.id.length;
  const feat = {
    ids: c.id,
    R: Float64Array.from(c.r), F: Float64Array.from(c.f), M: Float64Array.from(c.m), T: Float64Array.from(c.t),
    L: Int32Array.from(c.loc), locations,
    revenue: 0, orders: 0,
  };
  for (let i = 0; i < n; i++) { feat.revenue += feat.M[i]; feat.orders += feat.F[i]; }
  return feat;
}

/**
 * Full run. `tx` is an array of normalised transactions (see ingest.js).
 * options.k: "auto" or a number.
 */
export function runPipeline(tx, { k = "auto", seed = 42, ingestMs = 0, ingestStats = {} } = {}) {
  const stages = [];
  const stage = (key, label, fn) => {
    const t0 = now();
    const out = fn();
    stages.push({ key, label, ms: Math.round(now() - t0), stats: out.stats });
    return out;
  };
  stages.push({ key: "ingest", label: "Ingest", ms: Math.round(ingestMs), stats: { rows: tx.length, ...ingestStats } });

  const cleaned = stage("clean", "Clean", () => {
    const res = clean(tx);
    return { ...res, stats: { rowsIn: tx.length, rowsOut: res.valid.length, dropped: res.report } };
  });
  if (cleaned.valid.length === 0) throw new PipelineError("No usable rows after cleaning. Check the column mapping.");

  const feats = stage("features", "RFM features", () => {
    const f = buildFeatures(cleaned.valid);
    const sum = (arr) => { const s = Float64Array.from(arr).sort(); return { min: s[0], p25: quantile(s, 0.25), median: quantile(s, 0.5), p75: quantile(s, 0.75), max: s[s.length - 1] }; };
    return { f, stats: { customers: f.ids.length, orders: f.orders, revenue: Math.round(f.revenue), recency: sum(f.R), frequency: sum(f.F), monetary: sum(f.M) } };
  });
  const feat = feats.f;
  if (feat.ids.length < 30) throw new PipelineError(`Only ${feat.ids.length} customers found. Segmentation needs at least 30.`);

  const tf = stage("transform", "Scale", () => {
    const t = transform(feat);
    return { ...t, stats: { steps: ["log1p", `winsorise ${WINSOR[0] * 100}%–${WINSOR[1] * 100}%`, "z-score"], scaler: t.scaler } };
  });

  const scan = stage("model", "Model selection", () => {
    const candidates = scanK(tf.X, tf.n, tf.d, { seed });
    const auto = pickK(candidates);
    const chosen = k === "auto" ? auto : Math.max(2, Math.min(candidates[candidates.length - 1].k, Number(k)));
    return { candidates, auto, chosen, stats: { tried: candidates.map((c) => c.k), autoK: auto, chosenK: chosen } };
  });

  const fitted = stage("label", "Fit + label", () => {
    const res = fitAndLabel(feat, tf.X, tf.n, tf.d, scan.chosen, tf.scaler, { seed });
    return { ...res, stats: { k: scan.chosen, segments: res.segments.map((s) => s.name), iterations: res.iterations } };
  });

  const chosenMetrics = scan.candidates.find((c) => c.k === scan.chosen);
  return {
    stages,
    summary: {
      rows: tx.length,
      rowsClean: cleaned.valid.length,
      customers: feat.ids.length,
      orders: feat.orders,
      revenue: Math.round(feat.revenue),
      aov: Math.round(feat.revenue / feat.orders),
      dateRange: [new Date(feat.minDate).toISOString(), new Date(feat.maxDate).toISOString()],
      snapshot: new Date(feat.snapshot).toISOString(),
      k: scan.chosen,
      silhouette: chosenMetrics ? chosenMetrics.silhouette : null,
    },
    model: {
      algorithm: "K-Means (k-means++ init, 10 restarts)",
      features: ["recency", "frequency", "monetary"],
      transform: tf.stats.steps,
      scaler: tf.scaler,
      candidates: scan.candidates,
      autoK: scan.auto,
      chosenK: scan.chosen,
      selection: "Highest silhouette score for k ≥ 3",
      inertia: fitted.inertia,
      seed,
    },
    segments: fitted.segments,
    customers: customerColumns(feat, tf.X, tf.d, fitted.seg),
    locations: feat.locations,
  };
}

/** Re-fit an existing run with a different k, reusing its stored features and scaler. */
export function recluster(run, k) {
  const feat = featuresFromColumns(run.customers, run.locations);
  const tf = transform(feat, run.model.scaler);
  const t0 = now();
  const fitted = fitAndLabel(feat, tf.X, tf.n, tf.d, k, run.model.scaler, { seed: run.model.seed || 42 });
  const metrics = run.model.candidates.find((c) => c.k === k);
  return {
    ...run,
    summary: { ...run.summary, k, silhouette: metrics ? metrics.silhouette : null },
    model: { ...run.model, chosenK: k, inertia: fitted.inertia },
    segments: fitted.segments,
    customers: customerColumns(feat, tf.X, tf.d, fitted.seg),
    reclusterMs: Math.round(now() - t0),
  };
}

export class PipelineError extends Error {
  constructor(message) {
    super(message);
    this.name = "PipelineError";
    this.status = 422;
  }
}
