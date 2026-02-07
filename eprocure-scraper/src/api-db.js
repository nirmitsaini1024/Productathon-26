import mongoose from "mongoose";

let _connectPromise = null;
let _tenderModel = null;
let _t247TenderModel = null;

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

export async function closeDb() {
  _tenderModel = null;
  _t247TenderModel = null;
  _connectPromise = null;
  if (mongoose.connection?.readyState) {
    await mongoose.disconnect();
  }
}


