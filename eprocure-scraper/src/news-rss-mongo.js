import mongoose from "mongoose";

let _connectPromise = null;
let _newsRssModel = null;
let _indexesEnsured = false;

function requireMongoUri() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set");
  return uri;
}

function getDbName() {
  return process.env.MONGO_DB || undefined;
}

function getCollectionName() {
  return process.env.NEWS_RSS_COLLECTION || "news_rss";
}

function modelNameForCollection(collectionName) {
  return `NewsRss__${collectionName.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

async function connect() {
  if (mongoose.connection?.readyState === 1) return mongoose;
  if (_connectPromise) return await _connectPromise;

  const uri = requireMongoUri();
  const dbName = getDbName();
  _connectPromise = mongoose.connect(uri, dbName ? { dbName } : {}).then(() => mongoose);
  return await _connectPromise;
}

function buildNewsRssSchema() {
  const { Schema } = mongoose;
  const schema = new Schema(
    {
      dedupeKey: { type: String, required: true },

      source: { type: String, default: null },
      feedUrl: { type: String, default: null },
      channelTitle: { type: String, default: null },

      guid: { type: String, default: null },
      link: { type: String, default: null },
      title: { type: String, default: null },
      description: { type: String, default: null },
      content: { type: String, default: null },
      pubDateRaw: { type: String, default: null },
      pubDate: { type: Date, default: null },

      keywordsMatched: { type: [String], default: [] },

      createdAt: { type: Date, default: Date.now },
      firstSeenAt: { type: Date, default: Date.now },
      lastSeenAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
    {
      // Keep it flexible (feeds sometimes add extra tags we may choose to persist later)
      strict: false,
      minimize: false,
    }
  );

  schema.index({ dedupeKey: 1 }, { unique: true, name: "uniq_dedupeKey" });
  schema.index({ pubDate: -1 }, { name: "pubDate_desc" });
  schema.index({ keywordsMatched: 1, pubDate: -1 }, { name: "keywords_pubDate" });
  schema.index({ updatedAt: -1 }, { name: "updatedAt_desc" });

  return schema;
}

async function getNewsRssModel() {
  if (_newsRssModel) return _newsRssModel;
  await connect();

  const collectionName = getCollectionName();
  const modelName = modelNameForCollection(collectionName);

  if (mongoose.models[modelName]) {
    _newsRssModel = mongoose.models[modelName];
    return _newsRssModel;
  }

  const schema = buildNewsRssSchema();
  _newsRssModel = mongoose.model(modelName, schema, collectionName);
  return _newsRssModel;
}

async function ensureIndexes(Model) {
  if (_indexesEnsured) return;
  await Model.createIndexes();
  _indexesEnsured = true;
}

export function isNewsRssMongoEnabled() {
  return Boolean(process.env.MONGO_URI);
}

export function dedupeKeyForNewsItem(item) {
  const guid = String(item?.guid || "").trim();
  if (guid) return `guid:${guid}`;
  const link = String(item?.link || "").trim();
  if (link) return `link:${link}`;
  const title = String(item?.title || "").trim();
  const pub = String(item?.pubDateRaw || "").trim();
  return `title_pub:${title}::${pub}`;
}

export async function persistNewsRssItems({ items } = {}) {
  if (!isNewsRssMongoEnabled()) return { ok: false, reason: "MONGO_URI not set" };
  if (!Array.isArray(items) || items.length === 0) return { ok: true, upserted: 0, modified: 0 };

  const insertOnly = process.env.MONGO_INSERT_ONLY === "1";
  const Model = await getNewsRssModel();
  await ensureIndexes(Model);

  const now = new Date();
  const ops = [];

  for (const it of items) {
    const dedupeKey = dedupeKeyForNewsItem(it);
    if (!dedupeKey) continue;

    const keywordsMatched = Array.isArray(it?.keywordsMatched) ? it.keywordsMatched.filter(Boolean) : [];
    const { keywordsMatched: _km, dedupeKey: _dk, ...rest } = it || {};

    // NOTE: Avoid MongoDB path conflicts by updating `keywordsMatched` in exactly ONE operator.
    // We store the computed matches for the current run (overwrite). This keeps writes simple and reliable.
    const update = insertOnly
      ? {
          $setOnInsert: {
            dedupeKey,
            createdAt: now,
            firstSeenAt: now,
            lastSeenAt: now,
            updatedAt: now,
            ...rest,
            keywordsMatched,
          },
        }
      : {
          $setOnInsert: {
            dedupeKey,
            createdAt: now,
            firstSeenAt: now,
          },
          $set: {
            ...rest,
            keywordsMatched,
            lastSeenAt: now,
            updatedAt: now,
          },
        };

    // Ensure dedupeKey is consistent if caller passed it
    if (update?.$setOnInsert?.dedupeKey && update.$setOnInsert.dedupeKey !== dedupeKey) {
      update.$setOnInsert.dedupeKey = dedupeKey;
    }

    ops.push({
      updateOne: {
        filter: { dedupeKey },
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

export async function closeNewsRssMongo() {
  _newsRssModel = null;
  _connectPromise = null;
  _indexesEnsured = false;
  if (mongoose.connection?.readyState) {
    await mongoose.disconnect();
  }
}


