import mongoose from "mongoose";

let _connectPromise = null;
let _tenderModel = null;
let _t247TenderModel = null;
let _officerModel = null;
let _newsRssModel = null;
let _assignmentModel = null;

async function connect() {
  if (mongoose.connection?.readyState === 1) return mongoose;
  if (_connectPromise) return await _connectPromise;

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set");

  const dbName = process.env.MONGO_DB || undefined;
  _connectPromise = mongoose.connect(uri, dbName ? { dbName } : {}).then(() => mongoose);
  return await _connectPromise;
}

/**
 * Same collection that the scraper writes to (default: tenders).
 * Uses strict:false so it can read any scraped fields.
 */
export async function getTenderModel() {
  if (_tenderModel) return _tenderModel;
  await connect();

  const collectionName = process.env.MONGO_COLLECTION || "tenders";
  const modelName = `Tender__${collectionName.replace(/[^a-zA-Z0-9_]/g, "_")}`;

  if (mongoose.models[modelName]) {
    _tenderModel = mongoose.models[modelName];
    return _tenderModel;
  }

  const { Schema } = mongoose;
  const schema = new Schema(
    {
      key: { type: String, required: true },
      reference: { type: String, default: null },
      detailUrl: { type: String, default: null },
      keywords: { type: [String], default: [] },
      lastKeyword: { type: String, default: null },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
    { strict: false, minimize: false }
  );

  schema.index({ key: 1 }, { unique: true, name: "uniq_key" });
  schema.index({ updatedAt: -1 }, { name: "updatedAt_desc" });

  _tenderModel = mongoose.model(modelName, schema, collectionName);
  return _tenderModel;
}

/**
 * Dedicated collection for Tender247 items (separate from eprocure tenders).
 * Default: t247_tenders
 */
export async function getT247TenderModel() {
  if (_t247TenderModel) return _t247TenderModel;
  await connect();

  const collectionName = process.env.T247_MONGO_COLLECTION || "t247_tenders";
  const modelName = `T247Tender__${collectionName.replace(/[^a-zA-Z0-9_]/g, "_")}`;

  if (mongoose.models[modelName]) {
    _t247TenderModel = mongoose.models[modelName];
    return _t247TenderModel;
  }

  const { Schema } = mongoose;
  const schema = new Schema(
    {
      tender_id: { type: Number, required: true },
      requirement_workbrief: { type: String, default: null },
      estimatedcost: { type: Number, default: null },
      tender_endsubmission_datetime: { type: String, default: null },
      site_location: { type: String, default: null },
      organization_name: { type: String, default: null },
      earnest_money_deposite: { type: Number, default: null },
      doc_uploaded: { type: Boolean, default: null },
      ai_summary: { type: Boolean, default: null },

      // Derived (for filtering)
      state_name: { type: String, default: null },
      state_id: { type: Number, default: null },
      statezone_id: { type: Number, default: null },

      // Search context (which keyword produced this record)
      keyword_id: { type: Number, default: null },
      keyword_text: { type: String, default: null },
      product_id: { type: Number, default: null },
      search_text: { type: String, default: null },
      refine_search_text: { type: String, default: null },

      // Metadata
      source: { type: String, default: "tender247" },
      ingestedAt: { type: Date, default: Date.now },
      lastPayload: { type: Schema.Types.Mixed, default: null },
    },
    { strict: false, minimize: false }
  );

  schema.index({ tender_id: 1 }, { unique: true, name: "uniq_tender_id" });
  schema.index({ state_id: 1, ingestedAt: -1 }, { name: "state_ingestedAt" });
  schema.index({ keyword_id: 1, state_id: 1, ingestedAt: -1 }, { name: "keyword_state_ingestedAt" });
  schema.index({ keyword_text: 1, state_id: 1, ingestedAt: -1 }, { name: "keywordText_state_ingestedAt" });
  schema.index({ ingestedAt: -1 }, { name: "ingestedAt_desc" });

  _t247TenderModel = mongoose.model(modelName, schema, collectionName);
  return _t247TenderModel;
}

/**
 * Officers onboarded in the HPCL UI.
 * Default: officers
 */
export async function getOfficerModel() {
  if (_officerModel) return _officerModel;
  await connect();

  const collectionName = process.env.OFFICERS_MONGO_COLLECTION || "officers";
  const modelName = `Officer__${collectionName.replace(/[^a-zA-Z0-9_]/g, "_")}`;

  if (mongoose.models[modelName]) {
    _officerModel = mongoose.models[modelName];
    return _officerModel;
  }

  const { Schema } = mongoose;
  const schema = new Schema(
    {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, default: null },
      employee_id: { type: String, default: null },
      designation: { type: String, default: null },
      region: { type: String, default: null },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
    { strict: true, minimize: true }
  );

  schema.index({ email: 1 }, { unique: true, name: "uniq_email" });
  schema.index({ createdAt: -1 }, { name: "createdAt_desc" });

  _officerModel = mongoose.model(modelName, schema, collectionName);
  return _officerModel;
}

/**
 * News RSS items ingested by src/rss-index.js into collection "news_rss" (default).
 * Only matched items are expected, but the API can also filter out empty keywordsMatched.
 */
export async function getNewsRssModel() {
  if (_newsRssModel) return _newsRssModel;
  await connect();

  const collectionName = process.env.NEWS_RSS_COLLECTION || "news_rss";
  const modelName = `NewsRss__${collectionName.replace(/[^a-zA-Z0-9_]/g, "_")}`;

  if (mongoose.models[modelName]) {
    _newsRssModel = mongoose.models[modelName];
    return _newsRssModel;
  }

  const { Schema } = mongoose;
  const schema = new Schema(
    {
      dedupeKey: { type: String, required: true },
      title: { type: String, default: null },
      link: { type: String, default: null },
      guid: { type: String, default: null },
      description: { type: String, default: null },
      content: { type: String, default: null },
      pubDate: { type: Date, default: null },
      pubDateRaw: { type: String, default: null },
      source: { type: String, default: null },
      feedUrl: { type: String, default: null },
      channelTitle: { type: String, default: null },
      keywordsMatched: { type: [String], default: [] },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
    { strict: false, minimize: false }
  );

  schema.index({ dedupeKey: 1 }, { unique: true, name: "uniq_dedupeKey" });
  schema.index({ pubDate: -1 }, { name: "pubDate_desc" });
  schema.index({ updatedAt: -1 }, { name: "updatedAt_desc" });

  _newsRssModel = mongoose.model(modelName, schema, collectionName);
  return _newsRssModel;
}

/**
 * Lead-to-Officer assignments for tracking which officer is handling which lead.
 * Default: assignments
 */
export async function getAssignmentModel() {
  if (_assignmentModel) return _assignmentModel;
  await connect();

  const collectionName = process.env.ASSIGNMENTS_MONGO_COLLECTION || "assignments";
  const modelName = `Assignment__${collectionName.replace(/[^a-zA-Z0-9_]/g, "_")}`;

  if (mongoose.models[modelName]) {
    _assignmentModel = mongoose.models[modelName];
    return _assignmentModel;
  }

  const { Schema } = mongoose;
  const schema = new Schema(
    {
      lead_id: { type: String, required: true },
      officer_id: { type: String, required: true },
      officer_name: { type: String, required: true },
      officer_email: { type: String, required: true },
      assigned_at: { type: Date, default: Date.now },
      assigned_by: { type: String, default: "system" },
    },
    { strict: true, minimize: true }
  );

  schema.index({ lead_id: 1 }, { unique: true, name: "uniq_lead_id" });
  schema.index({ officer_id: 1, assigned_at: -1 }, { name: "officer_assignedAt" });
  schema.index({ assigned_at: -1 }, { name: "assignedAt_desc" });

  _assignmentModel = mongoose.model(modelName, schema, collectionName);
  return _assignmentModel;
}

export async function closeDb() {
  _tenderModel = null;
  _t247TenderModel = null;
  _officerModel = null;
  _newsRssModel = null;
  _assignmentModel = null;
  _connectPromise = null;
  if (mongoose.connection?.readyState) {
    await mongoose.disconnect();
  }
}


