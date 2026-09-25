// GET    /api/runs/:id   full run (segments, model diagnostics, customers, playbook)
// DELETE /api/runs/:id   delete (owner only)

import { handler, json, fail } from "../lib/http.mjs";
import { getRun, deleteRun, saveRun, isOwner, DEMO_ID, bumpTotals } from "../lib/store.mjs";
import { publicRun } from "../lib/store.mjs";
import { sampleRun } from "../lib/create.mjs";

async function loadOrCreateDemo() {
  try {
    return await getRun(DEMO_ID);
  } catch (err) {
    if (err.status !== 410) throw err;
    const run = sampleRun();
    run.id = DEMO_ID;
    run.name = "Live demo · Thread & Clay";
    run.createdAt = new Date().toISOString();
    run.demo = true;
    await saveRun(run);
    await bumpTotals(run).catch(() => null);
    return run;
  }
}

export default handler(async (req, context) => {
  const { id } = context.params;
  const token = req.headers.get("x-owner-token");
  if (req.method === "DELETE") {
    const run = await getRun(id);
    if (!isOwner(run, token)) return fail(401, "Only the person who created this run can delete it.");
    await deleteRun(id);
    return new Response(null, { status: 204 });
  }
  const run = id === DEMO_ID ? await loadOrCreateDemo() : await getRun(id);
  return json({ run: publicRun(run), owner: isOwner(run, token) });
});

export const config = { path: "/api/runs/:id", method: ["GET", "DELETE"] };
