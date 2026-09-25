// GET /api/runs/:id/export  download every customer with their segment as CSV

import { handler } from "../lib/http.mjs";
import { getRun } from "../lib/store.mjs";

const cell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default handler(async (req, context) => {
  const run = await getRun(context.params.id);
  const c = run.customers;
  const lines = ["customer_id,segment,recency_days,frequency,monetary,avg_order_value,tenure_days,location"];
  for (let i = 0; i < c.id.length; i++) {
    const seg = run.segments[c.seg[i]];
    lines.push([c.id[i], seg.name, c.r[i], c.f[i], c.m[i], Math.round(c.m[i] / c.f[i]), c.t[i], c.loc[i] >= 0 ? run.locations[c.loc[i]] : ""].map(cell).join(","));
  }
  const name = `${run.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "run"}-segments.csv`;
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
});

export const config = { path: "/api/runs/:id/export", method: "GET" };
