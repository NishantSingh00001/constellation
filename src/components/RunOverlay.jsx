import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { fmtInt, fmtMs, fmtBytes } from "../lib/format.js";
import { Icon } from "./ui.jsx";

const STAGES = [
  { key: "upload", label: "Compress and upload", uploadOnly: true },
  { key: "ingest", label: "Ingest", hint: "Parse rows and map columns" },
  { key: "clean", label: "Clean", hint: "Drop guests, returns, duplicates" },
  { key: "features", label: "RFM features", hint: "Recency, frequency, spend per customer" },
  { key: "transform", label: "Scale", hint: "log1p → winsorise → z-score" },
  { key: "model", label: "Model selection", hint: "K-Means for k = 2 to 8, scored by silhouette" },
  { key: "label", label: "Fit and label", hint: "Final model, named segments" },
  { key: "save", label: "Save", hint: "Store the run in Netlify Blobs" },
];

function detail(key, run) {
  const st = run.stages.find((s) => s.key === key)?.stats || {};
  switch (key) {
    case "ingest": return `${fmtInt(st.rows)} rows · ${st.columns ?? "–"} columns`;
    case "clean": { const d = Object.values(st.dropped || {}).reduce((a, b) => a + b, 0); return `${fmtInt(st.rowsOut)} kept · ${fmtInt(d)} dropped`; }
    case "features": return `${fmtInt(st.customers)} customers · ${fmtInt(st.orders)} orders`;
    case "transform": return (st.steps || []).join(" → ");
    case "model": return `best silhouette at k = ${st.autoK}${st.chosenK !== st.autoK ? ` · using k = ${st.chosenK}` : ""}`;
    case "label": return (st.segments || []).join(", ");
    case "save": return `run ${run.id} · ${fmtMs(run.serverMs || 0)} on the server`;
    default: return "";
  }
}

/**
 * state: { mode: "sample"|"upload", sizes?: {raw, gz}, progress: 0..1, run?, error? }
 */
export default function RunOverlay({ state, onClose, onOpen }) {
  const stages = useMemo(() => STAGES.filter((s) => !s.uploadOnly || state.mode === "upload"), [state.mode]);
  const [active, setActive] = useState(0);
  const [revealed, setRevealed] = useState(-1);
  const uploading = state.mode === "upload" && state.progress < 1;

  // While the server works we step through the stages on an estimate; real timings replace it when the response lands.
  useEffect(() => {
    if (state.run || state.error) return undefined;
    if (uploading) { setActive(0); return undefined; }
    const firstServer = state.mode === "upload" ? 1 : 0;
    const est = state.mode === "upload" ? Math.max(1800, (state.sizes?.raw || 1e6) / 5000) : 2200;
    const step = est / (stages.length - firstServer);
    setActive((a) => Math.max(a, firstServer));
    const id = setInterval(() => setActive((a) => Math.min(a + 1, stages.length - 1)), step);
    return () => clearInterval(id);
  }, [uploading, state.run, state.error, state.mode, state.sizes, stages.length]);

  useEffect(() => {
    if (!state.run) return undefined;
    let i = -1;
    const id = setInterval(() => {
      i += 1;
      setRevealed(i);
      setActive(i + 1);
      if (i >= stages.length - 1) {
        clearInterval(id);
        setTimeout(() => onOpen(state.run.id), 900);
      }
    }, 140);
    return () => clearInterval(id);
  }, [state.run, stages.length, onOpen]);

  const done = (i) => (state.run ? i <= revealed : i < active);
  const pct = state.run ? ((revealed + 1) / stages.length) * 100 : state.error ? 100 : ((active + (uploading ? state.progress : 0.4)) / stages.length) * 100;

  return (
    <motion.div className="overlay" role="dialog" aria-modal="true" aria-labelledby="ov-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="overlay__box" initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
        <p className="eyebrow">{state.mode === "upload" ? "Your file" : "Sample data"}</p>
        <h2 id="ov-title" className="h3" style={{ fontSize: "1.7rem" }}>
          {state.error ? "The run stopped" : state.run ? "Segments ready" : "Running the pipeline"}
        </h2>
        <div style={{ marginTop: 20 }}>
          {stages.map((s, i) => {
            const isDone = done(i);
            const isActive = !isDone && i === active && !state.error;
            const isErr = state.error && i === active;
            return (
              <div key={s.key} className={`run-stage ${isDone ? "is-done" : isActive ? "is-active" : isErr ? "is-error" : "is-pending"}`}>
                <span className="run-stage__ic">{isDone ? <Icon.check /> : isErr ? <Icon.x /> : isActive ? <span className="spinner" /> : <span className="mono" style={{ fontSize: "0.7rem" }}>{i + 1}</span>}</span>
                <div style={{ minWidth: 0 }}>
                  <b>{s.label}</b>
                  <small style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.key === "upload"
                      ? `${fmtBytes(state.sizes?.raw || 0)}${state.sizes?.gz ? ` → ${fmtBytes(state.sizes.gz)} gzipped` : ""}${uploading ? ` · ${Math.round(state.progress * 100)}%` : ""}`
                      : state.run && isDone ? detail(s.key, state.run) : s.hint}
                  </small>
                </div>
                <span className="mono dim" style={{ fontSize: "0.74rem" }}>
                  {state.run && isDone && s.key !== "upload" && s.key !== "save" ? fmtMs(state.run.stages.find((x) => x.key === s.key)?.ms || 0) : isActive && s.key === "model" ? <span className="kbars">{[0, 1, 2, 3, 4, 5, 6].map((b) => <span key={b} style={{ animationDelay: `${b * 0.1}s`, height: `${40 + b * 8}%` }} />)}</span> : ""}
                </span>
              </div>
            );
          })}
        </div>
        <div className="progress"><span style={{ width: `${pct}%`, background: state.error ? "var(--bad)" : undefined }} /></div>
        {state.error && (
          <div className="stack" style={{ marginTop: 18 }}>
            <div className="notice notice--error"><Icon.x style={{ marginTop: 3, flex: "none" }} /><span>{state.error}</span></div>
            <div className="row"><button className="btn" onClick={onClose}>Back to setup</button></div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
