// POST /api/runs/:id/ask  { question }  answer a question about the run's segments (Gemini)

import { handler, json, fail, readJson } from "../lib/http.mjs";
import { getRun, saveRun, isOwner, rateLimit } from "../lib/store.mjs";
import { generate, aiConfigured } from "../lib/gemini.mjs";
import { ASK_SYSTEM, askPrompt } from "../lib/prompts.mjs";

export default handler(async (req, context) => {
  const run = await getRun(context.params.id);
  if (!aiConfigured()) return fail(503, "AI isn't set up on this deployment yet. Add a GEMINI_API_KEY to enable questions.");
  const body = await readJson(req);
  const question = String(body.question || "").trim().slice(0, 500);
  if (question.length < 3) return fail(400, "Ask a question about your segments.");
  await rateLimit(context.ip);
  const { text, model } = await generate({ system: ASK_SYSTEM, prompt: askPrompt(run, question), temperature: 0.4, maxOutputTokens: 2048 });
  const entry = { q: question, a: text, model, at: new Date().toISOString() };
  if (isOwner(run, req.headers.get("x-owner-token"))) {
    run.qa = [...(run.qa || []), entry].slice(-20);
    await saveRun(run);
  }
  return json(entry);
});

export const config = { path: "/api/runs/:id/ask", method: "POST" };
