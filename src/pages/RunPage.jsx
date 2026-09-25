import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Space from "../components/Space.jsx";
import { KChart, ShareBars, Heatmap, DropBars } from "../components/Charts.jsx";
import { Legend, SegmentCards, Playbook, Ask, CustomerTable } from "../components/RunParts.jsx";
import { CountUp, Footer, Icon, useToast } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { positionsFromColumns } from "../../shared/pipeline.js";
import { fmtInt, fmtPct, fmtDate, fmtMs, fmtDays, formatMoney, timeAgo } from "../lib/format.js";

const ease = [0.22, 1, 0.36, 1];

function Skeleton() {
  return (
    <div className="wrap" style={{ paddingBlock: 32 }}>
      <div className="skeleton" style={{ height: 22, width: 160 }} />
      <div className="skeleton" style={{ height: 44, width: "min(520px,90%)", marginTop: 14 }} />
      <div className="kpis" style={{ marginTop: 28 }}>{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 104 }} />)}</div>
      <div className="grid-main"><div className="skeleton" style={{ height: 560 }} /><div className="skeleton" style={{ height: 560 }} /></div>
    </div>
  );
}

export default function RunPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [run, setRun] = useState(null);
  const [owner, setOwner] = useState(false);
  const [error, setError] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [highlight, setHighlight] = useState(null);
  const [hidden, setHidden] = useState(() => new Set());
  const [filterSeg, setFilterSeg] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [tipPos, setTipPos] = useState(null);
  const [selected, setSelected] = useState(null);
  const [refitting, setRefitting] = useState(false);

  useEffect(() => {
    let alive = true;
    setRun(null);
    setError(null);
    api.getRun(id).then((d) => { if (alive) { setRun(d.run); setOwner(d.owner); } }).catch((e) => alive && setError(e));
    api.health().then((h) => alive && setAiEnabled(Boolean(h.ai?.enabled))).catch(() => {});
    return () => { alive = false; };
  }, [id]);

  useEffect(() => { if (run) document.title = `${run.name} · Constellation`; }, [run]);

  const positions = useMemo(() => (run ? positionsFromColumns(run.customers, run.model.scaler) : null), [run?.customers, run?.model.scaler]);
  const colors = useMemo(() => run?.segments.map((s) => s.color), [run?.segments]);
  const labels = useMemo(() => run?.segments.map((s) => s.name), [run?.segments]);

  const onHover = useCallback((i, p) => { setHoverIdx(i); setTipPos(p); }, []);
  const onSelect = useCallback((i) => {
    setSelected(i);
    setFilterSeg(null);
    document.getElementById("customers")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const toggle = (sid) => setHidden((h) => { const n = new Set(h); n.has(sid) ? n.delete(sid) : n.add(sid); return n; });
  const openSeg = (sid) => { setFilterSeg(sid); document.getElementById("customers")?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  const refit = async (k) => {
    if (!owner) { toast("This is a shared, read-only run. Start your own run to change k.", "info"); return; }
    if (k === run.model.chosenK || refitting) return;
    setRefitting(true);
    try {
      const d = await api.recluster(run.id, k);
      setHidden(new Set());
      setHighlight(null);
      setFilterSeg(null);
      setSelected(null);
      setRun(d.run);
      toast(`Re-fitted with k = ${k}`, "ok");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setRefitting(false);
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Link copied. Anyone with it can view this run.", "ok");
    } catch {
      toast(window.location.href, "info");
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this run for everyone with the link? This can't be undone.")) return;
    try {
      await api.remove(run.id);
      toast("Run deleted", "ok");
      nav("/runs");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const copyDemo = async () => {
    try {
      toast("Running the sample data for you…", "info");
      const d = await api.runSample();
      nav(`/run/${d.run.id}`);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  if (error) {
    return (
      <div className="page"><div className="wrap" style={{ paddingBlock: "80px" }}>
        <p className="eyebrow">Run {id}</p>
        <h1 className="h2">{error.status === 410 ? "This run doesn't exist anymore." : "Couldn't load this run."}</h1>
        <p className="lead">{error.message}</p>
        <div className="hero__cta"><Link className="btn" to="/new">Start a new run</Link><Link className="btn btn--ghost" to="/run/demo">Open the demo</Link></div>
      </div></div>
    );
  }
  if (!run) return <div className="page"><Skeleton /></div>;

  const s = run.summary;
  const cleanStage = run.stages.find((x) => x.key === "clean");
  const hov = hoverIdx != null ? { i: hoverIdx, seg: run.segments[run.customers.seg[hoverIdx]] } : null;
  const c = run.customers;
  const serverTotal = run.stages.reduce((a, x) => a + x.ms, 0);

  return (
    <div className="page">
      <div className="orbit-bg" />
      <div className="wrap">
        <motion.div className="run-head" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}>
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="chip">{run.source.label}</span>
              {run.demo && <span className="chip chip--good"><span className="pulse-dot" /> Live demo</span>}
              {!owner && !run.demo && <span className="chip">Shared · read-only</span>}
              <span className="chip">{fmtDate(s.dateRange[0])} – {fmtDate(s.dateRange[1])}</span>
            </div>
            <h1>{run.name}</h1>
            <p className="dim" style={{ margin: "6px 0 0", fontSize: "0.84rem" }}>Run {run.id} · updated {timeAgo(run.updatedAt || run.createdAt)} · pipeline {fmtMs(serverTotal)}</p>
          </div>
          <div className="row">
            {run.demo && <button className="btn btn--ghost btn--sm" onClick={copyDemo}>Make my own copy</button>}
            <button className="btn btn--ghost btn--sm" onClick={share}><Icon.link /> Share</button>
            <a className="btn btn--ghost btn--sm" href={api.exportUrl(run.id)} download><Icon.download /> CSV</a>
            {owner && <button className="btn btn--ghost btn--sm btn--danger" onClick={remove}><Icon.trash /> Delete</button>}
            <Link className="btn btn--sm" to="/new">New run <span className="arrow">→</span></Link>
          </div>
        </motion.div>

        <div className="kpis">
          {[
            { k: "Customers", v: <CountUp value={s.customers} />, sub: `${fmtInt(s.rowsClean)} clean rows of ${fmtInt(s.rows)}` },
            { k: "Revenue", v: <CountUp value={s.revenue} format={(x) => formatMoney(x, run.currency)} />, sub: `${fmtInt(s.orders)} orders` },
            { k: "Avg order value", v: <CountUp value={s.aov} format={(x) => formatMoney(x, run.currency)} />, sub: `${(s.orders / s.customers).toFixed(1)} orders per customer` },
            { k: "Segments", v: <CountUp value={s.k} />, sub: s.k === run.model.autoK ? "chosen by silhouette" : `auto suggested ${run.model.autoK}` },
            { k: "Silhouette", v: <CountUp value={s.silhouette} format={(x) => x.toFixed(3)} />, sub: s.silhouette > 0.5 ? "strong separation" : s.silhouette > 0.25 ? "reasonable separation" : "weak separation" },
          ].map((x, i) => (
            <motion.div key={x.k} className="card spot kpi" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05 * i, ease }}>
              <div className="kicker">{x.k}</div>
              <div className="kpi__v">{x.v}</div>
              <div className="kpi__s">{x.sub}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid-main">
          <motion.div className="card space-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
            <div className="space-card__head">
              <div>
                <div className="kicker">Customer map</div>
                <div style={{ fontWeight: 600, marginTop: 6, letterSpacing: "-0.02em" }}>Each star is a customer</div>
              </div>
              {refitting && <span className="chip chip--ai"><span className="spinner" /> Re-fitting</span>}
            </div>
            <Space key={`${run.id}-${run.summary.k}-${run.updatedAt}`} positions={positions} seg={c.seg} colors={colors} labels={labels} highlight={highlight} hidden={hidden} onHover={onHover} onSelect={onSelect} />
            <AnimatePresence>
              {hov && tipPos && (
                <motion.div className="tip" style={{ left: Math.min(tipPos.x, 9999), top: tipPos.y + 0 }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <div className="tip__t" style={{ "--c": hov.seg.color }}><i />{hov.seg.name}</div>
                  <dl>
                    <dt>Customer</dt><dd className="mono">{c.id[hov.i]}</dd>
                    <dt>Last order</dt><dd>{c.r[hov.i]} days ago</dd>
                    <dt>Orders</dt><dd>{c.f[hov.i]}</dd>
                    <dt>Spend</dt><dd>{formatMoney(c.m[hov.i], run.currency)}</dd>
                    {c.loc[hov.i] >= 0 && <><dt>Location</dt><dd>{run.locations[c.loc[hov.i]]}</dd></>}
                  </dl>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="space__foot"><span>Drag to rotate · scroll to zoom · click a star</span><span>{fmtInt(s.customers)} customers</span></div>
          </motion.div>
          <motion.div className="card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.15, ease }}>
            <div className="panel-title"><div><h3>Segments</h3><p>Hover to highlight in the map · click to show or hide</p></div></div>
            <Legend segments={run.segments} highlight={highlight} hidden={hidden} onHover={setHighlight} onToggle={toggle} />
          </motion.div>
        </div>

        <SegmentCards segments={run.segments} currency={run.currency} onHover={setHighlight} onOpen={openSeg} />

        <div className="grid-2">
          <section className="card">
            <div className="panel-title"><div><h3>Where revenue comes from</h3><p>Share of customers vs share of revenue</p></div></div>
            <ShareBars segments={run.segments} currency={run.currency} onHover={setHighlight} highlight={highlight} />
          </section>
          <section className="card">
            <div className="panel-title"><div><h3>Segment fingerprints</h3><p>Average per customer in each segment</p></div></div>
            <Heatmap segments={run.segments} currency={run.currency} onHover={setHighlight} highlight={highlight} />
          </section>
        </div>

        <div className="grid-2">
          <section className="card">
            <div className="panel-title">
              <div><h3>Choosing k</h3><p>Silhouette score by number of segments (higher is better){owner ? " · click a point to re-fit" : ""}</p></div>
              <span className="chip">k = {s.k}</span>
            </div>
            <KChart candidates={run.model.candidates} metric="silhouette" label="silhouette" chosenK={s.k} autoK={run.model.autoK} onPick={owner ? refit : undefined} />
            <div className="panel-title" style={{ marginTop: 18, marginBottom: 8 }}><div><h3 style={{ fontSize: "0.92rem" }}>Inertia (elbow)</h3><p>Within-cluster sum of squares; always falls as k grows</p></div></div>
            <KChart candidates={run.model.candidates} metric="inertia" label="inertia" chosenK={s.k} autoK={run.model.autoK} format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0))} color="#c49bff" onPick={owner ? refit : undefined} betterHigh={false} />
          </section>
          <section className="card">
            <div className="panel-title"><div><h3>Pipeline log</h3><p>What ran on the server, and how long it took</p></div></div>
            <div className="stages">
              {run.stages.map((st, i) => (
                <div key={st.key} className="stage-row">
                  <span className="stage-ic">{i + 1}</span>
                  <div>
                    <b style={{ fontWeight: 500 }}>{st.label}</b>
                    <small>
                      {st.key === "ingest" && `${fmtInt(st.stats.rows)} rows read`}
                      {st.key === "clean" && `${fmtInt(st.stats.rowsOut)} rows kept`}
                      {st.key === "features" && `${fmtInt(st.stats.customers)} customers, median ${fmtDays(st.stats.recency.median)} since last order`}
                      {st.key === "transform" && st.stats.steps.join(" → ")}
                      {st.key === "model" && `k = ${st.stats.tried[0]}–${st.stats.tried[st.stats.tried.length - 1]} tried, best at k = ${st.stats.autoK}`}
                      {st.key === "label" && `${run.model.algorithm}`}
                    </small>
                  </div>
                  <span className="mono dim" style={{ fontSize: "0.76rem" }}>{fmtMs(st.ms)}</span>
                </div>
              ))}
            </div>
            <div className="panel-title" style={{ marginTop: 18, marginBottom: 6 }}><div><h3 style={{ fontSize: "0.92rem" }}>Rows removed while cleaning</h3></div></div>
            <DropBars dropped={cleanStage.stats.dropped} rowsIn={cleanStage.stats.rowsIn} />
            <div className="dim" style={{ fontSize: "0.76rem", marginTop: 14 }}>Calinski–Harabasz {run.model.candidates.find((x) => x.k === s.k)?.calinskiHarabasz} · Davies–Bouldin {run.model.candidates.find((x) => x.k === s.k)?.daviesBouldin} · seed {run.model.seed}</div>
          </section>
        </div>

        <div style={{ marginTop: 12 }}>
          <Playbook run={run} owner={owner} aiEnabled={aiEnabled} onUpdate={setRun} />
        </div>
        <div className="grid-2">
          <Ask key={run.id + run.summary.k} run={run} owner={owner} aiEnabled={aiEnabled} />
          <section className="card" style={{ padding: "clamp(22px,3vw,32px)" }}>
            <div className="panel-title"><div><h3>What the numbers say</h3><p>Computed from this run</p></div></div>
            <Insights run={run} />
          </section>
        </div>
        <div style={{ marginTop: 12, marginBottom: 80 }}>
          <CustomerTable run={run} filterSeg={filterSeg} setFilterSeg={setFilterSeg} selected={selected} />
        </div>
      </div>
      <Footer />
    </div>
  );
}

/** A few deterministic facts, so the page is useful without AI. */
function Insights({ run }) {
  const segs = run.segments;
  const cur = run.currency;
  const byRev = [...segs].sort((a, b) => b.revenueShare - a.revenueShare);
  const top2 = byRev.slice(0, 2);
  const topShare = top2.reduce((a, s) => a + s.share, 0);
  const topRev = top2.reduce((a, s) => a + s.revenueShare, 0);
  const quiet = segs.filter((s) => s.avg.recency > 120 && s.avg.frequency >= 3);
  const quietRev = quiet.reduce((a, s) => a + s.revenue, 0);
  const oneTimers = run.customers.f.filter((f) => f === 1).length / run.customers.f.length;
  const best = byRev[0];
  const items = [
    `${top2.map((s) => s.name).join(" and ")} are ${fmtPct(topShare, 0)} of customers but bring in ${fmtPct(topRev, 0)} of revenue.`,
    quiet.length ? `${quiet.map((s) => s.name).join(" and ")} used to order regularly but average ${fmtDays(Math.round(quiet.reduce((a, s) => a + s.avg.recency * s.size, 0) / quiet.reduce((a, s) => a + s.size, 0)))} since their last order. They account for ${formatMoney(quietRev, cur)} of past revenue.` : "No high-frequency segment has gone quiet for more than four months.",
    `${fmtPct(oneTimers, 0)} of customers have ordered only once. Getting a second order is usually the cheapest growth.`,
    `An average ${best.name} customer has spent ${formatMoney(best.avg.monetary, cur)}, about ${Math.round(best.avg.monetary / (run.summary.revenue / run.summary.customers))}× the overall average.`,
  ];
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14 }}>
      {items.map((t, i) => (
        <motion.li key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.08, ease }}
          style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", gap: 10, fontSize: "0.92rem" }}>
          <span className="mono dim" style={{ fontSize: "0.74rem", paddingTop: 3 }}>0{i + 1}</span><span>{t}</span>
        </motion.li>
      ))}
    </ul>
  );
}
