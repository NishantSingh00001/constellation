export { formatMoney } from "../../shared/segments.js";

export const fmtInt = (n) => (n == null ? "–" : Math.round(n).toLocaleString("en-IN"));
export const fmtPct = (v, d = 0) => (v == null ? "–" : `${(v * 100).toFixed(d)}%`);
export const fmtNum = (v, d = 1) => (v == null ? "–" : Number(v).toFixed(d));
export const fmtBytes = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
export const fmtDays = (d) => (d == null ? "–" : d >= 60 ? `${Math.round(d / 30.4)} mo` : `${Math.round(d)} d`);
export const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.max(1, Math.round(ms))} ms`);

export function fmtDate(iso, opts = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "UTC", ...opts });
}

export function timeAgo(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export const currencySymbol = (c) => ({ INR: "₹", USD: "$", EUR: "€", GBP: "£" }[c] || "");
