import mongoose from "mongoose";

let _connectPromise = null;
let _tenderModel = null;

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

export async function closeDb() {
  _tenderModel = null;
  _connectPromise = null;
  if (mongoose.connection?.readyState) {
    await mongoose.disconnect();
  }
}


