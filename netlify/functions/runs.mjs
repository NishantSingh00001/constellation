// POST /api/runs        start a run (sample data, or an uploaded CSV as multipart form data)
// GET  /api/runs?ids=   summaries for the given run IDs (the browser keeps its own list)

import { gunzipSync } from "node:zlib";
import { handler, json, fail, readJson, HttpError } from "../lib/http.mjs";
import { saveRun, getSummaries, newId, newOwnerToken, hashToken, bumpTotals, publicRun } from "../lib/store.mjs";
import { sampleRun, csvRun, parseK, LIMITS } from "../lib/create.mjs";

async function fromUpload(req) {
  const form = await req.formData();
  const file = form.get("file");
  let meta = {};
  try { meta = JSON.parse(form.get("meta") || "{}"); } catch { throw new HttpError(400, "Bad upload metadata."); }
  if (!file || typeof file.arrayBuffer !== "function") throw new HttpError(400, "No file received.");
  let buf = Buffer.from(await file.arrayBuffer());
  if (meta.gzip) {
    try { buf = gunzipSync(buf, { maxOutputLength: LIMITS.csvBytes }); }
    catch (e) { throw new HttpError(413, e.code === "ERR_BUFFER_TOO_LARGE" ? "That file is larger than 60 MB once unzipped." : "Couldn't decompress the upload."); }
  }
  const text = buf.toString("utf8").replace(/^﻿/, "");
  return csvRun({ text, filename: meta.filename, mapping: meta.mapping, dateOrder: meta.dateOrder, k: parseK(meta.k), currency: meta.currency, context: meta.context });
}

export default handler(async (req) => {
  if (req.method === "GET") {
    const ids = (new URL(req.url).searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter((s) => /^[A-Za-z0-9]{4,24}$/.test(s));
    return json({ runs: await getSummaries(ids) });
  }
  if (req.method !== "POST") return fail(405, "Method not allowed");

  const type = req.headers.get("content-type") || "";
  const started = Date.now();
  let run;
  if (type.includes("multipart/form-data")) {
    run = await fromUpload(req);
  } else {
    const body = await readJson(req);
    if (body.source !== "sample") throw new HttpError(400, "Send source: 'sample', or upload a CSV file.");
    run = sampleRun({ k: parseK(body.k) });
  }
  const ownerToken = newOwnerToken();
  run.id = newId();
  run.createdAt = new Date().toISOString();
  run.ownerHash = hashToken(ownerToken);
  run.serverMs = Date.now() - started;
  await saveRun(run);
  const totals = await bumpTotals(run).catch(() => null);
  return json({ run: publicRun(run), ownerToken, owner: true, totals }, 201);
});

export const config = { path: "/api/runs", method: ["GET", "POST"] };
