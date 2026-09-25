// POST /api/runs/:id/playbook  { context }  write an AI marketing playbook for each segment (Gemini)

import { handler, json, fail, readJson } from "../lib/http.mjs";
import { getRun, saveRun, isOwner, rateLimit, DEMO_ID } from "../lib/store.mjs";
import { generate, aiConfigured } from "../lib/gemini.mjs";
import { PLAYBOOK_SYSTEM, PLAYBOOK_SCHEMA, playbookPrompt, mergePlaybook } from "../lib/prompts.mjs";

export default handler(async (req, context) => {
  const run = await getRun(context.params.id);
  const owner = isOwner(run, req.headers.get("x-owner-token"));
  const isDemo = run.id === DEMO_ID;
  if (!owner && !isDemo) return fail(401, "This is a shared, read-only run.");
  // The shared demo only ever generates its AI playbook once.
  if (isDemo && !owner && run.playbook?.source === "gemini") return json({ playbook: run.playbook, cached: true });
  if (!aiConfigured()) return fail(503, "AI isn't set up on this deployment yet, so you're seeing the rule-based playbook.");

  const body = await readJson(req).catch(() => ({}));
  const ctx = String(body.context || run.context || "").slice(0, 400);
  await rateLimit(context.ip);
  const { data, model } = await generate({
    system: PLAYBOOK_SYSTEM,
    prompt: playbookPrompt(run, ctx),
    schema: PLAYBOOK_SCHEMA,
    temperature: 0.7,
    maxOutputTokens: 8192,
  });
  run.context = ctx;
  run.playbook = mergePlaybook(run, data, model);
  await saveRun(run);
  return json({ playbook: run.playbook });
});

export const config = { path: "/api/runs/:id/playbook", method: "POST" };
