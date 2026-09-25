// Seeded generator for the demo dataset.
//
// It produces line-item transactions for "Thread & Clay", a made-up Indian
// home-decor brand, in the same column layout as the UCI Online Retail II
// dataset (Invoice, StockCode, Description, Quantity, InvoiceDate, Price,
// Customer ID, City). Customers follow eight behaviour patterns, and the file
// carries the usual mess of real exports: guest checkouts with no customer
// ID, cancellations, free samples and duplicated rows.

import { mulberry32, randInt, lognormal, weightedPick, shuffle } from "./random.js";

export const SAMPLE_META = {
  name: "Thread & Clay — 2 years of orders",
  brand: "Thread & Clay",
  description:
    "Synthetic line-item orders for a fictional Indian home-decor brand, Jan 2024 to Dec 2025, in the UCI Online Retail II column layout.",
  currency: "INR",
  context: "Thread & Clay is a direct-to-consumer home decor brand in India selling handmade textiles, ceramics and lighting online.",
};

const CATALOG = [
  ["TC-1001", "Hand-block printed cushion cover", 549],
  ["TC-1002", "Indigo dabu cotton throw", 1899],
  ["TC-1003", "Kantha stitch bedcover (queen)", 3499],
  ["TC-1004", "Handloom cotton table runner", 799],
  ["TC-1005", "Jute and cotton floor mat", 1299],
  ["TC-1006", "Block print napkins, set of 4", 649],
  ["TC-2001", "Terracotta planter, medium", 899],
  ["TC-2002", "Blue pottery serving bowl", 1149],
  ["TC-2003", "Stoneware mug, speckled", 449],
  ["TC-2004", "Hand-painted ceramic plate", 699],
  ["TC-2005", "Khurja glazed vase", 1599],
  ["TC-2006", "Stoneware dinner set, 12 pc", 4999],
  ["TC-3001", "Brass diya, set of 2", 749],
  ["TC-3002", "Cane pendant lamp", 2899],
  ["TC-3003", "Soy wax candle, vetiver", 599],
  ["TC-3004", "Hand-beaten brass tray", 1799],
  ["TC-3005", "Terracotta hanging lantern", 1349],
  ["TC-4001", "Sheesham wood serving board", 999],
  ["TC-4002", "Mango wood side stool", 3799],
  ["TC-4003", "Rattan storage basket", 1199],
  ["TC-4004", "Bamboo wall shelf", 1649],
  ["TC-5001", "Madhubani art print, A3", 899],
  ["TC-5002", "Macrame wall hanging", 1249],
  ["TC-5003", "Handmade paper journal", 349],
  ["TC-5004", "Incense cones, sandalwood", 199],
  ["TC-5005", "Gift card", 1000],
];

const CITIES = [
  ["Mumbai", 17], ["Delhi", 14], ["Bengaluru", 15], ["Pune", 8], ["Hyderabad", 9],
  ["Chennai", 7], ["Kolkata", 6], ["Ahmedabad", 5], ["Thane", 5], ["Jaipur", 4],
  ["Lucknow", 3], ["Kochi", 3], ["Chandigarh", 2], ["Indore", 2],
].map(([name, w]) => ({ name, w }));

// orders: [min,max]; lastAgo: days before END of the most recent order;
// span: days between first and last order; aov: median order value in INR.
const PATTERNS = [
  { key: "champion", w: 7, orders: [20, 40], lastAgo: [0, 12], span: [420, 720], aov: 2600, sd: 0.22 },
  { key: "loyal", w: 13, orders: [8, 14], lastAgo: [8, 50], span: [260, 600], aov: 1700, sd: 0.25 },
  { key: "potential", w: 12, orders: [3, 5], lastAgo: [0, 30], span: [40, 150], aov: 1500, sd: 0.3 },
  { key: "new", w: 11, orders: [1, 1], lastAgo: [0, 25], span: [0, 0], aov: 1250, sd: 0.35 },
  { key: "atRisk", w: 12, orders: [6, 11], lastAgo: [150, 300], span: [200, 400], aov: 1800, sd: 0.25 },
  { key: "cantLose", w: 4, orders: [18, 30], lastAgo: [120, 220], span: [320, 480], aov: 3100, sd: 0.22 },
  { key: "hibernating", w: 17, orders: [2, 3], lastAgo: [200, 420], span: [30, 200], aov: 1050, sd: 0.35 },
  { key: "lost", w: 24, orders: [1, 1], lastAgo: [400, 720], span: [0, 0], aov: 850, sd: 0.4 },
];

const DAY = 86400000;
const START = Date.UTC(2024, 0, 1);
const END = Date.UTC(2025, 11, 31);
const RANGE_DAYS = Math.round((END - START) / DAY);

function pad(n) {
  return String(n).padStart(2, "0");
}

export function formatDateTime(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function orderTime(rand, dayMs) {
  // Most orders land between 9am and 11pm IST; stored as naive local time.
  const minutes = randInt(rand, 9 * 60, 23 * 60 - 1);
  return dayMs + minutes * 60000;
}

function linesForOrder(rand, target) {
  const nLines = weightedPick(rand, [
    { n: 1, w: 55 }, { n: 2, w: 28 }, { n: 3, w: 12 }, { n: 4, w: 5 },
  ]).n;
  const lines = [];
  let remaining = target;
  for (let i = 0; i < nLines; i++) {
    const share = i === nLines - 1 ? remaining : remaining * (0.35 + rand() * 0.4);
    // Pick a product whose price is not far above the budget for this line.
    const affordable = CATALOG.filter((p) => p[2] <= Math.max(share * 1.3, 349) && !lines.some((l) => l.code === p[0]));
    const pool = affordable.length ? affordable : CATALOG.filter((p) => !lines.some((l) => l.code === p[0]));
    const p = pool[Math.floor(rand() * pool.length)];
    const qty = Math.max(1, Math.min(12, Math.round(share / p[2])));
    lines.push({ code: p[0], desc: p[1], price: p[2], qty });
    remaining = Math.max(0, remaining - qty * p[2]);
    if (remaining < 150 && i < nLines - 1) break;
  }
  return lines;
}

/**
 * Generate the demo dataset.
 * @returns {{ rows: Array<object>, truth: Map<string,string>, meta: object }}
 * rows use the Online Retail II field names.
 */
export function generateSample({ seed = 20260925, customers = 10480 } = {}) {
  const rand = mulberry32(seed);
  const ids = shuffle(rand, Array.from({ length: customers }, (_, i) => 12001 + i * 3 + randInt(rand, 0, 2)));
  const orders = []; // { cust, ms, lines, city }
  const truth = new Map();

  for (let c = 0; c < customers; c++) {
    const pat = weightedPick(rand, PATTERNS);
    const cust = String(ids[c]);
    truth.set(cust, pat.key);
    const city = weightedPick(rand, CITIES).name;
    const nOrders = randInt(rand, pat.orders[0], pat.orders[1]);
    const lastAgo = Math.min(RANGE_DAYS, randInt(rand, pat.lastAgo[0], pat.lastAgo[1]));
    const lastDay = RANGE_DAYS - lastAgo;
    const span = nOrders === 1 ? 0 : Math.min(lastDay, randInt(rand, Math.max(pat.span[0], nOrders * 4), Math.max(pat.span[1], nOrders * 4)));
    const firstDay = lastDay - span;
    const days = [firstDay, lastDay];
    for (let i = 2; i < nOrders; i++) days.push(randInt(rand, firstDay, lastDay));
    days.length = nOrders;
    days.sort((a, b) => a - b);
    // Customer-level spend level, then per-order variation around it.
    const custAov = lognormal(rand, pat.aov, pat.sd);
    for (const d of days) {
      const target = Math.max(199, lognormal(rand, custAov, 0.3));
      orders.push({ cust, ms: orderTime(rand, START + d * DAY), lines: linesForOrder(rand, target), city });
    }
  }

  // Guest checkouts (no customer ID) — about 2% of orders.
  const guests = Math.round(orders.length * 0.02);
  for (let g = 0; g < guests; g++) {
    const d = randInt(rand, 0, RANGE_DAYS);
    orders.push({ cust: "", ms: orderTime(rand, START + d * DAY), lines: linesForOrder(rand, lognormal(rand, 1100, 0.5)), city: weightedPick(rand, CITIES).name });
  }

  orders.sort((a, b) => a.ms - b.ms);
  const rows = [];
  let invoiceNo = 500001;
  const cancellable = [];
  for (const o of orders) {
    const inv = String(invoiceNo++);
    for (const l of o.lines) {
      rows.push({
        Invoice: inv,
        StockCode: l.code,
        Description: l.desc,
        Quantity: l.qty,
        InvoiceDate: formatDateTime(o.ms),
        Price: l.price,
        "Customer ID": o.cust,
        City: o.city,
      });
    }
    if (o.cust && rand() < 0.018) cancellable.push({ o, inv });
    // Free samples occasionally ride along with an order.
    if (rand() < 0.004) {
      rows.push({ Invoice: inv, StockCode: "TC-9000", Description: "Fabric swatch sample", Quantity: 1, InvoiceDate: formatDateTime(o.ms), Price: 0, "Customer ID": o.cust, City: o.city });
    }
  }

  // Cancellations: "C" + invoice, negative quantity, a few days later.
  for (const { o, inv } of cancellable) {
    const l = o.lines[0];
    const ms = Math.min(END + 23 * 3600000, o.ms + randInt(rand, 1, 6) * DAY);
    rows.push({ Invoice: `C${inv}`, StockCode: l.code, Description: l.desc, Quantity: -l.qty, InvoiceDate: formatDateTime(ms), Price: l.price, "Customer ID": o.cust, City: o.city });
  }

  // Exact duplicate rows (double-exported lines) — about 0.5%.
  const dupes = Math.round(rows.length * 0.005);
  for (let i = 0; i < dupes; i++) rows.push({ ...rows[Math.floor(rand() * rows.length)] });

  rows.sort((a, b) => (a.InvoiceDate < b.InvoiceDate ? -1 : a.InvoiceDate > b.InvoiceDate ? 1 : 0));
  return { rows, truth, meta: { ...SAMPLE_META, rows: rows.length } };
}

export const SAMPLE_COLUMNS = ["Invoice", "StockCode", "Description", "Quantity", "InvoiceDate", "Price", "Customer ID", "City"];

export const SAMPLE_MAPPING = {
  customer: "Customer ID",
  invoice: "Invoice",
  date: "InvoiceDate",
  quantity: "Quantity",
  price: "Price",
  amount: null,
  location: "City",
};

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows, columns = SAMPLE_COLUMNS) {
  const out = [columns.join(",")];
  for (const r of rows) out.push(columns.map((c) => csvCell(r[c])).join(","));
  return out.join("\n") + "\n";
}
