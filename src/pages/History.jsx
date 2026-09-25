import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../lib/api.js";
import { myRuns } from "../lib/storage.js";
import { Footer } from "../components/ui.jsx";
import { fmtInt, formatMoney, timeAgo } from "../lib/format.js";

const ease = [0.22, 1, 0.36, 1];

function RunCard({ r, i, badge }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: i * 0.05, ease }}>
      <Link to={`/run/${r.id}`} className="card spot card--lift hcard">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="chip">{badge || r.source?.label}</span>
          <span className="dim mono" style={{ fontSize: "0.72rem" }}>{timeAgo(r.updatedAt || r.createdAt)}</span>
        </div>
        <h3>{r.name}</h3>
        <div className="stackbar" aria-hidden="true">{r.segments.map((s, j) => <span key={j} style={{ "--c": s.color, flexGrow: s.share }} />)}</div>
        <div className="row dim" style={{ fontSize: "0.84rem", marginTop: "auto" }}>
          <span>{fmtInt(r.customers)} customers</span><span>·</span><span>{r.k} segments</span><span>·</span><span>{formatMoney(r.revenue, r.currency)}</span>
        </div>
      </Link>
    </motion.div>
  );
}

export default function History() {
  const [runs, setRuns] = useState(null);
  const [demo, setDemo] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    const ids = myRuns().map((r) => r.id);
    (ids.length ? api.listRuns(ids) : Promise.resolve({ runs: [] }))
      .then((d) => setRuns(ids.map((id) => d.runs.find((r) => r.id === id)).filter(Boolean)))
      .catch((e) => setErr(e.message));
    api.listRuns(["demo"]).then((d) => setDemo(d.runs[0] || null)).catch(() => {});
  }, []);
  return (
    <div className="page">
      <div className="wrap" style={{ paddingBlock: "40px 80px" }}>
        <p className="eyebrow">Your runs</p>
        <h1 className="h2">Runs from <span className="serif grad-text">this browser.</span></h1>
        <p className="lead">Runs are stored in the app's database; this browser remembers which ones you created, so only you can re-fit or delete them.</p>
        <div className="history" style={{ marginTop: 36 }}>
          {runs === null && !err && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 200 }} />)}
          {runs?.map((r, i) => <RunCard key={r.id} r={r} i={i} />)}
          {demo && <RunCard r={demo} i={runs?.length || 0} badge="Live demo" />}
          {runs && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <Link to="/new" className="card spot card--lift hcard" style={{ justifyContent: "center", alignItems: "center", textAlign: "center", borderStyle: "dashed" }}>
                <span style={{ fontSize: "2rem", lineHeight: 1 }}>+</span>
                <h3>New run</h3>
                <span className="dim" style={{ fontSize: "0.84rem" }}>Upload a CSV or use the sample data</span>
              </Link>
            </motion.div>
          )}
        </div>
        {err && <div className="notice notice--error" style={{ marginTop: 20 }}>{err}</div>}
        {runs && runs.length === 0 && <p className="dim" style={{ marginTop: 20 }}>You haven't started a run in this browser yet.</p>}
      </div>
      <Footer />
    </div>
  );
}
