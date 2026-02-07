import "dotenv/config";

import cors from "cors";
import express from "express";
import { getT247TenderModel, getTenderModel } from "./api-db.js";
import { extractStateNameFromSiteLocation, lookupStateByName, STATES } from "./state-map.js";
import { searchTender247 } from "./t247-client.js";
import { KEYWORDS } from "./keywords.js";
import { TENDER247_KEYWORDS } from "./tender247_keywords.js";
import { sendLeadEmail } from "./email.js";

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
    const docs = await Tender.find({}).sort({ updatedAt: -1, createdAt: -1 }).limit(limit).lean();
    const leads = docs.map(toLead);
    const dashboard_metrics = computeMetricsFromLeads(leads);
    res.json({ leads, dashboard_metrics });
  } catch (err) {
    res.status(500).json({ error: err?.message ?? String(err) });
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

    return res.json({ ok: true, id: emailId });
  } catch (err) {
    const ts = new Date().toISOString();
    const to = req?.body?.to;
    console.error(`[email] failed ts=${ts} to=${String(to ?? "")} error=${err?.message ?? String(err)}`);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});


