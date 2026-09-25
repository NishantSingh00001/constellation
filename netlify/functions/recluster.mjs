// POST /api/runs/:id/recluster  { k }  re-fit the saved customers with a different number of segments

import { handler, json, fail, readJson } from "../lib/http.mjs";
import { getRun, saveRun, isOwner } from "../lib/store.mjs";
import { publicRun } from "../lib/store.mjs";
import { parseK } from "../lib/create.mjs";
import { recluster } from "../../shared/pipeline.js";
import { rulePlaybook } from "../../shared/segments.js";

export default handler(async (req, context) => {
  const run = await getRun(context.params.id);
  if (!isOwner(run, req.headers.get("x-owner-token"))) return fail(401, "This is a shared, read-only run. Start your own run to change k.");
  const body = await readJson(req);
  let k = parseK(body.k);
  if (k === "auto") k = run.model.autoK;
  if (!run.model.candidates.some((c) => c.k === k)) return fail(400, `k = ${k} wasn't part of this run's model scan.`);
  const next = recluster(run, k);
  next.playbook = rulePlaybook(next.segments, next.currency);
  next.qa = [];
  await saveRun(next);
  return json({ run: publicRun(next), owner: true });
});

export const config = { path: "/api/runs/:id/recluster", method: "POST" };
