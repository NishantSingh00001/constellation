// GET /api/health  service status for the UI and for uptime checks

import { handler, json } from "../lib/http.mjs";
import { getTotals } from "../lib/store.mjs";
import { aiConfigured, modelChain } from "../lib/gemini.mjs";

export default handler(async () => {
  let storage = "ok";
  let totals = null;
  try {
    totals = await getTotals();
  } catch (err) {
    storage = "unavailable";
    console.error(err);
  }
  return json({
    ok: storage === "ok",
    storage,
    ai: aiConfigured() ? { enabled: true, model: modelChain()[0] } : { enabled: false },
    totals,
    time: new Date().toISOString(),
  });
});

export const config = { path: "/api/health", method: "GET" };
