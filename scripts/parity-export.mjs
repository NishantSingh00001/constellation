// Writes the sample CSV and the JS pipeline's output so python/parity.py can compare them.
import { writeFileSync, mkdirSync } from "node:fs";
import { generateSample, SAMPLE_MAPPING, toCSV } from "../shared/sample.js";
import { normalizeRows } from "../shared/ingest.js";
import { runPipeline, recluster } from "../shared/pipeline.js";

const k = process.argv[2] || "auto";
const { rows } = generateSample();
mkdirSync("python/data", { recursive: true });
writeFileSync("python/data/thread-and-clay-orders.csv", toCSV(rows));
const run = runPipeline(normalizeRows(rows, SAMPLE_MAPPING), { k });
const alt = recluster(run, 5);
writeFileSync(
  "python/data/js_result.json",
  JSON.stringify({
    cleaning: run.stages.find((s) => s.key === "clean").stats.dropped,
    candidates: run.model.candidates,
    chosenK: run.model.chosenK,
    customers: { id: run.customers.id, r: run.customers.r, f: run.customers.f, m: run.customers.m, seg: run.customers.seg },
    segments: run.segments.map((s) => ({ id: s.id, name: s.name, size: s.size })),
    k5: { seg: alt.customers.seg, segments: alt.segments.map((s) => ({ id: s.id, name: s.name, size: s.size })) },
  })
);
console.log(`Wrote ${rows.length} rows; JS chose k=${run.model.chosenK}`);
