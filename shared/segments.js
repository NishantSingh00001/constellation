// Segment archetypes: how a cluster's average RFM scores (1–5) map to a
// business name, plus the rule-based playbook used when no AI key is set.

export const ARCHETYPES = [
  {
    key: "champions", name: "Champions", proto: [4.6, 4.6, 4.6],
    blurb: "Bought recently, order often and spend the most.",
    play: {
      goal: "Keep them close and turn them into advocates",
      actions: [
        ["Give them first access", "Open new collections to this group 48 hours before everyone else."],
        ["Start a referral loop", "Offer store credit for every friend who places a first order."],
        ["Ask for reviews and photos", "Send a review request one week after delivery; feature their photos."],
      ],
      channel: "Email + WhatsApp", offer: "Early access, not discounts", kpi: "Referral orders and repeat rate",
      message: ["You're first in line", "Our festive collection opens to you two days early."], priority: "high",
    },
  },
  {
    key: "loyal", name: "Loyal Customers", proto: [3.9, 4.0, 3.9],
    blurb: "Order regularly and respond well to launches.",
    play: {
      goal: "Grow order value without discounting",
      actions: [
        ["Introduce loyalty tiers", "Points on every order, with a visible next tier and its perks."],
        ["Upsell complete sets", "Recommend the matching pieces for items they already own."],
        ["Bundle to lift basket size", "Curated bundles priced just above their average order."],
      ],
      channel: "Email", offer: "Points multiplier on bundles", kpi: "Average order value",
      message: ["Complete the set", "The pieces that go with what you already love."], priority: "high",
    },
  },
  {
    key: "potential", name: "Potential Loyalists", proto: [4.3, 2.9, 2.9],
    blurb: "Recent buyers with a few orders. The next order decides a lot.",
    play: {
      goal: "Get the third order in the first 90 days",
      actions: [
        ["Recommend from their history", "Personalised picks based on the category of their last order."],
        ["Invite to the loyalty programme", "Enrol them with a starter bonus that expires in 30 days."],
        ["Show social proof", "Bestsellers and reviews from customers in their city."],
      ],
      channel: "Email + app push", offer: "Starter points bonus", kpi: "3rd-order conversion within 90 days",
      message: ["Picked for your home", "Three pieces that pair with your last order."], priority: "high",
    },
  },
  {
    key: "new", name: "New Customers", proto: [4.6, 1.3, 1.6],
    blurb: "First order was recent. They don't know the brand well yet.",
    play: {
      goal: "Win the second order",
      actions: [
        ["Send a welcome series", "Three emails: brand story, care guide for their product, bestsellers."],
        ["Time a second-order nudge", "A small, time-boxed offer around day 21 after delivery."],
        ["Collect preferences", "A two-question quiz on style and room to personalise what they see."],
      ],
      channel: "Email + WhatsApp", offer: "10% off the second order, 14 days", kpi: "Second-order rate within 60 days",
      message: ["Welcome to the family", "How to care for your new piece, plus a little something."], priority: "medium",
    },
  },
  {
    key: "promising", name: "Promising", proto: [3.6, 1.6, 1.7],
    blurb: "Fairly recent, but low order count and spend so far.",
    play: {
      goal: "Build habit with low-cost touchpoints",
      actions: [
        ["Lower the barrier", "Highlight a free-shipping threshold close to their usual basket."],
        ["Tell the maker stories", "Content about the artisans behind products they viewed."],
        ["Try entry-price items", "Feature products under their average order value."],
      ],
      channel: "Email + Instagram", offer: "Free shipping over a threshold", kpi: "Orders per customer",
      message: ["Made by hand, for your home", "Meet the artisans behind our bestsellers."], priority: "medium",
    },
  },
  {
    key: "needAttention", name: "Need Attention", proto: [3.0, 3.0, 3.0],
    blurb: "Middle of the pack on every measure, and starting to drift.",
    play: {
      goal: "Re-engage before they slip further",
      actions: [
        ["Run a limited-time offer", "A one-week offer built around their most-bought category."],
        ["Show what's new", "New arrivals since their last visit."],
        ["Ask what they want", "A short survey with a small reward for completing it."],
      ],
      channel: "Email", offer: "Limited-time category offer", kpi: "Reactivation rate",
      message: ["New since your last visit", "Fresh arrivals in the collections you shop most."], priority: "medium",
    },
  },
  {
    key: "aboutToSleep", name: "About to Sleep", proto: [2.4, 2.0, 2.1],
    blurb: "Below average on recency and frequency. Easy to lose quietly.",
    play: {
      goal: "Reconnect cheaply",
      actions: [
        ["Share bestsellers", "A short edit of the most-loved products."],
        ["Use seasonal moments", "Tie outreach to festivals and home refresh seasons."],
        ["Offer a modest discount", "Keep it small and time-boxed."],
      ],
      channel: "Email", offer: "Small seasonal discount", kpi: "Open-to-order rate",
      message: ["It's been a while", "Here's what everyone's bringing home this season."], priority: "low",
    },
  },
  {
    key: "atRisk", name: "At Risk", proto: [1.9, 3.9, 3.8],
    blurb: "Used to buy often and spend well, but haven't come back in months.",
    play: {
      goal: "Win back valuable customers",
      actions: [
        ["Send a personal win-back", "A plain-text email from the founder, not a promo template."],
        ["Lead with what's new in their categories", "Show new arrivals related to what they bought."],
        ["Find out why", "A one-question survey: why did you stop ordering?"],
      ],
      channel: "Email + WhatsApp", offer: "Win-back credit on next order", kpi: "Win-back rate within 30 days",
      message: ["We miss you", "A lot has changed since your last order. Here's a welcome-back credit."], priority: "high",
    },
  },
  {
    key: "cantLose", name: "Can't Lose Them", proto: [1.5, 4.6, 4.7],
    blurb: "Among the biggest spenders ever, but gone quiet.",
    play: {
      goal: "Personal outreach to recover top value",
      actions: [
        ["Reach out one to one", "A customer-care call or WhatsApp message, not an automated blast."],
        ["Offer something exclusive", "A private preview or a made-to-order piece."],
        ["Fix what went wrong", "Check for unresolved complaints, returns or delivery issues."],
      ],
      channel: "Phone + WhatsApp", offer: "Exclusive preview", kpi: "Revenue recovered",
      message: ["A personal note from us", "You've been with us from the start. Can we help with anything?"], priority: "high",
    },
  },
  {
    key: "hibernating", name: "Hibernating", proto: [1.8, 1.9, 1.9],
    blurb: "Last order was long ago, with low frequency and spend.",
    play: {
      goal: "Occasional low-cost reactivation",
      actions: [
        ["Target festive peaks", "Include them in Diwali and wedding-season campaigns only."],
        ["Use cheap channels", "Email and organic social rather than paid ads."],
        ["Show relevant products", "Only products close to what they bought before."],
      ],
      channel: "Email", offer: "Festive offer", kpi: "Cost per reactivated customer",
      message: ["The festive edit is here", "Handmade pieces to light up your home."], priority: "low",
    },
  },
  {
    key: "lost", name: "Lost", proto: [1.2, 1.1, 1.3],
    blurb: "One-time or long-gone buyers with the lowest spend.",
    play: {
      goal: "One last try, then stop spending on them",
      actions: [
        ["Send one reactivation email", "Your strongest offer of the year, once."],
        ["Suppress from paid ads", "Exclude them from retargeting audiences to save budget."],
        ["Learn from them", "Look at what they bought first to improve first-order experience."],
      ],
      channel: "Email", offer: "Strongest annual offer, once", kpi: "Ad spend saved",
      message: ["One last thing", "Our biggest offer of the year, just for you."], priority: "low",
    },
  },
];

/**
 * Assign each cluster a distinct archetype, minimising the total squared
 * distance between cluster mean scores and archetype prototypes (exact, via
 * DP over subsets of archetypes).
 * @param {number[][]} clusterScores k × [r, f, m] mean scores
 * @returns {number[]} archetype index per cluster
 */
export function assignArchetypes(clusterScores) {
  const k = clusterScores.length;
  const A = ARCHETYPES.length;
  const cost = clusterScores.map((s) => ARCHETYPES.map((a) => a.proto.reduce((acc, p, t) => acc + (p - s[t]) ** 2, 0)));
  // dp[i][mask]: min cost assigning clusters 0..i-1 using archetypes in mask
  const memo = new Map();
  function solve(i, mask) {
    if (i === k) return { c: 0, pick: [] };
    const key = i * 4096 + mask;
    if (memo.has(key)) return memo.get(key);
    let best = { c: Infinity, pick: [] };
    for (let a = 0; a < A; a++) {
      if (mask & (1 << a)) continue;
      const sub = solve(i + 1, mask | (1 << a));
      const c = cost[i][a] + sub.c;
      if (c < best.c) best = { c, pick: [a, ...sub.pick] };
    }
    memo.set(key, best);
    return best;
  }
  return solve(0, 0).pick;
}

export function archetypeByKey(key) {
  return ARCHETYPES.find((a) => a.key === key);
}

/** Rule-based playbook: used when Gemini is not configured or fails. */
export function rulePlaybook(segments, currency = "INR") {
  const top = [...segments].sort((a, b) => b.revenueShare - a.revenueShare)[0];
  const risk = segments.filter((s) => ["atRisk", "cantLose"].includes(s.key));
  const riskRevenue = risk.reduce((s, x) => s + x.revenue, 0);
  const lines = [];
  if (top) lines.push(`${top.name} bring in ${Math.round(top.revenueShare * 100)}% of revenue from ${Math.round(top.share * 100)}% of customers.`);
  if (risk.length) lines.push(`${risk.map((r) => r.name).join(" and ")} hold ${formatMoney(riskRevenue, currency)} of past revenue and have gone quiet, so win-back is the most urgent job.`);
  const fresh = segments.find((s) => s.key === "new" || s.key === "potential");
  if (fresh) lines.push(`${fresh.name} are the growth lever: getting their next order is cheaper than finding new buyers.`);
  return {
    source: "rules",
    model: null,
    generatedAt: new Date().toISOString(),
    summary: lines.join(" "),
    segments: segments.map((s) => {
      const a = archetypeByKey(s.key);
      const p = a.play;
      return {
        id: s.id,
        persona: s.name,
        headline: p.goal,
        insight: a.blurb,
        actions: p.actions.map(([title, detail]) => ({ title, detail })),
        channel: p.channel,
        offer: p.offer,
        kpi: p.kpi,
        message: { subject: p.message[0], preview: p.message[1] },
        priority: p.priority,
      };
    }),
  };
}

export function formatMoney(v, currency = "INR") {
  const sym = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }[currency] ?? "";
  if (currency === "INR") {
    if (v >= 1e7) return `${sym}${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `${sym}${(v / 1e5).toFixed(1)} L`;
  } else {
    if (v >= 1e6) return `${sym}${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `${sym}${(v / 1e3).toFixed(1)}K`;
  }
  return `${sym}${Math.round(v).toLocaleString("en-IN")}`;
}
