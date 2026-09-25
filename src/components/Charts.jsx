import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { fmtPct, fmtInt, fmtDays, formatMoney } from "../lib/format.js";

const ease = [0.22, 1, 0.36, 1];

function useSize(defaultW = 520) {
  const ref = useRef(null);
  const [w, setW] = useState(defaultW);
  const cb = (el) => {
    if (!el || ref.current === el) return;
    ref.current = el;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)));
    ro.observe(el);
  };
  return [cb, w];
}

function niceTicks(min, max, count = 4) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out = [];
  for (let v = lo; v <= hi + step * 0.001; v += step) out.push(+v.toFixed(10));
  return out;
}

/**
 * Line chart of one metric against k, with the chosen and auto k marked.
 * onPick(k) makes points clickable.
 */
export function KChart({ candidates, metric, label, chosenK, autoK, format = (v) => v.toFixed(3), onPick, color = "#8b9dff", betterHigh = true }) {
  const [ref, w] = useSize();
  const [hover, setHover] = useState(null);
  const h = 190, pad = { l: 44, r: 14, t: 16, b: 30 };
  const vals = candidates.map((c) => c[metric]);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const ticks = niceTicks(min - range * 0.1, max + range * 0.1, 4);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const x = (i) => pad.l + (i / Math.max(1, candidates.length - 1)) * (w - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - y0) / (y1 - y0 || 1)) * (h - pad.t - pad.b);
  const d = candidates.map((c, i) => `${i ? "L" : "M"}${x(i)},${y(c[metric])}`).join("");
  const hi = hover != null ? candidates[hover] : null;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg className="chart" width={w} height={h} role="img" aria-label={`${label} by number of segments`}>
        <g className="grid">{ticks.map((t) => <line key={t} x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} />)}</g>
        {ticks.map((t) => <text key={t} x={pad.l - 8} y={y(t) + 3} textAnchor="end">{format(t)}</text>)}
        {candidates.map((c, i) => <text key={c.k} x={x(i)} y={h - 8} textAnchor="middle" style={{ fill: c.k === chosenK ? "#eef0f7" : undefined }}>k={c.k}</text>)}
        {chosenK != null && (() => { const i = candidates.findIndex((c) => c.k === chosenK); return i >= 0 ? <rect x={x(i) - 16} y={pad.t - 6} width={32} height={h - pad.t - pad.b + 12} rx={8} fill="rgba(139,157,255,.08)" stroke="rgba(139,157,255,.25)" /> : null; })()}
        <motion.path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease }} />
        {candidates.map((c, i) => {
          const isChosen = c.k === chosenK;
          return (
            <g key={c.k}>
              <circle cx={x(i)} cy={y(c[metric])} r={isChosen ? 6 : 4.5} fill={isChosen ? color : "#0b0d17"} stroke={color} strokeWidth={2} />
              {c.k === autoK && <text x={x(i)} y={y(c[metric]) - 12} textAnchor="middle" style={{ fill: "#a6abbd" }}>auto</text>}
              <rect x={x(i) - 18} y={pad.t} width={36} height={h - pad.t - pad.b} fill="transparent" style={{ cursor: onPick ? "pointer" : "default" }}
                onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onClick={() => onPick?.(c.k)} />
            </g>
          );
        })}
      </svg>
      {hi && (
        <div className="chart-tip" style={{ left: x(hover), top: y(hi[metric]) }}>
          <b>k = {hi.k}</b> · {label} {format(hi[metric])}
          {onPick && hi.k !== chosenK && <div className="dim" style={{ fontSize: "0.72rem", marginTop: 2 }}>Click to re-fit with k = {hi.k}</div>}
          {!betterHigh && <span className="dim"> (lower is better)</span>}
        </div>
      )}
    </div>
  );
}

/** Paired horizontal bars: share of customers vs share of revenue per segment. */
export function ShareBars({ segments, currency, onHover, highlight }) {
  const max = Math.max(...segments.flatMap((s) => [s.share, s.revenueShare]));
  const [tip, setTip] = useState(null);
  return (
    <div style={{ position: "relative" }}>
      <div className="chart-legend">
        <span><i style={{ "--c": "rgba(238,240,247,.3)" }} /> Share of customers</span>
        <span><i style={{ "--c": "linear-gradient(90deg,#8b9dff,#ff9fcf)" }} /> Share of revenue (segment colour)</span>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {segments.map((s, i) => (
          <div key={s.id} onPointerEnter={() => { onHover?.(s.id); setTip(s.id); }} onPointerLeave={() => { onHover?.(null); setTip(null); }}
            style={{ display: "grid", gridTemplateColumns: "minmax(96px,150px) minmax(0,1fr)", gap: 12, alignItems: "center", opacity: highlight == null || highlight === s.id ? 1 : 0.35, transition: "opacity .3s" }}>
            <div className="heat__name" style={{ "--c": s.color }}><i /><span style={{ fontSize: "0.84rem" }}>{s.name}</span></div>
            <div style={{ display: "grid", gap: 3, position: "relative" }}>
              {[["share", "rgba(238,240,247,.28)"], ["revenueShare", s.color]].map(([key, c], j) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 9, position: "relative" }}>
                    <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.05 + j * 0.08, ease }}
                      style={{ position: "absolute", inset: 0, width: `${(s[key] / max) * 100}%`, background: c, borderRadius: "2px 4px 4px 2px", transformOrigin: "left" }} />
                  </div>
                  <span className="mono num" style={{ width: 46, textAlign: "right", fontSize: "0.74rem", color: j ? "var(--text)" : "var(--text-3)" }}>{fmtPct(s[key], 1)}</span>
                </div>
              ))}
              {tip === s.id && (
                <div className="chart-tip" style={{ left: "50%", top: 0 }}>
                  <b>{s.name}</b>: {fmtInt(s.size)} customers bring {formatMoney(s.revenue, currency)} ({fmtPct(s.revenueShare, 1)} of revenue)
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Sequential single-hue ramp (blue) for the fingerprint heatmap.
const RAMP = ["#101a33", "#13274f", "#184f95", "#256abf", "#3987e5", "#5598e7", "#86b6ef"];
function rampColor(t) {
  const i = Math.max(0, Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1))));
  return RAMP[i];
}

/** Segment fingerprints: each column scaled across segments, brighter = stronger. */
export function Heatmap({ segments, currency, highlight, onHover }) {
  const cols = useMemo(() => [
    { key: "recency", label: "Recency", get: (s) => s.avg.recency, fmt: fmtDays, invert: true, help: "avg days since last order (fewer is better)" },
    { key: "frequency", label: "Orders", get: (s) => s.avg.frequency, fmt: (v) => v.toFixed(1), help: "avg orders per customer" },
    { key: "monetary", label: "Spend", get: (s) => s.avg.monetary, fmt: (v) => formatMoney(v, currency), help: "avg lifetime spend" },
    { key: "aov", label: "AOV", get: (s) => s.avg.aov, fmt: (v) => formatMoney(v, currency), help: "average order value" },
    { key: "tenure", label: "Tenure", get: (s) => s.avg.tenure, fmt: fmtDays, help: "avg days since first order" },
  ], [currency]);
  const ranges = cols.map((c) => {
    const vals = segments.map(c.get).map((v) => Math.log1p(v));
    return [Math.min(...vals), Math.max(...vals)];
  });
  const [tip, setTip] = useState(null);
  return (
    <div className="heat" role="table" aria-label="Segment fingerprints">
      <div className="heat__row" role="row">
        <span />
        {cols.map((c) => <span key={c.key} className="heat__h" role="columnheader" title={c.help}>{c.label}</span>)}
      </div>
      {segments.map((s) => (
        <div key={s.id} className="heat__row" role="row" onPointerEnter={() => onHover?.(s.id)} onPointerLeave={() => onHover?.(null)}
          style={{ opacity: highlight == null || highlight === s.id ? 1 : 0.35, transition: "opacity .3s" }}>
          <div className="heat__name" style={{ "--c": s.color }} role="rowheader"><i /><span>{s.name}</span></div>
          {cols.map((c, ci) => {
            const [lo, hi] = ranges[ci];
            let t = (Math.log1p(c.get(s)) - lo) / (hi - lo || 1);
            if (c.invert) t = 1 - t;
            const bg = rampColor(t);
            return (
              <div key={c.key} className="heat__cell" role="cell" style={{ background: bg, color: t > 0.72 ? "#06101f" : "#dfe6ff", position: "relative" }}
                onPointerEnter={() => setTip(`${s.id}-${c.key}`)} onPointerLeave={() => setTip(null)}>
                {c.fmt(c.get(s))}
                {tip === `${s.id}-${c.key}` && <div className="chart-tip" style={{ left: "50%", top: 0 }}><b>{s.name}</b> · {c.help}: {c.fmt(c.get(s))}</div>}
              </div>
            );
          })}
        </div>
      ))}
      <div className="row dim" style={{ fontSize: "0.74rem", marginTop: 8, gap: 8 }}>
        <span>Weaker</span>
        <span style={{ display: "flex", gap: 2 }}>{RAMP.map((c) => <i key={c} style={{ width: 18, height: 8, borderRadius: 2, background: c }} />)}</span>
        <span>Stronger (scaled per column; recency inverted)</span>
      </div>
    </div>
  );
}

/** Rows dropped during cleaning, by reason. */
export function DropBars({ dropped, rowsIn }) {
  const labels = { missingCustomer: "No customer ID", badDate: "Unreadable date", returns: "Cancellations / returns", badValue: "Zero or missing value", duplicates: "Exact duplicates" };
  const entries = Object.entries(dropped);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="drops">
      {entries.map(([k, v], i) => (
        <div key={k} className="drops__row">
          <span className="muted">{labels[k] || k}</span>
          <div className="drops__bar"><motion.span initial={{ width: 0 }} whileInView={{ width: `${(v / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: i * 0.06, ease }} /></div>
          <span className="mono num" style={{ textAlign: "right", fontSize: "0.78rem" }}>{fmtInt(v)}<span className="dim"> · {fmtPct(v / rowsIn, 1)}</span></span>
        </div>
      ))}
    </div>
  );
}
