// Column detection and value parsing for uploaded order exports.

export const FIELDS = [
  { key: "customer", label: "Customer ID", required: true, hint: "Who bought" },
  { key: "date", label: "Order date", required: true, hint: "When they bought" },
  { key: "invoice", label: "Order / invoice ID", required: false, hint: "Groups line items into orders" },
  { key: "amount", label: "Line or order total", required: false, hint: "Use this or quantity × price" },
  { key: "quantity", label: "Quantity", required: false, hint: "Units on the line" },
  { key: "price", label: "Unit price", required: false, hint: "Price per unit" },
  { key: "location", label: "City / country", required: false, hint: "Optional, for segment profiles" },
];

const ALIASES = {
  customer: ["customerid", "customer", "custid", "cust", "customerno", "customernumber", "clientid", "client", "userid", "user", "memberid", "buyerid", "accountid", "customercode", "email", "customeremail", "phone", "mobile"],
  invoice: ["invoice", "invoiceno", "invoiceid", "invoicenumber", "orderid", "order", "orderno", "ordernumber", "transactionid", "txnid", "transaction", "billno", "billnumber", "receiptno", "receipt", "salesorder"],
  date: ["invoicedate", "date", "orderdate", "transactiondate", "purchasedate", "timestamp", "createdat", "datetime", "orderdatetime", "saledate", "billdate", "txndate", "time"],
  quantity: ["quantity", "qty", "units", "unitssold", "quantityordered", "count", "items", "noofitems"],
  price: ["price", "unitprice", "priceeach", "rate", "itemprice", "sellingprice", "mrp", "unitcost"],
  amount: ["amount", "total", "sales", "revenue", "value", "totalamount", "ordervalue", "netamount", "spend", "gmv", "linetotal", "totalprice", "ordertotal", "grandtotal", "totalsales", "netsales", "paymentvalue", "purchaseamount"],
  location: ["country", "city", "region", "state", "location", "shippingcity", "billingcity", "shipcity", "market", "zone"],
};

export function normHeader(h) {
  return String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseNumber(v) {
  if (v == null) return NaN;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  if (!s) return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[₹$€£¥]|rs\.?|inr|usd|eur|gbp/gi, "").replace(/[\s,]/g, "");
  const n = Number(s);
  return neg ? -n : n;
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/**
 * Parse a date string to UTC milliseconds (the wall-clock time is kept as-is).
 * order: "dmy" or "mdy" decides ambiguous numeric dates like 03/04/2025.
 */
export function parseDate(v, order = "dmy") {
  if (v == null) return NaN;
  if (typeof v === "number") {
    // Excel serial date
    if (v > 20000 && v < 80000) return Math.round((v - 25569) * 86400000);
    return NaN;
  }
  const s = String(v).trim();
  if (!s) return NaN;
  if (/^\d+(\.\d+)?$/.test(s)) {
    // Bare numbers: Excel serial dates (e.g. 45292) or compact yyyymmdd.
    const num = Number(s);
    if (num > 20000 && num < 80000) return Math.round((num - 25569) * 86400000);
    const c = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (c && +c[2] >= 1 && +c[2] <= 12 && +c[3] >= 1 && +c[3] <= 31) return Date.UTC(+c[1], +c[2] - 1, +c[3]);
    return NaN;
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[\s,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (m) {
    let a = +m[1], b = +m[2], y = +m[3];
    if (y < 100) y += 2000;
    let day, mon;
    if (a > 12) { day = a; mon = b; }
    else if (b > 12) { day = b; mon = a; }
    else if (order === "mdy") { mon = a; day = b; }
    else { day = a; mon = b; }
    let hh = +(m[4] || 0);
    if (m[7]) { const pm = m[7].toLowerCase() === "pm"; if (pm && hh < 12) hh += 12; if (!pm && hh === 12) hh = 0; }
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return NaN;
    return Date.UTC(y, mon - 1, day, hh, +(m[5] || 0), +(m[6] || 0));
  }
  m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-,]+(\d{2,4})/);
  if (m && MONTHS[m[2].toLowerCase()] != null) {
    let y = +m[3]; if (y < 100) y += 2000;
    return Date.UTC(y, MONTHS[m[2].toLowerCase()], +m[1]);
  }
  m = s.match(/^([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS[m[1].toLowerCase()] != null) return Date.UTC(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : NaN;
}

/** Decide between day-first and month-first for numeric dates. */
export function detectDateOrder(values) {
  let dmy = 0, mdy = 0;
  for (const v of values) {
    const m = String(v ?? "").trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/);
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    if (+m[2] > 12) mdy++;
  }
  return mdy > dmy ? "mdy" : "dmy";
}

function share(values, test) {
  const vals = values.filter((v) => v != null && String(v).trim() !== "");
  if (!vals.length) return 0;
  return vals.filter(test).length / vals.length;
}

/**
 * Guess which column holds each field.
 * @param {string[]} headers
 * @param {object[]} preview first rows keyed by header
 */
export function detectMapping(headers, preview) {
  const mapping = {};
  const used = new Set();
  const col = (h) => preview.map((r) => r[h]);
  const order = ["customer", "invoice", "date", "amount", "quantity", "price", "location"];
  const scores = {};
  for (const field of order) {
    scores[field] = headers.map((h) => {
      const n = normHeader(h);
      const aliases = ALIASES[field];
      let s = 0;
      const exact = aliases.indexOf(n);
      if (exact >= 0) s = 100 - exact;
      else if (aliases.some((a) => a.length > 3 && n.includes(a))) s = 40;
      if (s === 0) return { h, s };
      const vals = col(h);
      if (field === "date") s += share(vals, (v) => Number.isFinite(parseDate(v))) * 50 - 25;
      if (["amount", "quantity", "price"].includes(field)) s += share(vals, (v) => Number.isFinite(parseNumber(v))) * 50 - 25;
      return { h, s };
    });
  }
  for (const field of order) {
    const best = scores[field].filter((x) => x.s > 20 && !used.has(x.h)).sort((a, b) => b.s - a.s)[0];
    mapping[field] = best ? best.h : null;
    if (best) used.add(best.h);
  }
  // Shopify-style exports call the order number "Name" (#1001, #1002, ...).
  if (!mapping.invoice) {
    const h = headers.find((x) => !used.has(x) && ["name", "ordername"].includes(normHeader(x)) && share(col(x), (v) => /^#?[A-Z]{0,4}\d{3,}$/i.test(String(v).trim())) > 0.9);
    if (h) { mapping.invoice = h; used.add(h); }
  }
  // Fallback for the date: any column that parses as dates almost everywhere.
  if (!mapping.date) {
    const d = headers.find((h) => !used.has(h) && share(col(h), (v) => /\d/.test(String(v)) && Number.isFinite(parseDate(v))) > 0.9 && share(col(h), (v) => /[-/:]/.test(String(v))) > 0.9);
    if (d) { mapping.date = d; used.add(d); }
  }
  const dateOrder = mapping.date ? detectDateOrder(col(mapping.date)) : "dmy";
  return { mapping, dateOrder };
}

export function validateMapping(mapping) {
  const errors = [];
  if (!mapping.customer) errors.push("Pick the column that identifies the customer.");
  if (!mapping.date) errors.push("Pick the column with the order date.");
  if (!mapping.amount && !(mapping.quantity && mapping.price)) errors.push("Pick a total/amount column, or both quantity and unit price.");
  return errors;
}

/**
 * Turn raw rows into normalised transactions.
 * Invalid values are kept as NaN / "" so the cleaning stage can count them.
 */
export function normalizeRows(rows, mapping, dateOrder = "dmy") {
  const out = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const q = mapping.quantity ? parseNumber(r[mapping.quantity]) : NaN;
    const p = mapping.price ? parseNumber(r[mapping.price]) : NaN;
    let amount = mapping.amount ? parseNumber(r[mapping.amount]) : NaN;
    if (!mapping.amount) amount = q * p;
    let cust = r[mapping.customer];
    cust = cust == null ? "" : String(cust).trim();
    if (/^\d+\.0+$/.test(cust)) cust = cust.replace(/\.0+$/, ""); // "12346.0" -> "12346"
    out[i] = {
      customer: cust,
      invoice: mapping.invoice ? String(r[mapping.invoice] ?? "").trim() : "",
      date: parseDate(r[mapping.date], dateOrder),
      quantity: q,
      price: p,
      amount,
      location: mapping.location ? String(r[mapping.location] ?? "").trim() : "",
      key: Object.values(r).join("\u0001"),
    };
  }
  return out;
}
