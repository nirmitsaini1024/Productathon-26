import "dotenv/config";
import { ingestRssFeeds } from "./rss-ingest.js";
import { closeNewsRssMongo, isNewsRssMongoEnabled, persistNewsRssItems } from "./news-rss-mongo.js";
import { KEYWORDS } from "./keywords.js";

function readKeywordsFromEnv() {
  const raw =
    process.env.NEWS_KEYWORDS ||
    process.env.RSS_KEYWORDS ||
    process.env.KEYWORDS || // fallback for convenience
    "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function run() {
  // Keyword selection (priority):
  // - CLI args: node src/rss-index.js "hpcl" "diesel"
  // - env: NEWS_KEYWORDS="hpcl,diesel"
  const cliKeywords = process.argv.slice(2).map((s) => s.trim()).filter(Boolean);
  const envKeywords = readKeywordsFromEnv();
  const keywords = cliKeywords.length ? cliKeywords : envKeywords.length ? envKeywords : KEYWORDS;

  const res = await ingestRssFeeds({ keywords });
  console.log(
    `RSS: feeds_ok=${res.feedsOk}/${res.feedsTotal} feeds_failed=${res.feedsFailed} items_total=${res.itemsTotal} matched=${res.itemsMatched}`
  );

  if (res.errors?.length) {
    console.warn("Some feeds failed:");
    for (const e of res.errors.slice(0, 10)) {
      console.warn(`  - ${e.source || "feed"} (${e.feedUrl}): ${e.message}`);
    }
    if (res.errors.length > 10) console.warn(`  ... and ${res.errors.length - 10} more`);
  }

  const dryRun = process.env.RSS_DRY_RUN === "1";
  if (dryRun) {
    console.log(`RSS_DRY_RUN=1 set — skipping Mongo writes. Matched items: ${res.matchedItems.length}`);
    return;
  }

  if (!isNewsRssMongoEnabled()) {
    console.log("Mongo disabled (MONGO_URI not set) — skipping Mongo writes.");
    return;
  }

  // Always store ONLY matched items (keywordsMatched.length > 0)
  const itemsToStore = res.matchedItems;
  if (!itemsToStore.length) {
    console.log("No matched items — skipping Mongo writes.");
    return;
  }

  const writeRes = await persistNewsRssItems({ items: itemsToStore });
  if (writeRes?.ok) {
    const col = writeRes.collection ? ` (${writeRes.collection})` : "";
    console.log(`Mongo(news_rss): upserted=${writeRes.upserted} modified=${writeRes.modified}${col}`);
  }

  await closeNewsRssMongo();
}

run();


