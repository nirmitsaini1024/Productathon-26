import "dotenv/config";

import cors from "cors";
import express from "express";
import { getTenderModel } from "./api-db.js";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseMaybeDate(s) {
  if (!s) return null;
  const d = new Date(String(s));
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntil(d, now = new Date()) {
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function computeUrgency(t) {
  const d =
    parseMaybeDate(t.closingDate) ||
    parseMaybeDate(t.bidSubmissionEndDate) ||
    parseMaybeDate(t.docDownloadEndDate);
  if (!d) return "Low";
  const du = daysUntil(d);
  if (du <= 7) return "High";
  if (du <= 14) return "Medium";
  return "Low";
}

function computeLeadScore(t) {
  const urgency = computeUrgency(t);
  const base = urgency === "High" ? 85 : urgency === "Medium" ? 70 : 55;
  const boost = (t.tenderValue ? 5 : 0) + (t.workDescription || t.title ? 5 : 0);
  return clamp(base + boost, 10, 99);
}

function computeConfidence(t) {
  const base = 80;
  const boost = (t.workDescription ? 5 : 0) + (t.tenderValue ? 5 : 0);
  return clamp(base + boost, 30, 98);
}

function guessLocation(t) {
  const raw = String(t.workLocation ?? t.location ?? "").trim();
  if (!raw) return { city: "Unknown", state: "Unknown", region: "Unknown" };
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const city = parts[0] || "Unknown";
  const state = parts[1] || parts[0] || "Unknown";
  return { city, state, region: "Unknown" };
}

function toLead(t) {
  const id = t.key || String(t._id);
  const company = String(t.organisation || t.tenderInvitingAuthorityName || "Unknown Organisation");
  const loc = guessLocation(t);

  const published =
    parseMaybeDate(t.publishedDateFull) ||
    parseMaybeDate(t.publishedDate) ||
    parseMaybeDate(t.createdAt) ||
    new Date();

  const urgency = computeUrgency(t);
  const lead_score = computeLeadScore(t);
  const confidence = computeConfidence(t);

  const website = "https://eprocure.gov.in";
  const sourceUrl = String(t.detailUrl || website);

  const keyword = String(t.lastKeyword || (t.keywords?.[0] ?? "Tender"));
  const title = String(t.title || t.workTitle || "Tender Opportunity");
  const summary = String(t.workDescription || title);

  return {
    id,
    company_name: company,
    location: { city: loc.city, state: loc.state, region: loc.region },
    industry: "Government Tender",
    website,
    company_size: "Unknown",
    lead_score,
    urgency,
    confidence,
    signals: [
      {
        type: "Tender",
        keyword: title,
        source: sourceUrl,
        date: published.toISOString(),
        trust_score: 90,
        summary,
      },
    ],
    products_recommended: [
      {
        product_name: "HPCL HSD / Diesel (Bulk Supply)",
        confidence: 85,
        reason_code: `Matched keyword "${keyword}" from eProcure tender`,
        estimated_volume: "TBD",
        margin_potential: urgency === "High" ? "High" : "Medium",
      },
    ],
    next_actions: {
      suggested_action: "Call + Email",
      timing: urgency === "High" ? "Within 24-48 hours" : "Within 7 days",
      context: `Review tender details and propose HPCL supply option. Reference: ${t.reference ?? "N/A"}`,
      contact_trigger: "Tender detected on eProcure",
    },
    sales_owner: "Unassigned",
    field_officer: "Unassigned",
    status: "new",
    notes: "",
    created_at: published.toISOString().slice(0, 10),
  };
}

function computeMetricsFromLeads(leads) {
  const total = leads.length;
  const accepted = leads.filter((l) => l.status === "accepted").length;
  const converted = leads.filter((l) => l.status === "converted").length;
  const avg = total ? Math.round(leads.reduce((sum, l) => sum + (Number(l.lead_score) || 0), 0) / total) : 0;
  const conversionRate = total ? `${Math.round((converted / total) * 100)}%` : "0%";

  const demand = new Map();
  for (const l of leads) {
    const p = l.products_recommended?.[0]?.product_name;
    if (!p) continue;
    demand.set(p, (demand.get(p) ?? 0) + 1);
  }
  const by_product = [...demand.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([product, demand_count]) => ({ product, demand_count, conversion_rate: "0%" }));

  const regions = new Map();
  for (const l of leads) {
    const r = l.location?.region || "Unknown";
    regions.set(r, (regions.get(r) ?? 0) + 1);
  }
  const by_region = [...regions.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([region, count]) => ({ region, count, conversion_rate: "0%" }));

  return {
    this_week: {
      leads_discovered: total,
      leads_contacted: 0,
      leads_accepted: accepted,
      leads_converted: converted,
      conversion_rate: conversionRate,
      avg_lead_score: avg,
    },
    this_month: {
      leads_discovered: total,
      leads_contacted: 0,
      leads_accepted: accepted,
      leads_converted: converted,
      conversion_rate: conversionRate,
      estimated_revenue: "TBD",
    },
    by_product,
    by_sector: [{ sector: "Government Tender", count: total, avg_score: avg }],
    by_region,
  };
}

const app = express();

// Allow configuring CORS for the UI origin(s)
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: false,
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/leads", async (req, res) => {
  try {
    const limit = clamp(Number(req.query.limit ?? 200), 1, 500);
    const Tender = await getTenderModel();
    const docs = await Tender.find({}).sort({ updatedAt: -1, createdAt: -1 }).limit(limit).lean();
    const leads = docs.map(toLead);
    const dashboard_metrics = computeMetricsFromLeads(leads);
    res.json({ leads, dashboard_metrics });
  } catch (err) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});


