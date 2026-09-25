import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useInView, animate } from "framer-motion";
import { api } from "../lib/api.js";

export const REPO_URL = "https://github.com/NishantSingh00001/constellation";
export const PORTFOLIO_URL = "https://nishant-singhaa0240274.netlify.app";

export function LogoMark({ size = 26 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="lg-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b9dff" /><stop offset=".5" stopColor="#c49bff" /><stop offset="1" stopColor="#ff9fcf" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#0d1020" stroke="rgba(255,255,255,.1)" />
      <g stroke="url(#lg-mark)" strokeWidth="1.4" fill="none" strokeLinecap="round"><path d="M8 21 13 11l6 4 5-7" /><path d="M13 11l-1 12 7-8" /></g>
      <g fill="#fff"><circle cx="8" cy="21" r="1.8" /><circle cx="13" cy="11" r="2.2" /><circle cx="19" cy="15" r="1.7" /><circle cx="24" cy="8" r="2" /><circle cx="12" cy="23" r="1.4" /></g>
    </svg>
  );
}

export const Icon = {
  upload: (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 16V4m0 0-4 4m4-4 4 4" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>,
  file: (p) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>,
  check: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 5 5L20 7" /></svg>,
  x: (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  spark: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>,
  download: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16" /></svg>,
  link: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>,
  trash: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  send: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  github: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.9 10.9c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .4.2.7.8.6A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" /></svg>,
};

/** Page-wide pointer tracking for the spotlight hover on cards (.spot). */
export function useSpotlight() {
  useEffect(() => {
    const onMove = (e) => {
      const el = e.target.closest?.(".spot");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
}

export function Reveal({ children, delay = 0, y = 24, className, as = "div", ...rest }) {
  const M = motion[as];
  return (
    <M className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }} {...rest}>
      {children}
    </M>
  );
}

export function CountUp({ value, format = (v) => Math.round(v).toLocaleString("en-IN"), duration = 1.4 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView || value == null) return undefined;
    const ctrl = animate(0, value, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: setShown });
    return () => ctrl.stop();
  }, [inView, value, duration]);
  return <span ref={ref}>{value == null ? "–" : format(shown)}</span>;
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [health, setHealth] = useState(null);
  const loc = useLocation();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => { api.health().then(setHealth).catch(() => setHealth({ ok: false })); }, []);
  const solid = loc.pathname !== "/";
  const ai = health?.ai?.enabled;
  return (
    <header className={`nav ${scrolled ? "is-scrolled" : ""} ${solid ? "is-solid" : ""}`}>
      <div className="wrap nav__inner">
        <Link to="/" className="logo" aria-label="Constellation home"><LogoMark /> Constellation</Link>
        <nav className="nav__links" aria-label="Primary">
          <NavLink to="/run/demo">Live demo</NavLink>
          <NavLink to="/new">New run</NavLink>
          <NavLink to="/runs">Your runs</NavLink>
          <a href={REPO_URL} target="_blank" rel="noreferrer">Code</a>
        </nav>
        <div className="nav__right">
          {health && (
            <span className={`chip nav__status ${ai ? "chip--ai" : ""}`} title={ai ? `AI playbooks on (${health.ai.model})` : "AI not configured: rule-based playbooks"}>
              <span className={`pulse-dot ${health.ok ? "" : "pulse-dot--off"}`} /> {health.ok ? (ai ? "API · AI on" : "API online") : "API offline"}
            </span>
          )}
          <Link to="/new" className="btn btn--sm">Upload CSV <span className="arrow">→</span></Link>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap row">
        <span>Constellation · built by <a className="link" href={PORTFOLIO_URL} target="_blank" rel="noreferrer">Nishant Singh</a></span>
        <span className="spacer" />
        <a className="link" href={REPO_URL} target="_blank" rel="noreferrer">Source on GitHub</a>
        <span>·</span>
        <a className="link" href="/api/health" target="_blank" rel="noreferrer">API status</a>
      </div>
    </footer>
  );
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, kind = "info") => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, text, kind }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} className={`toast toast--${t.kind}`} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              {t.kind === "ok" ? <Icon.check style={{ color: "var(--good)", marginTop: 3 }} /> : t.kind === "error" ? <Icon.x style={{ color: "var(--bad)", marginTop: 3 }} /> : null}
              <span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function SegControl({ options, value, onChange, label, disabled }) {
  return (
    <div className="seg-control" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} className={on ? "on" : ""} disabled={disabled} onClick={() => onChange(o.value)} style={{ isolation: "isolate" }}>
            {on && <motion.span layoutId={`seg-${label}`} className="seg-bg" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
