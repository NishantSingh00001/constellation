import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Space, { heroData } from "../components/Space.jsx";
import { Reveal, CountUp, Footer, Icon, REPO_URL } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { PALETTE } from "../../shared/pipeline.js";

const ease = [0.22, 1, 0.36, 1];

const STEPS = [
  { n: "01", t: "Clean", d: "Drops guest checkouts, cancellations, zero-value lines and exact duplicates, and tells you how many of each.", bars: [9, 7, 8, 3, 6, 2, 7, 1], c: "#6f7590" },
  { n: "02", t: "Score", d: "Turns orders into one row per customer: days since last order, number of orders, total spend.", bars: [3, 5, 8, 6, 4, 7, 5, 6], c: "#3987e5" },
  { n: "03", t: "Scale", d: "log1p for the long tail, winsorised at 0.5% and 99.5%, then z-scored so no feature dominates.", bars: [4, 5, 6, 7, 7, 6, 5, 4], c: "#199e70" },
  { n: "04", t: "Cluster", d: "K-Means with k-means++ and 10 restarts for k = 2 to 8. Silhouette score picks k.", bars: [5, 8, 7, 6, 6, 5, 5, 4], c: "#c98500" },
  { n: "05", t: "Act", d: "Each cluster gets a name from its RFM profile and a playbook, written by Gemini when a key is set.", bars: [8, 7, 6, 5, 4, 3, 2, 2], c: "#d55181" },
];

const NOTIFS = [
  { c: "#3987e5", s: "Champions", t: "You're first in line", p: "Our festive collection opens to you two days early." },
  { c: "#9085e9", s: "At Risk", t: "We miss you", p: "Here's a welcome-back credit on your next order." },
  { c: "#199e70", s: "New Customers", t: "Welcome to the family", p: "How to care for your new piece, plus a little something." },
];

export default function Landing() {
  const hero = useMemo(() => heroData(typeof window !== "undefined" && window.innerWidth < 700 ? 1500 : 2800, PALETTE), []);
  const [totals, setTotals] = useState(null);
  useEffect(() => { api.health().then((h) => setTotals(h.totals)).catch(() => {}); }, []);

  return (
    <div>
      <section className="hero">
        <Space className="hero__canvas" mode="hero" positions={hero.positions} seg={hero.seg} colors={hero.colors} />
        <div className="wrap">
          <div className="hero__inner">
            <motion.p className="eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease }}>Customer segmentation · RFM + K-Means</motion.p>
            <h1 className="h1">
              {["Find", "the"].map((w, i) => (
                <motion.span key={w} style={{ display: "inline-block", marginRight: "0.24em" }} initial={{ opacity: 0, y: 40, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 1, delay: 0.3 + i * 0.08, ease }}>{w}</motion.span>
              ))}
              <motion.span className="serif grad-text" style={{ display: "inline-block" }} initial={{ opacity: 0, y: 40, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 1.1, delay: 0.46, ease }}>constellations</motion.span>
              <br />
              {["in", "your", "customers."].map((w, i) => (
                <motion.span key={w} style={{ display: "inline-block", marginRight: "0.24em" }} initial={{ opacity: 0, y: 40, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 1, delay: 0.6 + i * 0.08, ease }}>{w}</motion.span>
              ))}
            </h1>
            <motion.p className="lead" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.9, ease }}>
              Upload an order export. Constellation cleans it, scores every customer on recency, frequency and spend, groups them with K‑Means, and writes a playbook for each group.
            </motion.p>
            <motion.div className="hero__cta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 1.05, ease }}>
              <Link className="btn btn--lg" to="/run/demo">Open the live demo <span className="arrow">→</span></Link>
              <Link className="btn btn--ghost btn--lg" to="/new"><Icon.upload width={18} height={18} /> Upload your CSV</Link>
            </motion.div>
            <motion.div className="hero__meta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.3 }}>
              <span><b>{totals ? <CountUp value={totals.runs} /> : "–"}</b> runs so far</span>
              <span><b>{totals ? <CountUp value={totals.customers} /> : "–"}</b> customers segmented</span>
              <span><b>{totals ? <CountUp value={totals.rows} /> : "–"}</b> order rows cleaned</span>
            </motion.div>
          </div>
        </div>
        <div className="hero__hint"><i /> 10,480 demo customers, 8 segments</div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <Reveal><p className="eyebrow">How it works</p></Reveal>
          <Reveal delay={0.05}><h2 className="h2" style={{ maxWidth: 820 }}>Five steps from a messy export <span className="serif grad-text">to a plan.</span></h2></Reveal>
          <div className="steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.07} className="card spot card--lift step">
                <span className="step__n">{s.n}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
                <div className="step__viz" aria-hidden="true">
                  {s.bars.map((b, j) => (
                    <motion.span key={j} style={{ "--c": s.c, height: `${b * 10}%` }} initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.2 + j * 0.05, ease }} />
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal><p className="eyebrow">Under the hood</p></Reveal>
          <Reveal delay={0.05}><h2 className="h2" style={{ maxWidth: 860 }}>Checked against <span className="serif grad-text">scikit-learn</span>, not just pretty.</h2></Reveal>
          <Reveal delay={0.1}><p className="lead" style={{ maxWidth: "60ch" }}>The model was written first in Python with pandas and scikit-learn, then ported to JavaScript so it runs inside Netlify Functions. A parity script runs both on the same data and compares every customer, every feature and every cluster.</p></Reveal>
          <div className="facts">
            {[
              { v: <CountUp value={1.0} format={(x) => x.toFixed(2)} />, p: "Adjusted Rand index between the production model and scikit-learn's KMeans at k = 8." },
              { v: <>~<CountUp value={1.6} format={(x) => x.toFixed(1)} /> s</>, p: "To clean 116,670 rows and segment 10,480 customers, model scan included." },
              { v: <CountUp value={8} />, p: "Behaviour patterns hidden in the demo data. The model finds all 8, with 98% of customers matched." },
              { v: <><CountUp value={30} /> days</>, p: "How long uploaded runs are kept before a scheduled job deletes them." },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 0.07} className="card spot fact">
                <div className="fact__v grad-text">{f.v}</div>
                <p>{f.p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap split">
          <div>
            <Reveal><p className="eyebrow">From clusters to campaigns</p></Reveal>
            <Reveal delay={0.05}><h2 className="h2">A playbook for <span className="serif grad-text">every group.</span></h2></Reveal>
            <Reveal delay={0.1}><p className="lead">Gemini reads each segment's numbers and writes three actions, an offer, the metric to watch and a sample message. Without an API key you still get a rule-based playbook, so the app always works.</p></Reveal>
            <Reveal delay={0.15}><div className="hero__cta"><Link className="btn" to="/run/demo">See the demo playbook <span className="arrow">→</span></Link><a className="btn btn--ghost" href={REPO_URL} target="_blank" rel="noreferrer"><Icon.github /> Read the code</a></div></Reveal>
          </div>
          <div style={{ position: "relative", minHeight: 340, display: "grid", alignContent: "center", gap: 14 }}>
            {NOTIFS.map((n, i) => (
              <motion.div key={n.s} initial={{ opacity: 0, x: 40, rotate: 2 }} whileInView={{ opacity: 1, x: 0, rotate: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.15 + i * 0.15, ease }}
                whileHover={{ y: -4, scale: 1.01 }} style={{ marginLeft: `${i * 6}%`, maxWidth: 440 }}>
                <div className="notif" style={{ "--c": n.c, padding: "16px 18px" }}>
                  <span className="notif__app"><Icon.spark style={{ color: "#fff" }} /></span>
                  <div><small>{n.s}</small><b>Thread & Clay · {n.t}</b><span>{n.p}</span></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal className="cta-band">
            <p className="eyebrow">Try it</p>
            <h2 className="h2" style={{ maxWidth: 760 }}>Bring an export from Shopify, the UCI Online Retail II dataset, or any CSV with a customer, a date and an amount.</h2>
            <div className="hero__cta">
              <Link className="btn btn--lg" to="/new">Start a run <span className="arrow">→</span></Link>
              <Link className="btn btn--ghost btn--lg" to="/run/demo">Explore the demo</Link>
            </div>
          </Reveal>
        </div>
      </section>
      <Footer />
    </div>
  );
}
