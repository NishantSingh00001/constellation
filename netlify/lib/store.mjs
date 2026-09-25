// Persistence on Netlify Blobs (a key-value store that ships with every Netlify site).
//
// Store "constellation-runs"
//   runs/<id>   full run: segments, model diagnostics, customer table, playbook
//   meta/<id>   small summary used for history lists
// Store "constellation-meta"
//   totals      running counters shown on the landing page
//   limit/...   per-IP counters for the AI endpoints

import { getStore } from "@netlify/blobs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { HttpError } from "./http.mjs";

export const DEMO_ID = "demo";

const runs = () => getStore({ name: "constellation-runs", consistency: "strong" });
const meta = () => getStore({ name: "constellation-meta", consistency: "strong" });

export function newId() {
  return randomBytes(9).toString("base64url").replace(/[-_]/g, "x").slice(0, 12);
}

export function newOwnerToken() {
  return randomBytes(18).toString("base64url");
}

export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function isOwner(run, token) {
  if (!token || !run.ownerHash) return false;
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(run.ownerHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Everything except the owner hash, which never leaves the server. */
export function publicRun(run) {
  const { ownerHash, ...rest } = run;
  return rest;
}

export function summarize(run) {
  return {
    id: run.id,
    name: run.name,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    source: run.source,
    customers: run.summary.customers,
    revenue: run.summary.revenue,
    currency: run.currency,
    k: run.summary.k,
    silhouette: run.summary.silhouette,
    segments: run.segments.map((s) => ({ name: s.name, color: s.color, share: s.share })),
  };
}

export async function saveRun(run) {
  run.updatedAt = new Date().toISOString();
  const s = runs();
  await s.setJSON(`runs/${run.id}`, run);
  await s.setJSON(`meta/${run.id}`, summarize(run));
  return run;
}

export async function getRun(id) {
  if (!/^[A-Za-z0-9]{4,24}$/.test(String(id))) throw new HttpError(400, "That run ID doesn't look right.");
  const run = await runs().get(`runs/${id}`, { type: "json" });
  if (!run) throw new HttpError(410, "Run not found. It may have expired or been deleted.");
  return run;
}

export async function getSummaries(ids) {
  const s = runs();
  const out = await Promise.all(ids.slice(0, 50).map((id) => s.get(`meta/${id}`, { type: "json" }).catch(() => null)));
  return out.filter(Boolean);
}

export async function deleteRun(id) {
  const s = runs();
  await s.delete(`runs/${id}`);
  await s.delete(`meta/${id}`);
}

export async function listAllMeta() {
  const s = runs();
  const { blobs } = await s.list({ prefix: "meta/" });
  return blobs.map((b) => b.key.slice(5));
}

export async function getTotals() {
  return (await meta().get("totals", { type: "json" })) || { runs: 0, customers: 0, rows: 0 };
}

export async function bumpTotals(run) {
  const store = meta();
  const t = (await store.get("totals", { type: "json" })) || { runs: 0, customers: 0, rows: 0 };
  t.runs += 1;
  t.customers += run.summary.customers;
  t.rows += run.summary.rows;
  await store.setJSON("totals", t);
  return t;
}

/** Simple fixed-window limiter for the AI endpoints, so a public demo can't drain the API key. */
export async function rateLimit(ip, { perHour = 20, perDay = 400 } = {}) {
  const store = meta();
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const day = now.toISOString().slice(0, 10);
  const ipKey = `limit/ip/${hashToken(ip || "unknown").slice(0, 16)}/${hour}`;
  const dayKey = `limit/day/${day}`;
  const [ipCount, dayCount] = await Promise.all([
    store.get(ipKey, { type: "json" }).then((v) => v || 0),
    store.get(dayKey, { type: "json" }).then((v) => v || 0),
  ]);
  if (ipCount >= perHour) throw new HttpError(429, "You've hit the hourly AI limit for this demo. Try again in a bit.");
  if (dayCount >= perDay) throw new HttpError(429, "The demo's daily AI budget is used up. The rule-based playbook still works.");
  await Promise.all([store.setJSON(ipKey, ipCount + 1), store.setJSON(dayKey, dayCount + 1)]);
}
