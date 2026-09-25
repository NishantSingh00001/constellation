// Prompts and schemas for the AI features.

import { formatMoney, rulePlaybook } from "../../shared/segments.js";

export function segmentFacts(run) {
  const cur = run.currency || "INR";
  return run.segments.map((s) => ({
    id: s.id,
    name: s.name,
    customers: s.size,
    shareOfCustomers: `${(s.share * 100).toFixed(1)}%`,
    shareOfRevenue: `${(s.revenueShare * 100).toFixed(1)}%`,
    revenue: formatMoney(s.revenue, cur),
    avgDaysSinceLastOrder: s.avg.recency,
    avgOrders: s.avg.frequency,
    avgLifetimeSpend: formatMoney(s.avg.monetary, cur),
    avgOrderValue: formatMoney(s.avg.aov, cur),
    avgTenureDays: s.avg.tenure,
    rfmScores: s.scores,
    topLocations: s.topLocations.map((l) => `${l.name} ${(l.share * 100).toFixed(0)}%`).join(", "),
  }));
}

function overview(run) {
  const s = run.summary;
  const cur = run.currency || "INR";
  return [
    `Customers: ${s.customers.toLocaleString("en-IN")}; orders: ${s.orders.toLocaleString("en-IN")}; revenue: ${formatMoney(s.revenue, cur)}; average order value: ${formatMoney(s.aov, cur)}.`,
    `Data covers ${s.dateRange[0].slice(0, 10)} to ${s.dateRange[1].slice(0, 10)}. Recency is measured from ${s.snapshot.slice(0, 10)}.`,
    `Model: K-Means on log-scaled recency, frequency and monetary value, k = ${s.k}, silhouette ${s.silhouette}.`,
  ].join("\n");
}

export const PLAYBOOK_SYSTEM = `You are a senior CRM and lifecycle-marketing strategist for Indian e-commerce and retail brands.
You turn customer segments into specific, practical actions.
Rules:
- Base every statement on the numbers provided. Do not invent figures that are not derivable from them.
- Write plainly, like a strategist briefing a founder. No hype words (no "unlock", "leverage", "supercharge", "delve").
- Actions must be concrete: say what to send or change, to whom, and when.
- Keep each field short. Use the brand's currency.`;

export const PLAYBOOK_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING", description: "2-3 sentence executive summary of where revenue comes from and the biggest risk and opportunity." },
    segments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "INTEGER" },
          persona: { type: "STRING", description: "A short, human persona name for this segment (2-4 words)." },
          headline: { type: "STRING", description: "The one goal for this segment, under 10 words." },
          insight: { type: "STRING", description: "One sentence on what the numbers say about this group." },
          actions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { title: { type: "STRING" }, detail: { type: "STRING" } },
              required: ["title", "detail"],
            },
          },
          channel: { type: "STRING" },
          offer: { type: "STRING" },
          kpi: { type: "STRING" },
          message: {
            type: "OBJECT",
            properties: { subject: { type: "STRING" }, preview: { type: "STRING" } },
            required: ["subject", "preview"],
          },
          priority: { type: "STRING", enum: ["high", "medium", "low"] },
        },
        required: ["id", "persona", "headline", "insight", "actions", "channel", "offer", "kpi", "message", "priority"],
      },
    },
  },
  required: ["summary", "segments"],
};

export function playbookPrompt(run, context) {
  return `Business context: ${context || "An online retail business."}
Currency: ${run.currency || "INR"}

${overview(run)}

Segments (JSON):
${JSON.stringify(segmentFacts(run), null, 1)}

Write a marketing playbook with exactly one entry per segment id above (${run.segments.map((s) => s.id).join(", ")}).
Give each segment exactly 3 actions. The message is a sample email/WhatsApp subject line and preview text for that segment.`;
}

/** Keep the AI output well-formed: every segment present, fields trimmed, gaps filled from the rules. */
export function mergePlaybook(run, ai, model) {
  const rules = rulePlaybook(run.segments, run.currency);
  const byId = new Map((ai?.segments || []).map((s) => [Number(s.id), s]));
  const str = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  return {
    source: "gemini",
    model,
    generatedAt: new Date().toISOString(),
    summary: str(ai?.summary, 700) || rules.summary,
    segments: rules.segments.map((base) => {
      const s = byId.get(base.id);
      if (!s) return base;
      const actions = Array.isArray(s.actions)
        ? s.actions.filter((a) => a && a.title).slice(0, 3).map((a) => ({ title: str(a.title, 80), detail: str(a.detail, 240) || "" }))
        : [];
      return {
        id: base.id,
        persona: str(s.persona, 40) || base.persona,
        headline: str(s.headline, 90) || base.headline,
        insight: str(s.insight, 260) || base.insight,
        actions: actions.length ? actions : base.actions,
        channel: str(s.channel, 60) || base.channel,
        offer: str(s.offer, 90) || base.offer,
        kpi: str(s.kpi, 90) || base.kpi,
        message: {
          subject: str(s.message?.subject, 90) || base.message.subject,
          preview: str(s.message?.preview, 160) || base.message.preview,
        },
        priority: ["high", "medium", "low"].includes(s.priority) ? s.priority : base.priority,
      };
    }),
  };
}

export const ASK_SYSTEM = `You are Constellation's analyst. You answer questions about one customer-segmentation run.
Rules:
- Use only the data given. If the question can't be answered from it, say what data would be needed.
- Lead with the answer. Keep it under 120 words. Use short paragraphs or up to 4 bullet lines starting with "- ".
- Quote numbers from the data with the brand's currency. No markdown headings, no bold.
- If asked something unrelated to the business or the data, politely steer back.`;

export function askPrompt(run, question, context) {
  return `Business context: ${context || run.context || "An online retail business."}

${overview(run)}

Segments (JSON):
${JSON.stringify(segmentFacts(run))}

Question: ${question}`;
}
