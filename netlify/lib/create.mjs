// Builds a run from the sample generator or an uploaded CSV.

import Papa from "papaparse";
import { generateSample, SAMPLE_MAPPING, SAMPLE_META } from "../../shared/sample.js";
import { normalizeRows, validateMapping, detectMapping } from "../../shared/ingest.js";
import { runPipeline, PipelineError } from "../../shared/pipeline.js";
import { rulePlaybook } from "../../shared/segments.js";
import { HttpError } from "./http.mjs";

export const LIMITS = { rows: 600000, customers: 100000, csvBytes: 60 * 1024 * 1024 };
const CURRENCIES = ["INR", "USD", "EUR", "GBP"];

function finish(result, extra) {
  const run = { ...extra, ...result };
  run.playbook = rulePlaybook(run.segments, run.currency);
  return run;
}

export function sampleRun({ k = "auto" } = {}) {
  const t0 = performance.now();
  const { rows } = generateSample();
  const tx = normalizeRows(rows, SAMPLE_MAPPING);
  const result = runPipeline(tx, {
    k,
    ingestMs: performance.now() - t0,
    ingestStats: { columns: Object.keys(rows[0]).length, format: "Online Retail II layout", mapping: SAMPLE_MAPPING },
  });
  return finish(result, {
    name: SAMPLE_META.name,
    source: { type: "sample", label: "Sample data", rows: rows.length },
    currency: SAMPLE_META.currency,
    context: SAMPLE_META.context,
  });
}

export function csvRun({ text, filename, mapping, dateOrder, k = "auto", currency = "INR", context = "" }) {
  const t0 = performance.now();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: "greedy", dynamicTyping: false });
  const rows = parsed.data;
  if (!rows.length) throw new HttpError(422, "The file has no data rows.");
  if (rows.length > LIMITS.rows) throw new HttpError(413, `That file has ${rows.length.toLocaleString()} rows. The limit is ${LIMITS.rows.toLocaleString()}.`);
  const headers = parsed.meta.fields || [];
  const map = mapping && typeof mapping === "object" ? mapping : detectMapping(headers, rows.slice(0, 200)).mapping;
  for (const [field, col] of Object.entries(map)) {
    if (col && !headers.includes(col)) throw new HttpError(422, `Column "${col}" (mapped to ${field}) isn't in the file.`);
  }
  const errors = validateMapping(map);
  if (errors.length) throw new HttpError(422, errors.join(" "));
  const tx = normalizeRows(rows, map, dateOrder === "mdy" ? "mdy" : "dmy");
  const ingestMs = performance.now() - t0;
  let result;
  try {
    result = runPipeline(tx, {
      k,
      ingestMs,
      ingestStats: { columns: headers.length, parseErrors: parsed.errors.length, mapping: map },
    });
  } catch (err) {
    if (err instanceof PipelineError) throw new HttpError(422, err.message);
    throw err;
  }
  if (result.summary.customers > LIMITS.customers) {
    throw new HttpError(413, `Found ${result.summary.customers.toLocaleString()} customers. The limit is ${LIMITS.customers.toLocaleString()}.`);
  }
  const cleanName = String(filename || "Uploaded file").replace(/\.(csv|txt)$/i, "").slice(0, 80);
  return finish(result, {
    name: cleanName,
    source: { type: "upload", label: "Your CSV", filename: String(filename || "").slice(0, 120), rows: rows.length },
    currency: CURRENCIES.includes(currency) ? currency : "INR",
    context: String(context || "").slice(0, 400),
  });
}

export function parseK(v) {
  if (v == null || v === "" || v === "auto") return "auto";
  const n = Number(v);
  if (!Number.isInteger(n) || n < 2 || n > 8) throw new HttpError(400, "k must be 'auto' or a whole number from 2 to 8.");
  return n;
}
