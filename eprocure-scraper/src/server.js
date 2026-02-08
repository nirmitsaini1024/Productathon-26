import "dotenv/config";

import cors from "cors";
import express from "express";
import { getNewsRssModel, getOfficerModel, getT247TenderModel, getTenderModel, getAssignmentModel } from "./api-db.js";
import { extractStateNameFromSiteLocation, lookupStateByName, STATES } from "./state-map.js";
import { searchTender247 } from "./t247-client.js";
import { KEYWORDS } from "./keywords.js";
import { TENDER247_KEYWORDS } from "./tender247_keywords.js";
import { sendLeadEmail } from "./email.js";
import { sendWhatsAppTemplateMessage } from "./whatsapp.js";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseMaybeDate(s) {
  if (!s) return null;
  const raw = String(s).trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d;

  // Support common non-ISO formats we see in scraped sources, e.g. "12-02-2026" (dd-mm-yyyy)
  const m = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const hh = m[4] != null ? Number(m[4]) : 0;
    const mi = m[5] != null ? Number(m[5]) : 0;
    const ss = m[6] != null ? Number(m[6]) : 0;
    const dt = new Date(yyyy, mm - 1, dd, hh, mi, ss);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  return null;
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

function zoneNameFromId(id) {
  const z = Number(id);
  if (!Number.isFinite(z)) return "Unknown";
  // Tender247 uses a "statezone_id" that matches these 5 broad zones.
  if (z === 1) return "West";
  if (z === 2) return "South";
  if (z === 3) return "North";
  if (z === 4) return "East";
  if (z === 5) return "Central";
  return "Unknown";
}

function guessLocationT247(t) {
  const raw = String(t.site_location ?? "").trim();
  if (raw) {
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    const city = parts[0] || "Unknown";
    const state = String(t.state_name ?? parts[1] ?? "Unknown").trim() || "Unknown";
    return { city, state, region: zoneNameFromId(t.statezone_id) };
  }
  const state = String(t.state_name ?? "Unknown").trim() || "Unknown";
  return { city: "Unknown", state, region: zoneNameFromId(t.statezone_id) };
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

  // Migrate old "new" status to "discovered"
  let status = t.status || "discovered";
  if (status === "new") status = "discovered";

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
    status,
    notes: "",
    created_at: published.toISOString().slice(0, 10),
    
    // Tender-specific fields
    reference: t.reference || null,
    tenderId: t.tenderId || null,
    contractType: t.contractType || null,
    formOfContract: t.formOfContract || null,
    tenderCategory: t.tenderCategory || null,
    tenderType: t.tenderType || null,
    publishedDateFull: t.publishedDateFull || t.publishedDate || null,
    docDownloadStartDate: t.docDownloadStartDate || null,
    docDownloadEndDate: t.docDownloadEndDate || null,
    bidSubmissionStartDate: t.bidSubmissionStartDate || null,
    bidSubmissionEndDate: t.bidSubmissionEndDate || null,
    bidOpeningDateFull: t.bidOpeningDateFull || null,
    openingDate: t.openingDate || null,
    closingDate: t.closingDate || null,
    clarificationStartDate: t.clarificationStartDate || null,
    clarificationEndDate: t.clarificationEndDate || null,
    emdAmount: t.emdAmount || null,
    tenderFee: t.tenderFee || null,
    emdFeeType: t.emdFeeType || null,
    emdExemptionAllowed: t.emdExemptionAllowed || null,
    paymentMode: t.paymentMode || null,
    paymentInstruments: t.paymentInstruments || [],
    workLocation: t.workLocation || null,
    periodOfWorkDays: t.periodOfWorkDays || null,
    bidValidityDays: t.bidValidityDays || null,
    numberOfCovers: t.numberOfCovers || null,
    productCategory: t.productCategory || null,
    bidOpeningPlace: t.bidOpeningPlace || null,
    allowTwoStageBidding: t.allowTwoStageBidding || null,
    allowPreferentialBidder: t.allowPreferentialBidder || null,
    withdrawalAllowed: t.withdrawalAllowed || null,
    tenderFeeExemptionAllowed: t.tenderFeeExemptionAllowed || null,
    generalTechnicalEvaluationAllowed: t.generalTechnicalEvaluationAllowed || null,
    itemWiseTechnicalEvaluationAllowed: t.itemWiseTechnicalEvaluationAllowed || null,
    shouldAllowNDATender: t.shouldAllowNDATender || null,
    ndaPreQualification: t.ndaPreQualification || null,
    covers: t.covers || [],
    nitDocuments: t.nitDocuments || [],
    workItemDocuments: t.workItemDocuments || [],
    detailUrl: t.detailUrl || null,
  };
}

function toLeadT247(t) {
  const id = `t247:${String(t.tender_id ?? t._id ?? "")}`;
  const company = String(t.organization_name || "Unknown Organisation");
  const loc = guessLocationT247(t);

  const published =
    parseMaybeDate(t.updatedAt) ||
    parseMaybeDate(t.ingestedAt) ||
    parseMaybeDate(t.createdAt) ||
    new Date();

  const urgency = computeUrgency({ closingDate: t.tender_endsubmission_datetime });
  const base = urgency === "High" ? 85 : urgency === "Medium" ? 70 : 55;
  const boost = (t.estimatedcost ? 5 : 0) + (t.requirement_workbrief ? 5 : 0);
  const lead_score = clamp(base + boost, 10, 99);

  const confidence = clamp(80 + (t.requirement_workbrief ? 5 : 0) + (t.estimatedcost ? 5 : 0), 30, 98);

  const website = "https://tender247.com";
  const sourceUrl = website;
  const title = String(t.requirement_workbrief || "Tender Opportunity");

  // Migrate old "new" status to "discovered"
  let status = t.status || "discovered";
  if (status === "new") status = "discovered";

  return {
    id,
    company_name: company,
    location: { city: loc.city, state: loc.state, region: loc.region },
    industry: "Tender247",
    website,
    company_size: "Unknown",
    lead_score,
    urgency,
    confidence,
    signals: [
      {
        type: "Tender247",
        keyword: title,
        source: sourceUrl,
        date: published.toISOString(),
        trust_score: 85,
        summary: title,
      },
    ],
    products_recommended: [
      {
        product_name: String(t.keyword_text || "Tender247 Tender"),
        confidence: 80,
        reason_code: `Tender247 tender_id=${String(t.tender_id ?? "")}`,
        estimated_volume: "TBD",
        margin_potential: urgency === "High" ? "High" : "Medium",
      },
    ],
    next_actions: {
      suggested_action: "WhatsApp + Email",
      timing: urgency === "High" ? "Within 24-48 hours" : "Within 7 days",
      context: `Review Tender247 tender. ID: ${String(t.tender_id ?? "N/A")}`,
      contact_trigger: "Tender detected on Tender247",
    },
    sales_owner: "Unassigned",
    field_officer: "Unassigned",
    status,
    notes: "",
    created_at: published.toISOString().slice(0, 10),
    
    // Tender247-specific fields
    reference: String(t.tender_id || ""),
    tenderId: String(t.tender_id || ""),
    contractType: null,
    formOfContract: null,
    tenderCategory: null,
    tenderType: null,
    publishedDateFull: null,
    docDownloadStartDate: null,
    docDownloadEndDate: null,
    bidSubmissionStartDate: null,
    bidSubmissionEndDate: t.tender_endsubmission_datetime || null,
    bidOpeningDateFull: null,
    openingDate: null,
    closingDate: t.tender_endsubmission_datetime || null,
    clarificationStartDate: null,
    clarificationEndDate: null,
    emdAmount: t.earnest_money_deposite ? String(t.earnest_money_deposite) : null,
    tenderFee: null,
    emdFeeType: null,
    emdExemptionAllowed: null,
    paymentMode: null,
    paymentInstruments: [],
    workLocation: t.site_location || null,
    periodOfWorkDays: null,
    bidValidityDays: null,
    numberOfCovers: null,
    productCategory: null,
    bidOpeningPlace: null,
    allowTwoStageBidding: null,
    allowPreferentialBidder: null,
    withdrawalAllowed: null,
    tenderFeeExemptionAllowed: null,
    generalTechnicalEvaluationAllowed: null,
    itemWiseTechnicalEvaluationAllowed: null,
    shouldAllowNDATender: null,
    ndaPreQualification: null,
    covers: [],
    nitDocuments: [],
    workItemDocuments: [],
    detailUrl: null,
  };
}

function computeMetricsFromLeads(leads) {
  const total = leads.length;
  const discovered = leads.filter((l) => l.status === "discovered").length;
  const assigned = leads.filter((l) => l.status === "assigned").length;
  const contacted = leads.filter((l) => l.status === "contacted").length;
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

  // Sector distribution (derive from lead.industry)
  const sectorAgg = new Map();
  for (const l of leads) {
    const sector = String(l.industry || "Unknown").trim() || "Unknown";
    const cur = sectorAgg.get(sector) || { count: 0, sumScore: 0 };
    cur.count += 1;
    cur.sumScore += Number(l.lead_score) || 0;
    sectorAgg.set(sector, cur);
  }
  const by_sector = [...sectorAgg.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([sector, v]) => ({
      sector,
      count: v.count,
      avg_score: v.count ? Math.round(v.sumScore / v.count) : 0,
    }));

  // State heatmap (best-effort; derives from lead.location.state)
  const states = new Map();
  const convertedByState = new Map();
  for (const l of leads) {
    const st = String(l.location?.state || "Unknown").trim() || "Unknown";
    states.set(st, (states.get(st) ?? 0) + 1);
    if (l.status === "converted") {
      convertedByState.set(st, (convertedByState.get(st) ?? 0) + 1);
    }
  }
  const by_state = [...states.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([state, count]) => {
      const conv = convertedByState.get(state) ?? 0;
      const rate = count ? `${Math.round((conv / count) * 100)}%` : "0%";
      return { state, count, conversion_rate: rate };
    });

  return {
    this_week: {
      leads_discovered: discovered,
      leads_assigned: assigned,
      leads_contacted: contacted,
      leads_accepted: accepted,
      leads_converted: converted,
      conversion_rate: conversionRate,
      avg_lead_score: avg,
    },
    this_month: {
      leads_discovered: discovered,
      leads_assigned: assigned,
      leads_contacted: contacted,
      leads_accepted: accepted,
      leads_converted: converted,
      conversion_rate: conversionRate,
      estimated_revenue: "TBD",
    },
    by_product,
    by_sector,
    by_region,
    by_state,
  };
}

function stripLargeTenderFields(t) {
  if (!t || typeof t !== "object") return t;
  const out = { ...t };
  // Avoid sending extremely heavy fields to the enrich service (keeps latency reasonable).
  const drop = [
    "html",
    "rawHtml",
    "pageHtml",
    "documents",
    "attachments",
    "files",
    "downloadedFiles",
    "pdfText",
    "rawResponse",
  ];
  for (const k of drop) {
    if (k in out) delete out[k];
  }
  return out;
}

const app = express();
app.use(express.json({ limit: "2mb" }));

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
    const T247 = await getT247TenderModel();

    // Pull from both sources (eProcure + Tender247), merge, then slice to requested limit.
    const [docsA, docsB] = await Promise.all([
      Tender.find({}).sort({ updatedAt: -1, createdAt: -1 }).limit(limit).lean(),
      T247.find({}).sort({ ingestedAt: -1, tender_id: -1 }).limit(limit).lean(),
    ]);

    const mappedA = (docsA || []).map((d) => {
      const lead = toLead(d);
      const sort =
        parseMaybeDate(d.updatedAt) ||
        parseMaybeDate(d.createdAt) ||
        parseMaybeDate(lead.created_at) ||
        new Date(0);
      return { lead, sortTs: sort.getTime() };
    });

    const mappedB = (docsB || []).map((d) => {
      const lead = toLeadT247(d);
      const sort =
        parseMaybeDate(d.ingestedAt) ||
        parseMaybeDate(d.updatedAt) ||
        parseMaybeDate(d.createdAt) ||
        parseMaybeDate(lead.created_at) ||
        new Date(0);
      return { lead, sortTs: sort.getTime() };
    });

    // Dedupe by lead.id (we prefix Tender247 ids, so collisions are unlikely)
    const seen = new Set();
    const merged = [...mappedA, ...mappedB]
      .sort((x, y) => y.sortTs - x.sortTs)
      .map((x) => x.lead)
      .filter((l) => {
        if (!l?.id) return false;
        if (seen.has(l.id)) return false;
        seen.add(l.id);
        return true;
      })
      .slice(0, limit);

    const leads = merged;
    const dashboard_metrics = computeMetricsFromLeads(leads);
    res.json({ leads, dashboard_metrics });
  } catch (err) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

app.get("/api/news-rss", async (req, res) => {
  try {
    const limit = clamp(Number(req.query.limit ?? 100), 1, 500);
    const q = String(req.query.q ?? "").trim();

    const News = await getNewsRssModel();

    /** @type {any} */
    const filter = {
      // Safety: older runs may have inserted docs with empty keywordsMatched; UI wants only matched.
      keywordsMatched: { $exists: true, $ne: [] },
    };

    if (q) {
      const re = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ title: re }, { description: re }, { content: re }, { source: re }, { channelTitle: re }];
    }

    const docs = await News.find(filter)
      .sort({ pubDate: -1, updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const items = docs.map((d) => ({
      id: String(d._id),
      dedupeKey: d.dedupeKey ?? null,
      title: d.title ?? null,
      link: d.link ?? null,
      guid: d.guid ?? null,
      description: d.description ?? null,
      content: d.content ?? null,
      pubDate: d.pubDate ?? null,
      pubDateRaw: d.pubDateRaw ?? null,
      source: d.source ?? null,
      feedUrl: d.feedUrl ?? null,
      channelTitle: d.channelTitle ?? null,
      keywordsMatched: Array.isArray(d.keywordsMatched) ? d.keywordsMatched : [],
      updatedAt: d.updatedAt ?? null,
      createdAt: d.createdAt ?? null,
    }));

    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
});

app.post("/api/enrich", async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ ok: false, error: "Missing JSON body" });
    }

    const leadId = String(body.lead_id ?? body.leadId ?? body.id ?? "").trim();
    const lead = body.lead && typeof body.lead === "object" ? body.lead : null;

    const enrichUrl = String(
      process.env.ENRICH_URL || "https://3wjb2fsn-8000.inc1.devtunnels.ms/enrich"
    ).trim();
    if (!enrichUrl) return res.status(500).json({ ok: false, error: "ENRICH_URL is not configured" });

    // Try to load the full tender doc so we can "pass all the data" for enrichment.
    /** @type {any} */
    let tender = null;
    if (leadId) {
      const Tender = await getTenderModel();
      if (/^[0-9a-fA-F]{24}$/.test(leadId)) {
        try {
          tender = await Tender.findById(leadId).lean();
        } catch {
          // ignore
        }
      }
      if (!tender) {
        tender = await Tender.findOne({ key: leadId }).lean();
      }
    }

    tender = stripLargeTenderFields(tender);

    const data = {
      lead_id: leadId || null,
      lead,
      computed_lead: tender ? toLead(tender) : lead,
      tender,
    };

    const ac = new AbortController();
    const timeoutMs = clamp(Number(process.env.ENRICH_TIMEOUT_MS ?? 60_000), 1000, 300_000);
    const t = setTimeout(() => ac.abort(), timeoutMs);

    let resp;
    try {
      resp = await fetch(enrichUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(t);
    }

    const text = await resp.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return res.status(502).json({
        ok: false,
        error: `Enricher returned non-JSON (status ${resp.status})`,
        raw: text?.slice?.(0, 2000) ?? "",
      });
    }

    if (!resp.ok) {
      return res.status(502).json({
        ok: false,
        error: `Enricher error (status ${resp.status})`,
        enrich: json,
      });
    }

    return res.json(json);
  } catch (err) {
    const msg =
      err?.name === "AbortError"
        ? `Enricher timed out (${clamp(Number(process.env.ENRICH_TIMEOUT_MS ?? 60_000), 1000, 300_000)}ms)`
        : err?.message ?? String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

app.post("/api/t247/sync", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Missing JSON payload" });
    }

    // Tender247 API requires search_by_location=true when filtering by state_ids
    if (payload.state_ids && !payload.search_by_location) {
      payload.search_by_location = true;
    }

    const apiResp = await searchTender247(payload);
    if (!apiResp?.Success) {
      return res.status(502).json({ error: "Tender247 API returned failure", api: apiResp });
    }

    const rows = Array.isArray(apiResp?.Data) ? apiResp.Data : [];
    const Tender = await getT247TenderModel();

    const now = new Date();
    const ops = [];
    for (const r of rows) {
      const { tender_id: _tid, ...rest } = r || {};
      const stateName = extractStateNameFromSiteLocation(r?.site_location);
      const stateInfo = lookupStateByName(stateName);

      ops.push({
        updateOne: {
          filter: { tender_id: Number(r.tender_id) },
          update: {
            $setOnInsert: {
              tender_id: Number(r.tender_id),
              source: "tender247",
              ingestedAt: now,
            },
            $set: {
              ...rest,
              keyword_id: payload.keyword_id != null ? Number(payload.keyword_id) : null,
              keyword_text: payload.keyword_text ? String(payload.keyword_text) : null,
              product_id: payload.product_id != null ? Number(payload.product_id) : null,
              search_text: payload.search_text ? String(payload.search_text) : null,
              refine_search_text: payload.refine_search_text ? String(payload.refine_search_text) : null,
              state_name: stateInfo?.state_name ?? (stateName || null),
              state_id: stateInfo?.state_id ?? null,
              statezone_id: stateInfo?.statezone_id ?? null,
              lastPayload: payload,
              updatedAt: now,
            },
          },
          upsert: true,
        },
      });
    }

    let writeRes = null;
    if (ops.length) {
      writeRes = await Tender.bulkWrite(ops, { ordered: false });
    }

    return res.json({
      ok: true,
      totalRecord: apiResp?.TotalRecord ?? rows.length,
      fetched: rows.length,
      upserted: writeRes?.upsertedCount ?? 0,
      modified: writeRes?.modifiedCount ?? 0,
      matched: writeRes?.matchedCount ?? 0,
      isAuthFailure: apiResp?.IsAuthFailure ?? null,
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
});

app.post("/api/t247/sync-state", async (req, res) => {
  try {
    const basePayload = req.body;
    if (!basePayload || typeof basePayload !== "object") {
      return res.status(400).json({ error: "Missing JSON payload" });
    }

    const stateId = Number(req.query.state_id ?? "");
    if (!Number.isFinite(stateId)) {
      return res.status(400).json({ error: "Provide ?state_id=<number>" });
    }

    const recordPerPage = clamp(Number(basePayload.record_per_page ?? 20), 1, 100);
    const maxPages = clamp(Number(req.query.max_pages ?? 5), 1, 200);
    const delayMs = clamp(Number(req.query.delay_ms ?? 150), 0, 5000);

    const Tender = await getT247TenderModel();
    const now = new Date();

    let fetched = 0;
    let upserted = 0;
    let modified = 0;
    const failures = [];

    for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
      const payload = {
        ...basePayload,
        search_by_location: true,
        state_ids: String(stateId),
        page_no: pageNo,
        record_per_page: recordPerPage,
      };

      let apiResp;
      try {
        apiResp = await searchTender247(payload);
      } catch (err) {
        failures.push({ state_id: stateId, page_no: pageNo, error: err?.message ?? String(err) });
        break;
      }

      if (!apiResp?.Success) {
        failures.push({ state_id: stateId, page_no: pageNo, error: "API returned failure", api: apiResp });
        break;
      }

      const rows = Array.isArray(apiResp?.Data) ? apiResp.Data : [];
      if (!rows.length) break;
      fetched += rows.length;

      const ops = [];
      for (const r of rows) {
        const { tender_id: _tid, ...rest } = r || {};
        const stateName = extractStateNameFromSiteLocation(r?.site_location);
        const stateInfo = lookupStateByName(stateName);

        ops.push({
          updateOne: {
            filter: { tender_id: Number(r.tender_id) },
            update: {
              $setOnInsert: {
                tender_id: Number(r.tender_id),
                source: "tender247",
                ingestedAt: now,
              },
              $set: {
                ...rest,
                keyword_id: payload.keyword_id != null ? Number(payload.keyword_id) : null,
                keyword_text: payload.keyword_text ? String(payload.keyword_text) : null,
                product_id: payload.product_id != null ? Number(payload.product_id) : null,
                search_text: payload.search_text ? String(payload.search_text) : null,
                refine_search_text: payload.refine_search_text ? String(payload.refine_search_text) : null,
                state_name: stateInfo?.state_name ?? (stateName || null),
                state_id: stateInfo?.state_id ?? stateId,
                statezone_id: stateInfo?.statezone_id ?? null,
                lastPayload: payload,
                updatedAt: now,
              },
            },
            upsert: true,
          },
        });
      }

      if (ops.length) {
        const wr = await Tender.bulkWrite(ops, { ordered: false });
        upserted += wr.upsertedCount ?? 0;
        modified += wr.modifiedCount ?? 0;
      }

      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    }

    return res.json({ ok: true, state_id: stateId, fetched, upserted, modified, failures });
  } catch (err) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
});

app.post("/api/t247/sync-all-states", async (req, res) => {
  try {
    const basePayload = req.body;
    if (!basePayload || typeof basePayload !== "object") {
      return res.status(400).json({ error: "Missing JSON payload" });
    }

    const recordPerPage = clamp(Number(basePayload.record_per_page ?? 20), 1, 100);
    const maxPages = clamp(Number(req.query.max_pages ?? 5), 1, 200);
    const delayMs = clamp(Number(req.query.delay_ms ?? 150), 0, 5000);

    const Tender = await getT247TenderModel();
    const now = new Date();

    let totalFetched = 0;
    let totalUpserted = 0;
    let totalModified = 0;
    let totalStatesHit = 0;
    const failures = [];

    for (const st of STATES) {
      totalStatesHit++;

      for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
        const payload = {
          ...basePayload,
          // Tender247 API errors if state_ids is provided but search_by_location=false
          search_by_location: true,
          state_ids: String(st.state_id),
          page_no: pageNo,
          record_per_page: recordPerPage,
        };

        let apiResp;
        try {
          apiResp = await searchTender247(payload);
        } catch (err) {
          failures.push({ state_id: st.state_id, page_no: pageNo, error: err?.message ?? String(err) });
          break;
        }

        if (!apiResp?.Success) {
          failures.push({ state_id: st.state_id, page_no: pageNo, error: "API returned failure", api: apiResp });
          break;
        }

        const rows = Array.isArray(apiResp?.Data) ? apiResp.Data : [];
        if (!rows.length) break; // done for this state

        totalFetched += rows.length;

        const ops = [];
        for (const r of rows) {
          const { tender_id: _tid, ...rest } = r || {};
          const stateName = extractStateNameFromSiteLocation(r?.site_location);
          const stateInfo = lookupStateByName(stateName) || st;

          ops.push({
            updateOne: {
              filter: { tender_id: Number(r.tender_id) },
              update: {
                $setOnInsert: {
                  tender_id: Number(r.tender_id),
                  source: "tender247",
                  ingestedAt: now,
                },
                $set: {
                  ...rest,
                  keyword_id: payload.keyword_id != null ? Number(payload.keyword_id) : null,
                  keyword_text: payload.keyword_text ? String(payload.keyword_text) : null,
                  product_id: payload.product_id != null ? Number(payload.product_id) : null,
                  search_text: payload.search_text ? String(payload.search_text) : null,
                  refine_search_text: payload.refine_search_text ? String(payload.refine_search_text) : null,
                  state_name: stateInfo?.state_name ?? (stateName || null),
                  state_id: stateInfo?.state_id ?? st.state_id,
                  statezone_id: stateInfo?.statezone_id ?? st.statezone_id,
                  lastPayload: payload,
                  updatedAt: now,
                },
              },
              upsert: true,
            },
          });
        }

        if (ops.length) {
          const wr = await Tender.bulkWrite(ops, { ordered: false });
          totalUpserted += wr.upsertedCount ?? 0;
          totalModified += wr.modifiedCount ?? 0;
        }

        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    return res.json({
      ok: true,
      states: STATES.length,
      fetched: totalFetched,
      upserted: totalUpserted,
      modified: totalModified,
      failures,
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
});

app.post("/api/t247/sync-keywords-all-states", async (req, res) => {
  try {
    const basePayload = req.body;
    if (!basePayload || typeof basePayload !== "object") {
      return res.status(400).json({ error: "Missing JSON payload" });
    }

    // This endpoint is for Tender247 keyword objects (keyword_id/product_id/etc).
    const keywords = Array.isArray(basePayload.keywords) ? basePayload.keywords : TENDER247_KEYWORDS;
    const recordPerPage = clamp(Number(basePayload.record_per_page ?? 20), 1, 100);
    const maxPages = clamp(Number(req.query.max_pages ?? 3), 1, 200);
    const delayMs = clamp(Number(req.query.delay_ms ?? 200), 0, 5000);

    const Tender = await getT247TenderModel();
    const now = new Date();

    let totalFetched = 0;
    let totalUpserted = 0;
    let totalModified = 0;
    let totalRuns = 0;
    const failures = [];

    for (const kw of keywords) {
      const keywordId = Number(kw?.keyword_id);
      const productId = kw?.product_id != null ? Number(kw.product_id) : null;
      const subIndustryId = kw?.sub_industry_id != null ? Number(kw.sub_industry_id) : null;
      const industryId = kw?.industry_id != null ? Number(kw.industry_id) : null;
      const keywordText = String(kw?.keyword_name || "").trim();

      if (!Number.isFinite(keywordId) || !keywordId) continue;

      for (const st of STATES) {
        for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
          const payload = {
            ...basePayload,
            // Tender247 API: if you use state_ids you must set search_by_location=true
            search_by_location: true,
            // Use Tender247 keyword id (string search_text was unreliable for specific terms)
            keyword_id: keywordId,
            keyword_text: keywordText || null,
            // Keep search_text empty by default; can be set by caller if desired.
            search_text: basePayload.search_text ? String(basePayload.search_text) : "",
            product_id: productId ?? basePayload.product_id ?? 0,
            sub_industry_id: subIndustryId ?? basePayload.sub_industry_id ?? 0,
            // Some payloads may not include industry_id; include if the API accepts it.
            ...(industryId != null ? { industry_id: industryId } : {}),
            state_ids: String(st.state_id),
            page_no: pageNo,
            record_per_page: recordPerPage,
          };

          let apiResp;
          try {
            totalRuns++;
            apiResp = await searchTender247(payload);
          } catch (err) {
            failures.push({ keyword: keywordText, state_id: st.state_id, page_no: pageNo, error: err?.message ?? String(err) });
            break;
          }

          if (!apiResp?.Success) {
            failures.push({ keyword: keywordText, state_id: st.state_id, page_no: pageNo, error: "API returned failure", api: apiResp });
            break;
          }

          const rows = Array.isArray(apiResp?.Data) ? apiResp.Data : [];
          if (!rows.length) break;

          totalFetched += rows.length;

          const ops = [];
          for (const r of rows) {
            const { tender_id: _tid, ...rest } = r || {};
            const stateName = extractStateNameFromSiteLocation(r?.site_location);
            const stateInfo = lookupStateByName(stateName) || st;

            ops.push({
              updateOne: {
                filter: { tender_id: Number(r.tender_id) },
                update: {
                  $setOnInsert: {
                    tender_id: Number(r.tender_id),
                    source: "tender247",
                    ingestedAt: now,
                  },
                  $set: {
                    ...rest,
                    keyword_id: keywordId,
                    keyword_text: keywordText || null,
                    product_id: productId,
                    search_text: payload.search_text ? String(payload.search_text) : null,
                    refine_search_text: payload.refine_search_text ? String(payload.refine_search_text) : null,
                    state_name: stateInfo?.state_name ?? (stateName || null),
                    state_id: stateInfo?.state_id ?? st.state_id,
                    statezone_id: stateInfo?.statezone_id ?? st.statezone_id,
                    lastPayload: payload,
                    updatedAt: now,
                  },
                },
                upsert: true,
              },
            });
          }

          if (ops.length) {
            const wr = await Tender.bulkWrite(ops, { ordered: false });
            totalUpserted += wr.upsertedCount ?? 0;
            totalModified += wr.modifiedCount ?? 0;
          }

          if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }

    return res.json({
      ok: true,
      keywords: keywords.length,
      states: STATES.length,
      runs: totalRuns,
      fetched: totalFetched,
      upserted: totalUpserted,
      modified: totalModified,
      failures,
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
});

app.get("/api/t247/tenders", async (req, res) => {
  try {
    const limit = clamp(Number(req.query.limit ?? 50), 1, 500);
    const page = clamp(Number(req.query.page ?? 1), 1, 10_000);
    const skip = (page - 1) * limit;

    /** @type {any} */
    const filter = {};
    if (req.query.state_id) {
      const ids = String(req.query.state_id)
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
      if (ids.length) filter.state_id = { $in: ids };
    }
    if (req.query.keyword) {
      const kw = String(req.query.keyword).trim();
      if (kw) filter.keyword_text = kw;
    }
    if (req.query.keyword_id) {
      const kid = Number(req.query.keyword_id);
      if (Number.isFinite(kid)) filter.keyword_id = kid;
    }
    if (req.query.tender_id) {
      const tid = Number(req.query.tender_id);
      if (Number.isFinite(tid)) filter.tender_id = tid;
    }

    const Tender = await getT247TenderModel();
    const items = await Tender.find(filter).sort({ ingestedAt: -1, tender_id: -1 }).skip(skip).limit(limit).lean();
    const total = await Tender.countDocuments(filter);

    return res.json({ ok: true, total, page, limit, items });
  } catch (err) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
});

app.post("/api/email/send", async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Missing JSON body" });
    }

    const to = body.to;
    const subject = body.subject;
    const message = body.message;
    const lead = body.lead;

    const out = await sendLeadEmail({ to, subject, message, lead });
    const emailId = out?.data?.id ?? null;

    if (!emailId) {
      const ts = new Date().toISOString();
      const errMsg = out?.error?.message ?? "Unknown error from Resend (no id returned)";
      console.error(
        `[email] failed ts=${ts} to=${String(to ?? "")} subject=${String(subject ?? "")} error=${String(errMsg)}`
      );
      return res.status(502).json({ ok: false, error: String(errMsg) });
    }

    const ts = new Date().toISOString();
    console.log(
      `[email] sent ts=${ts} to=${String(to ?? "")} subject=${String(subject ?? "")} id=${String(emailId)}`
    );

    // Update tender status to "contacted" if lead_id is provided
    if (lead && lead.id) {
      try {
        const Tender = await getTenderModel();
        await Tender.updateOne(
          { key: lead.id },
          { $set: { status: "contacted", updatedAt: new Date() } }
        );
      } catch (updateErr) {
        console.error(`[email] Failed to update status for lead ${lead.id}:`, updateErr);
      }
    }

    return res.json({ ok: true, id: emailId });
  } catch (err) {
    const ts = new Date().toISOString();
    const to = req?.body?.to;
    console.error(`[email] failed ts=${ts} to=${String(to ?? "")} error=${err?.message ?? String(err)}`);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.post("/api/whatsapp/send", async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ ok: false, error: "Missing JSON body" });
    }

    // Accept either `to` or `phone` for convenience.
    const to = String(body.to ?? body.phone ?? "").trim();
    if (!to) return res.status(400).json({ ok: false, error: "`to` is required (E.164 like +91...)" });

    // Optional overrides (otherwise env defaults are used)
    const from = body.from != null ? String(body.from).trim() : null;
    const contentSid = body.contentSid != null ? String(body.contentSid).trim() : null;
    let contentVariables = body.contentVariables ?? null; // object or string

    // If caller didn't provide variables, try to build a tender-focused message from lead info.
    const lead = body.lead && typeof body.lead === "object" ? body.lead : null;
    if (!contentVariables && lead) {
      const title =
        String(lead?.signals?.[0]?.keyword ?? lead?.company_name ?? lead?.id ?? "Tender").trim() || "Tender";
      const link = String(lead?.signals?.[0]?.source ?? lead?.website ?? "").trim();
      const ref = String(lead?.next_actions?.reference_number ?? lead?.tender_reference ?? "").trim();

      contentVariables = {
        "1": ref ? `${title} (${ref})` : title,
        "2": link || `${String(lead?.location?.city ?? "").trim()} ${String(lead?.location?.state ?? "").trim()}`.trim(),
      };
    }

    const out = await sendWhatsAppTemplateMessage({
      to,
      from: from || undefined,
      contentSid: contentSid || undefined,
      contentVariables: contentVariables || undefined,
    });

    const sid = out?.sid ?? null;
    if (!sid) {
      const ts = new Date().toISOString();
      console.error(`[whatsapp] failed ts=${ts} to=${to} error=no sid returned`, out);
      return res.status(502).json({ ok: false, error: "Twilio did not return message sid", twilio: out });
    }

    const ts = new Date().toISOString();
    console.log(`[whatsapp] sent ts=${ts} to=${to} sid=${sid}`);
    return res.json({ ok: true, sid, twilio: { status: out?.status ?? null } });
  } catch (err) {
    const ts = new Date().toISOString();
    const to = req?.body?.to ?? req?.body?.phone;
    console.error(`[whatsapp] failed ts=${ts} to=${String(to ?? "")} error=${err?.message ?? String(err)}`);
    const status = Number(err?.status);
    const http = Number.isFinite(status) ? status : 500;
    return res.status(http === 401 || http === 403 ? 502 : http).json({
      ok: false,
      error: err?.message ?? String(err),
      twilio: err?.twilio ?? null,
    });
  }
});

app.get("/api/officers", async (_req, res) => {
  try {
    const Officer = await getOfficerModel();
    const items = await Officer.find({}).sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.post("/api/officers", async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ ok: false, error: "Missing JSON body" });
    }

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = body.phone != null ? String(body.phone).trim() : null;
    const employee_id = body.employee_id != null ? String(body.employee_id).trim() : null;
    const designation = body.designation != null ? String(body.designation).trim() : null;
    const region = body.region != null ? String(body.region).trim() : null;

    if (!name) return res.status(400).json({ ok: false, error: "name is required" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "valid email is required" });
    }

    const Officer = await getOfficerModel();
    const now = new Date();

    const doc = await Officer.findOneAndUpdate(
      { email },
      {
        $setOnInsert: { createdAt: now },
        $set: { name, email, phone, employee_id, designation, region, updatedAt: now },
      },
      { upsert: true, new: true }
    ).lean();

    return res.json({ ok: true, item: doc });
  } catch (err) {
    // Handle duplicate email race
    if (String(err?.code) === "11000") {
      return res.status(409).json({ ok: false, error: "Officer with this email already exists" });
    }
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.delete("/api/officers/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "id is required" });

    const Officer = await getOfficerModel();
    const deleted = await Officer.findByIdAndDelete(id).lean();
    if (!deleted) return res.status(404).json({ ok: false, error: "Officer not found" });

    return res.json({ ok: true, deleted });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.get("/api/assignments", async (_req, res) => {
  try {
    const Assignment = await getAssignmentModel();
    const items = await Assignment.find({}).lean();
    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.post("/api/assignments", async (req, res) => {
  try {
    const body = req.body;
    const lead_id = String(body?.lead_id ?? "").trim();
    const officer_id = String(body?.officer_id ?? "").trim();

    if (!lead_id) return res.status(400).json({ ok: false, error: "lead_id is required" });
    if (!officer_id) return res.status(400).json({ ok: false, error: "officer_id is required" });

    // Verify officer exists
    const Officer = await getOfficerModel();
    const officer = await Officer.findById(officer_id).lean();
    if (!officer) return res.status(404).json({ ok: false, error: "Officer not found" });

    const Assignment = await getAssignmentModel();
    
    // Upsert: if assignment exists, update it; otherwise create new
    const assignment = await Assignment.findOneAndUpdate(
      { lead_id },
      {
        lead_id,
        officer_id,
        officer_name: officer.name,
        officer_email: officer.email,
        assigned_at: new Date(),
        assigned_by: "system",
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    // Update tender status to "assigned"
    const Tender = await getTenderModel();
    await Tender.updateOne(
      { key: lead_id },
      { $set: { status: "assigned", updatedAt: new Date() } }
    );

    return res.json({ ok: true, assignment });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.delete("/api/assignments/:leadId", async (req, res) => {
  try {
    const leadId = String(req.params.leadId || "").trim();
    if (!leadId) return res.status(400).json({ ok: false, error: "leadId is required" });

    const Assignment = await getAssignmentModel();
    const deleted = await Assignment.findOneAndDelete({ lead_id: leadId }).lean();
    if (!deleted) return res.status(404).json({ ok: false, error: "Assignment not found" });

    // Optionally revert tender status back to "discovered" when unassigned
    const Tender = await getTenderModel();
    await Tender.updateOne(
      { key: leadId },
      { $set: { status: "discovered", updatedAt: new Date() } }
    );

    return res.json({ ok: true, deleted });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

// ========== Status update endpoint ==========

app.patch("/api/leads/:leadId/status", async (req, res) => {
  try {
    const leadId = String(req.params.leadId || "").trim();
    const status = String(req.body?.status || "").trim();

    if (!leadId) return res.status(400).json({ ok: false, error: "leadId is required" });
    if (!status) return res.status(400).json({ ok: false, error: "status is required" });

    const validStatuses = ["discovered", "assigned", "contacted", "accepted", "rejected", "converted"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        ok: false, 
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` 
      });
    }

    const Tender = await getTenderModel();
    const updated = await Tender.findOneAndUpdate(
      { key: leadId },
      { $set: { status, updatedAt: new Date() } },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ ok: false, error: "Lead not found" });

    return res.json({ ok: true, lead: { id: updated.key, status: updated.status } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

// ========== Migration/Debug endpoint ==========

app.post("/api/migrate/status", async (req, res) => {
  try {
    const Tender = await getTenderModel();
    
    // Migrate "new" status to "discovered"
    const result = await Tender.updateMany(
      { $or: [{ status: "new" }, { status: { $exists: false } }] },
      { $set: { status: "discovered", updatedAt: new Date() } }
    );

    return res.json({ 
      ok: true, 
      migrated: result.modifiedCount,
      message: `Migrated ${result.modifiedCount} leads from "new" or null status to "discovered"` 
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

app.get("/api/debug/status-counts", async (req, res) => {
  try {
    const Tender = await getTenderModel();
    const T247 = await getT247TenderModel();
    
    const [eprocureCounts, t247Counts] = await Promise.all([
      Tender.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      T247.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    return res.json({ 
      ok: true, 
      eprocure: eprocureCounts,
      tender247: t247Counts
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});


