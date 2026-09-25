import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api.js";
import { fmtInt, fmtPct, fmtDays, formatMoney } from "../lib/format.js";
import { Icon, useToast } from "./ui.jsx";

const ease = [0.22, 1, 0.36, 1];

export function Legend({ segments, highlight, hidden, onHover, onToggle }) {
  return (
    <div className="legend">
      {segments.map((s) => (
        <button key={s.id} type="button" style={{ "--c": s.color }} className={`${highlight === s.id ? "on" : ""} ${hidden.has(s.id) ? "off" : ""}`}
          onPointerEnter={() => onHover(s.id)} onPointerLeave={() => onHover(null)} onFocus={() => onHover(s.id)} onBlur={() => onHover(null)}
          onClick={() => onToggle(s.id)} aria-pressed={!hidden.has(s.id)} title={hidden.has(s.id) ? "Show segment" : "Hide segment"}>
          <i />
          <span style={{ minWidth: 0 }}>
            <strong>{s.name}</strong>
            <small>{fmtInt(s.size)} customers</small>
            <div className="bar"><span style={{ width: `${s.share * 100}%` }} /></div>
          </span>
          <span className="v">{fmtPct(s.share, 1)}</span>
        </button>
      ))}
    </div>
  );
}

export function SegmentCards({ segments, currency, onHover, onOpen }) {
  return (
    <div className="segs">
      {segments.map((s, i) => (
        <motion.article key={`${s.id}-${s.name}`} className="card spot card--lift seg" style={{ "--c": s.color }}
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.8, delay: (i % 4) * 0.07, ease }}
          onPointerEnter={() => onHover(s.id)} onPointerLeave={() => onHover(null)} onClick={() => onOpen(s.id)}
          tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(s.id)} aria-label={`${s.name}: show these customers`}>
          <span className="seg__glow" />
          <div className="seg__name"><i />{s.name}</div>
          <div className="seg__share"><b>{fmtPct(s.revenueShare, 0)}</b><span className="muted" style={{ fontSize: "0.84rem" }}>of revenue from {fmtPct(s.share, 0)} of customers</span></div>
          <p className="seg__blurb">{s.description}</p>
          <dl className="seg__stats">
            <div><dt>Last order</dt><dd>{fmtDays(s.avg.recency)} ago</dd></div>
            <div><dt>Orders</dt><dd>{s.avg.frequency.toFixed(1)}</dd></div>
            <div><dt>Spend</dt><dd>{formatMoney(s.avg.monetary, currency)}</dd></div>
          </dl>
          {s.topLocations?.length > 0 && <div className="dim" style={{ fontSize: "0.76rem" }}>Top: {s.topLocations.map((l) => l.name).join(" · ")}</div>}
        </motion.article>
      ))}
    </div>
  );
}

function Notif({ color, subject, preview, brand }) {
  return (
    <div className="notif" style={{ "--c": color }}>
      <span className="notif__app"><Icon.spark style={{ color: "#fff" }} /></span>
      <div style={{ minWidth: 0 }}>
        <small>now</small>
        <b>{brand} · {subject}</b>
        <span>{preview}</span>
      </div>
    </div>
  );
}

export function Playbook({ run, owner, onUpdate, aiEnabled }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState(run.context || "");
  const pb = run.playbook;
  const brand = run.source?.type === "sample" ? "Thread & Clay" : "Your brand";
  const canGenerate = aiEnabled && (owner || (run.demo && pb.source !== "gemini"));
  const generate = async () => {
    setBusy(true);
    try {
      const { playbook } = await api.playbook(run.id, context);
      onUpdate({ ...run, playbook, context });
      toast("Playbook written with Gemini", "ok");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card" aria-labelledby="pb-title" style={{ padding: "clamp(22px,3vw,36px)" }}>
      <div className="pb-head">
        <div>
          <p className="eyebrow">Marketing playbook</p>
          <h2 id="pb-title" className="h2" style={{ fontSize: "clamp(1.7rem,3vw,2.4rem)" }}>What to do with <span className="serif grad-text">each segment</span></h2>
        </div>
        <div className="row">
          {pb.source === "gemini"
            ? <span className="chip chip--ai"><Icon.spark /> Written by {pb.model}</span>
            : <span className="chip">Rule-based playbook</span>}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={pb.generatedAt} className="pb-summary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease }}>
          {pb.summary}
        </motion.p>
      </AnimatePresence>

      {(owner || canGenerate) && (
        <div className="card" style={{ marginTop: 22, padding: 16, background: "rgba(196,155,255,.05)", borderColor: "rgba(196,155,255,.2)" }}>
          {aiEnabled ? (
            <div className="row" style={{ alignItems: "flex-end" }}>
              <label className="field" style={{ flex: "1 1 320px" }}>
                <span>Describe the business so the playbook fits (optional)</span>
                <input className="input" value={context} maxLength={400} onChange={(e) => setContext(e.target.value)} placeholder="e.g. D2C skincare brand in India, most orders via Instagram" disabled={!owner} />
              </label>
              <button className="btn btn--grad" onClick={generate} disabled={busy || !canGenerate}>
                {busy ? <><span className="spinner" style={{ borderTopColor: "#0b0b14" }} /> Writing…</> : <><Icon.spark /> {pb.source === "gemini" ? "Rewrite with Gemini" : "Write with Gemini"}</>}
              </button>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>AI isn't configured on this deployment, so these plays come from rules for each segment type. Add a <span className="mono">GEMINI_API_KEY</span> in Netlify to have Gemini write a playbook from your numbers.</p>
          )}
        </div>
      )}

      <div className="pb-grid">
        {pb.segments.map((p, i) => {
          const s = run.segments.find((x) => x.id === p.id);
          if (!s) return null;
          return (
            <motion.article key={`${pb.generatedAt}-${p.id}`} className="card spot pb" style={{ "--c": s.color }}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: (i % 2) * 0.08, ease }}>
              <div className="pb__top">
                <div>
                  <div className="pb__persona" style={{ display: "flex", alignItems: "center", gap: 8 }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, boxShadow: `0 0 10px ${s.color}` }} />{s.name} · {fmtInt(s.size)}</div>
                  <h4>{p.persona !== s.name ? `${p.persona}: ` : ""}{p.headline}</h4>
                </div>
                <span className={`prio prio--${p.priority}`}>{p.priority}</span>
              </div>
              <p className="pb__insight">{p.insight}</p>
              <ol className="pb__actions">
                {p.actions.map((a) => <li key={a.title}><div><b>{a.title}</b><span>{a.detail}</span></div></li>)}
              </ol>
              <Notif color={s.color} subject={p.message.subject} preview={p.message.preview} brand={brand} />
              <dl className="pb__meta">
                <div><dt>Channel</dt><dd>{p.channel}</dd></div>
                <div><dt>Offer</dt><dd>{p.offer}</dd></div>
                <div><dt>Measure</dt><dd>{p.kpi}</dd></div>
              </dl>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

const SUGGESTIONS = [
  "Which segment should I focus on this month, and why?",
  "How much revenue is at risk from customers going quiet?",
  "What's different about Champions compared to Loyal Customers?",
  "Draft a WhatsApp message for the At Risk group.",
];

export function Ask({ run, owner, aiEnabled }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [thread, setThread] = useState(() => (owner ? run.qa || [] : []));
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { if (thread.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [thread.length, busy]);
  const names = new Set(run.segments.map((s) => s.name));
  const sugg = SUGGESTIONS.filter((s) => !/Champions|Loyal|At Risk/.test(s) || [...names].some((n) => s.includes(n))).slice(0, 3);
  const ask = async (text) => {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    setQ("");
    setThread((t) => [...t, { q: question, pending: true }]);
    setBusy(true);
    try {
      const entry = await api.ask(run.id, question);
      setThread((t) => [...t.slice(0, -1), entry]);
    } catch (e) {
      setThread((t) => t.slice(0, -1));
      toast(e.message, "error");
      setQ(question);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card" style={{ padding: "clamp(22px,3vw,32px)" }} aria-labelledby="ask-title">
      <div className="panel-title">
        <div><h3 id="ask-title">Ask about this run</h3><p>Gemini answers from this run's segment numbers only.</p></div>
        {!aiEnabled && <span className="chip">AI off</span>}
      </div>
      <div className="ask">
        {thread.length > 0 && (
          <div className="qa">
            {thread.map((m, i) => (
              <div key={i} style={{ display: "grid", gap: 10 }}>
                <motion.div className="qa__q" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{m.q}</motion.div>
                {m.pending ? <div className="typing"><i /><i /><i /></div> : (
                  <motion.div className="qa__a" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
                    {m.a}<small>{m.model}</small>
                  </motion.div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
        {aiEnabled ? (
          <>
            <form className="ask__form" onSubmit={(e) => { e.preventDefault(); ask(); }}>
              <Icon.spark />
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question about your customers…" maxLength={500} aria-label="Question" />
              <button className="btn" type="submit" disabled={busy || q.trim().length < 3} style={{ height: 50 }}><Icon.send /></button>
            </form>
            {thread.length === 0 && <div className="ask__sugg">{sugg.map((s) => <button key={s} type="button" onClick={() => ask(s)}>{s}</button>)}</div>}
          </>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>Add a <span className="mono">GEMINI_API_KEY</span> environment variable in Netlify to turn on questions.</p>
        )}
      </div>
    </section>
  );
}

const PAGE = 25;
export function CustomerTable({ run, filterSeg, setFilterSeg, selected }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "m", dir: -1 });
  const [page, setPage] = useState(0);
  const c = run.customers;
  const rows = useMemo(() => {
    const idx = [];
    const qq = query.trim().toLowerCase();
    for (let i = 0; i < c.id.length; i++) {
      if (filterSeg != null && c.seg[i] !== filterSeg) continue;
      if (qq && !String(c.id[i]).toLowerCase().includes(qq)) continue;
      idx.push(i);
    }
    const col = sort.key === "aov" ? c.m.map((m, i) => m / c.f[i]) : c[sort.key];
    idx.sort((a, b) => (col[a] > col[b] ? 1 : col[a] < col[b] ? -1 : 0) * sort.dir);
    return idx;
  }, [c, filterSeg, query, sort]);
  useEffect(() => setPage(0), [filterSeg, query, sort]);
  useEffect(() => {
    if (selected == null) return;
    const pos = rows.indexOf(selected);
    if (pos >= 0) setPage(Math.floor(pos / PAGE));
  }, [selected, rows]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);
  const head = (key, label, r) => (
    <th className={r ? "r" : ""} aria-sort={sort.key === key ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))}>{label}{sort.key === key ? (sort.dir > 0 ? " ↑" : " ↓") : ""}</button>
    </th>
  );
  return (
    <section className="card" style={{ padding: "clamp(18px,2.5vw,28px)" }} id="customers" aria-labelledby="cust-title">
      <div className="panel-title">
        <div><h3 id="cust-title">Customers</h3><p>{fmtInt(rows.length)} shown · click a star in the map to find it here</p></div>
        <a className="btn btn--ghost btn--sm" href={api.exportUrl(run.id)} download><Icon.download /> Export all as CSV</a>
      </div>
      <div className="filters">
        <input className="input" placeholder="Search customer ID" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search customer ID" />
        <select className="select" value={filterSeg ?? ""} onChange={(e) => setFilterSeg(e.target.value === "" ? null : Number(e.target.value))} aria-label="Filter by segment">
          <option value="">All segments</option>
          {run.segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="table-wrap" style={{ maxHeight: 520 }}>
        <table className="table">
          <thead><tr>
            {head("id", "Customer")}
            <th>Segment</th>
            {head("r", "Last order", true)}
            {head("f", "Orders", true)}
            {head("m", "Spend", true)}
            {head("aov", "AOV", true)}
            {head("t", "Customer for", true)}
            <th>Location</th>
          </tr></thead>
          <tbody>
            {view.map((i) => {
              const s = run.segments[c.seg[i]];
              return (
                <tr key={c.id[i]} style={selected === i ? { background: "rgba(139,157,255,.12)" } : undefined}>
                  <td className="mono">{c.id[i]}</td>
                  <td><span className="chip" style={{ "--c": s.color }}><i />{s.name}</span></td>
                  <td className="r">{c.r[i]} d</td>
                  <td className="r">{c.f[i]}</td>
                  <td className="r">{formatMoney(c.m[i], run.currency)}</td>
                  <td className="r">{formatMoney(c.m[i] / c.f[i], run.currency)}</td>
                  <td className="r">{fmtDays(c.t[i])}</td>
                  <td className="muted">{c.loc[i] >= 0 ? run.locations[c.loc[i]] : "–"}</td>
                </tr>
              );
            })}
            {view.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: "center", padding: 28 }}>No customers match.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span>Page {page + 1} of {pages}</span>
        <div className="row">
          <button className="btn btn--ghost btn--sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <button className="btn btn--ghost btn--sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      </div>
    </section>
  );
}
