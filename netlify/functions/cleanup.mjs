// Scheduled daily: delete uploaded runs older than 30 days and old rate-limit counters.

import { getStore } from "@netlify/blobs";
import { listAllMeta, deleteRun, DEMO_ID } from "../lib/store.mjs";

const MAX_AGE_DAYS = 30;

export default async () => {
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  const runs = getStore({ name: "constellation-runs", consistency: "strong" });
  let removed = 0;
  for (const id of await listAllMeta()) {
    if (id === DEMO_ID) continue;
    const meta = await runs.get(`meta/${id}`, { type: "json" });
    if (meta && Date.parse(meta.updatedAt || meta.createdAt) < cutoff) {
      await deleteRun(id);
      removed++;
    }
  }
  const metaStore = getStore({ name: "constellation-meta", consistency: "strong" });
  const { blobs } = await metaStore.list({ prefix: "limit/" });
  const today = new Date().toISOString().slice(0, 10);
  for (const b of blobs) if (!b.key.includes(today)) await metaStore.delete(b.key);
  console.log(`cleanup: removed ${removed} runs`);
};

export const config = { schedule: "@daily" };
