import mongoose from "mongoose";
import { safeFilename } from "./utils.js";

/**
 * Mongo persistence strategy:
 * - Default: one collection (MONGO_MODE=single) with a keywords[] array to avoid duplicates across keywords.
 * - Optional: per-keyword collections (MONGO_MODE=per_keyword) for strict separation.
 *
 * Env:
 * - MONGO_URI (required to enable)
 * - MONGO_DB (optional; falls back to db in URI or "test")
 * - MONGO_COLLECTION (optional; default: "tenders")
 * - MONGO_MODE ("single" | "per_keyword") default: "single"
 * - MONGO_INSERT_ONLY=1 (optional) only inserts new docs, never updates existing docs
 */

let _connectPromise = null;
let _modelsByCollection = new Map(); // collectionName -> mongoose.Model
let _indexesEnsuredFor = new Set(); // modelName

function requireMongoUri() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set");
  return uri;
}

function getDbName() {
  return process.env.MONGO_DB || undefined;
}

function getBaseCollectionName() {
  return process.env.MONGO_COLLECTION || "tenders";
}

function getMode() {
  const raw = String(process.env.MONGO_MODE || "single").trim().toLowerCase();
  return raw === "per_keyword" ? "per_keyword" : "single";
}

function tenderKey(t) {
  return `${t?.reference || ""}::${t?.detailUrl || ""}`.trim();
}

function collectionNameForKeyword(keyword) {
  const base = getBaseCollectionName();
  if (getMode() === "per_keyword") {
    // collection names can't contain some chars; safeFilename is conservative.
    const suffix = safeFilename(keyword || "keyword", { maxLen: 60 });
    return `${base}__${suffix}`;
  }
  return base;
}

async function getClient() {
  if (mongoose.connection?.readyState === 1) return mongoose;
  if (_connectPromise) return await _connectPromise;

  const uri = requireMongoUri();
  const dbName = getDbName();
  _connectPromise = mongoose
    .connect(uri, dbName ? { dbName } : {})
    .then(() => mongoose);

  return await _connectPromise;
}

function modelNameForCollection(collectionName) {
  // Mongoose model names are global on the connection; keep it deterministic.
  return `Tender__${collectionName.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function buildTenderSchema() {
  const { Schema } = mongoose;
  const tenderSchema = new Schema(
    {
      key: { type: String, required: true },
      source: { type: String, default: "eprocure" },
      reference: { type: String, default: null },
      detailUrl: { type: String, default: null },
      keywords: { type: [String], default: [] },
      createdAt: { type: Date, default: Date.now },
      firstSeenAt: { type: Date, default: Date.now },
      lastSeenAt: { type: Date, default: Date.now },
      lastKeyword: { type: String, default: null },
      updatedAt: { type: Date, default: Date.now },
    },
    {
      // Keep it flexible: store arbitrary scraped fields without having to update the schema.
      strict: false,
      minimize: false,
    }
  );

  // Primary dedupe key.
  tenderSchema.index({ key: 1 }, { unique: true, name: "uniq_key" });
  // Helpful query patterns.
  tenderSchema.index({ keywords: 1, closingDate: 1 }, { name: "keywords_closingDate" });
  tenderSchema.index({ updatedAt: -1 }, { name: "updatedAt_desc" });

  return tenderSchema;
}

async function getTenderModelForKeyword(keyword) {
  await getClient();
  const collectionName = collectionNameForKeyword(keyword);
  const existing = _modelsByCollection.get(collectionName);
  if (existing) return existing;

  const modelName = modelNameForCollection(collectionName);
  const schema = buildTenderSchema();

  // 3rd arg forces the underlying collection name.
  const Model = mongoose.model(modelName, schema, collectionName);
  _modelsByCollection.set(collectionName, Model);
  return Model;
}

async function ensureIndexesForModel(Model) {
  if (_indexesEnsuredFor.has(Model.modelName)) return;
  await Model.createIndexes();
  _indexesEnsuredFor.add(Model.modelName);
}

export function isMongoEnabled() {
  return Boolean(process.env.MONGO_URI);
}

export async function mongoResetForKeywords(keywords) {
  const mode = getMode();

  if (mode === "single") {
    const Model = await getTenderModelForKeyword("");
    await ensureIndexesForModel(Model);
    await Model.deleteMany({});
    return;
  }

  // per_keyword
  for (const kw of keywords || []) {
    const Model = await getTenderModelForKeyword(kw);
    await ensureIndexesForModel(Model);
    await Model.deleteMany({});
  }
}

export async function persistTenders({ keyword, tenders }) {
  if (!isMongoEnabled()) return { ok: false, reason: "MONGO_URI not set" };
  if (!Array.isArray(tenders) || tenders.length === 0) return { ok: true, upserted: 0, modified: 0 };

  const insertOnly = process.env.MONGO_INSERT_ONLY === "1";
  const Model = await getTenderModelForKeyword(keyword);
  await ensureIndexesForModel(Model);

  const now = new Date();
  const ops = [];

  for (const t of tenders) {
    const key = tenderKey(t);
    if (!key) continue;

    // Avoid letting the scraped "keyword" field overwrite multi-keyword state in DB.
    const { keyword: _scrapedKeyword, keywords: _keywords, ...rest } = t || {};

    const update = insertOnly
      ? {
          // Insert-only mode: never update existing docs; only insert if missing.
          $setOnInsert: {
            key,
            source: "eprocure",
            reference: t?.reference ?? null,
            detailUrl: t?.detailUrl ?? null,
            createdAt: now,
            firstSeenAt: now,
            ...(keyword ? { keywords: [keyword] } : {}),
            ...rest,
          },
        }
      : {
          // Default: upsert + update existing (still deduped by unique key)
          $setOnInsert: {
            key,
            source: "eprocure",
            reference: t?.reference ?? null,
            detailUrl: t?.detailUrl ?? null,
            createdAt: now,
            firstSeenAt: now,
          },
          $set: {
            ...rest,
            lastSeenAt: now,
            lastKeyword: keyword || null,
            updatedAt: now,
          },
          $addToSet: keyword ? { keywords: keyword } : {},
        };

    ops.push({
      updateOne: {
        filter: { key },
        update,
        upsert: true,
      },
    });
  }

  if (!ops.length) return { ok: true, upserted: 0, modified: 0 };

  const res = await Model.bulkWrite(ops, { ordered: false });
  return {
    ok: true,
    upserted: res.upsertedCount || 0,
    modified: res.modifiedCount || 0,
    matched: res.matchedCount || 0,
    collection: Model.collection.name,
  };
}

export async function closeMongo() {
  if (mongoose.connection?.readyState) {
    await mongoose.disconnect();
  }
  _connectPromise = null;
  _modelsByCollection = new Map();
  _indexesEnsuredFor = new Set();
}


