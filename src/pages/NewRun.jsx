import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Papa from "papaparse";
import RunOverlay from "../components/RunOverlay.jsx";
import { Icon, SegControl, useToast, Footer } from "../components/ui.jsx";
import { api, uploadRun, gzipBlob } from "../lib/api.js";
import { FIELDS, detectMapping, validateMapping } from "../../shared/ingest.js";
import { generateSample, toCSV } from "../../shared/sample.js";
import { fmtBytes, fmtInt } from "../lib/format.js";

const ease = [0.22, 1, 0.36, 1];
const MAX_GZ = 4.3 * 1024 * 1024; // Netlify's request limit is 6 MB (about 4.5 MB for binary uploads)
const K_OPTIONS = [{ value: "auto", label: "Auto" }, ...[3, 4, 5, 6, 7, 8].map((k) => ({ value: k, label: String(k) }))];

export default function NewRun() {
  const nav = useNavigate();
  const toast = useToast();
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // { headers, rows, estRows }
  const [mapping, setMapping] = useState({});
  const [auto, setAuto] = useState({});
  const [dateOrder, setDateOrder] = useState("dmy");
  const [k, setK] = useState("auto");
  const [currency, setCurrency] = useState("INR");
  const [context, setContext] = useState("");
  const [overlay, setOverlay] = useState(null);

  const readFile = useCallback(async (f) => {
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name) && f.type && !/csv|text/.test(f.type)) {
      toast("Please choose a .csv file.", "error");
      return;
    }
    const head = await f.slice(0, 512 * 1024).text();
    const parsed = Papa.parse(head, { header: true, skipEmptyLines: "greedy", preview: 300 });
    const headers = (parsed.meta.fields || []).filter(Boolean);
    if (headers.length < 2 || parsed.data.length === 0) {
      toast("Couldn't read columns from that file. Is it a comma-separated CSV with a header row?", "error");
      return;
    }
    const avgLine = head.length / Math.max(1, head.split("\n").length);
    const { mapping: m, dateOrder: d } = detectMapping(headers, parsed.data.slice(0, 200));
    setFile(f);
    setPreview({ headers, rows: parsed.data.slice(0, 6), estRows: Math.round(f.size / avgLine) });
    setMapping(m);
    setAuto(m);
    setDateOrder(d);
  }, [toast]);

  const onDrop = (e) => {
    e.preventDefault();
    setOver(false);
    readFile(e.dataTransfer.files?.[0]);
  };

  const downloadSample = () => {
    const { rows } = generateSample();
    const blob = new Blob([toCSV(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "thread-and-clay-orders.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const runSample = async () => {
    setOverlay({ mode: "sample", progress: 1 });
    try {
      const { run } = await api.runSample(k);
      setOverlay((o) => ({ ...o, run }));
    } catch (e) {
      setOverlay((o) => ({ ...o, error: e.message }));
    }
  };

  const errors = file ? validateMapping(mapping) : [];
  const runUpload = async () => {
    if (errors.length) return;
    setOverlay({ mode: "upload", progress: 0, sizes: { raw: file.size } });
    try {
      const { blob, gzip } = await gzipBlob(file);
      setOverlay((o) => ({ ...o, sizes: { raw: file.size, gz: gzip ? blob.size : null } }));
      if (blob.size > MAX_GZ) throw new Error(`Even compressed, this file is ${fmtBytes(blob.size)}. The upload limit is about 4 MB compressed (roughly 25–35 MB of CSV). Try filtering it to a shorter date range.`);
      const clean = Object.fromEntries(Object.entries(mapping).map(([key, v]) => [key, v || null]));
      const { run } = await uploadRun(blob, { gzip, filename: file.name, mapping: clean, dateOrder, k, currency, context }, (p) => setOverlay((o) => ({ ...o, progress: p })));
      setOverlay((o) => ({ ...o, progress: 1, run }));
    } catch (e) {
      setOverlay((o) => ({ ...o, error: e.message }));
    }
  };

  const openRun = useCallback((id) => nav(`/run/${id}`), [nav]);

  return (
    <div className="page">
      <div className="wrap" style={{ paddingBlock: "40px 80px" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
          <p className="eyebrow">New run</p>
          <h1 className="h2">Segment your <span className="serif grad-text">customers.</span></h1>
          <p className="lead" style={{ maxWidth: "58ch" }}>Use one row per order or per order line. Constellation needs a customer ID, an order date, and either an amount or quantity × price.</p>
        </motion.div>

        <div className="new-grid" style={{ marginTop: 36 }}>
          <div className="stack">
            <AnimatePresence mode="wait">
              {!file ? (
                <motion.label key="drop" className={`drop ${over ? "is-over" : ""}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5, ease }}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
                  <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
                  <span className="drop__icon"><Icon.upload /></span>
                  <h3>Drop a CSV here, or click to choose</h3>
                  <p>Up to about 30 MB. The file is compressed in your browser before it's sent.</p>
                </motion.label>
              ) : (
                <motion.div key="file" className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease }}>
                  <div className="file-card">
                    <span className="file-card__ic"><Icon.file /></span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</strong>
                      <span className="dim" style={{ fontSize: "0.82rem" }}>{fmtBytes(file.size)} · about {fmtInt(preview.estRows)} rows · {preview.headers.length} columns</span>
                    </div>
                    <button className="btn btn--ghost btn--sm" onClick={() => { setFile(null); setPreview(null); }}>Change</button>
                  </div>
                  <div className="table-wrap" style={{ marginTop: 18, maxHeight: 250 }}>
                    <table className="table">
                      <thead><tr>{preview.headers.map((h) => {
                        const field = Object.entries(mapping).find(([, v]) => v === h)?.[0];
                        return <th key={h} style={field ? { color: "var(--accent)" } : undefined}>{h}{field ? ` · ${FIELDS.find((f) => f.key === field)?.label}` : ""}</th>;
                      })}</tr></thead>
                      <tbody>{preview.rows.map((r, i) => <tr key={i}>{preview.headers.map((h) => <td key={h} className="muted">{String(r[h] ?? "")}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {file && (
              <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease }}>
                <div className="panel-title"><div><h3>Column mapping</h3><p>Detected automatically. Green borders are auto-detected; change anything that's wrong.</p></div></div>
                <div className="map-grid">
                  {FIELDS.map((f) => (
                    <label key={f.key} className="field">
                      <span>{f.label}{f.required ? " *" : ""} <small>· {f.hint}</small></span>
                      <select className={`select ${mapping[f.key] && mapping[f.key] === auto[f.key] ? "is-auto" : ""}`} value={mapping[f.key] || ""} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || null }))}>
                        <option value="">{f.required ? "Choose a column" : "Not in this file"}</option>
                        {preview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </label>
                  ))}
                  <div className="field">
                    <span>Dates like 03/04/2025 mean</span>
                    <SegControl label="date-order" value={dateOrder} onChange={setDateOrder} options={[{ value: "dmy", label: "3 April" }, { value: "mdy", label: "4 March" }]} />
                  </div>
                </div>
                {errors.length > 0 && <div className="notice" style={{ marginTop: 16 }}>{errors.join(" ")}</div>}
              </motion.div>
            )}
          </div>

          <div className="stack" style={{ position: "sticky", top: "calc(var(--nav-h) + 20px)" }}>
            <div className="card">
              <div className="panel-title"><div><h3>Model settings</h3><p>Auto picks k by silhouette score.</p></div></div>
              <div className="stack">
                <div className="field"><span>Number of segments (k)</span><SegControl label="k" value={k} onChange={setK} options={K_OPTIONS} /></div>
                <label className="field"><span>Currency</span>
                  <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="INR">₹ Indian rupee</option><option value="USD">$ US dollar</option><option value="EUR">€ Euro</option><option value="GBP">£ British pound</option>
                  </select>
                </label>
                <label className="field"><span>About the business (for the AI playbook)</span>
                  <textarea className="textarea" value={context} onChange={(e) => setContext(e.target.value)} maxLength={400} placeholder="e.g. Online bakery in Pune; most customers order on weekends" />
                </label>
                <button className="btn btn--lg" disabled={!file || errors.length > 0} onClick={runUpload}>Run on my file <span className="arrow">→</span></button>
              </div>
            </div>
            <div className="card spot">
              <div className="panel-title"><div><h3>No file handy?</h3><p>Two years of orders from a made-up Indian home-decor brand: 10,480 customers, 116,670 rows, in the UCI Online Retail II column layout, including returns, guest orders and duplicates.</p></div></div>
              <div className="row">
                <button className="btn btn--ghost" onClick={runSample}>Run on sample data <span className="arrow">→</span></button>
                <button className="btn btn--ghost btn--sm" onClick={downloadSample}><Icon.download /> Sample CSV (9 MB)</button>
              </div>
            </div>
            <p className="dim" style={{ fontSize: "0.78rem", margin: "4px 4px 0" }}>Only people with the link can open an uploaded run. Uploads are deleted automatically after 30 days, and you can delete one sooner from its page.</p>
          </div>
        </div>
      </div>
      <Footer />
      <AnimatePresence>{overlay && <RunOverlay state={overlay} onClose={() => setOverlay(null)} onOpen={openRun} />}</AnimatePresence>
    </div>
  );
}
