import fs from "fs";
import pLimit from "p-limit";
import { KEYWORDS } from "./keywords.js";
import { scrapeKeyword } from "./scraper.js";
import { jitter, safeFilename, sleep } from "./utils.js";

const limit = pLimit(1); // serial scraping (gov-site friendly)

function tenderKey(t) {
  return `${t.reference || ""}::${t.detailUrl || ""}`.trim();
}

function readJsonArrayIfExists(path) {
  try {
    if (!fs.existsSync(path)) return [];
    const raw = fs.readFileSync(path, "utf-8").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeUnique(existing, incoming) {
  const out = [];
  const seen = new Set();

  for (const t of existing) {
    const k = tenderKey(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  for (const t of incoming) {
    const k = tenderKey(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }

  return out;
}

async function run() {
  const reset = process.env.RESET === "1";

  // Start with previous combined results unless RESET=1
  const results = reset ? [] : readJsonArrayIfExists("output/tenders.json");
  const seen = new Set(results.map(tenderKey).filter(Boolean));
  const byKeyword = new Map(); // keyword -> tenders[]

  // Keyword selection (priority):
  // - CLI args: node src/index.js bitumen "road construction"
  // - env: KEYWORDS="bitumen,cement" node src/index.js
  // - default list in src/keywords.js
  const cliKeywords = process.argv.slice(2).map((s) => s.trim()).filter(Boolean);
  const envKeywords = process.env.KEYWORDS
    ? process.env.KEYWORDS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const keywords = cliKeywords.length ? cliKeywords : envKeywords.length ? envKeywords : KEYWORDS;

  const delayMs = Number(process.env.DELAY_MS ?? 3000);
  const scrapeDetails = process.env.SKIP_DETAILS !== "1"; // Allow skipping detail scraping via env var
  const downloadDocuments = process.env.DOWNLOAD_DOCS === "1"; // Enable document downloads via env var

  for (const keyword of keywords) {
    await limit(async () => {
      console.log(`Searching: ${keyword}${scrapeDetails ? ' (with details)' : ''}${downloadDocuments ? ' + docs' : ''}`);

      try {
        // Pass scrapeDetails and downloadDocuments options to scrapeKeyword to fetch details in same session
        const tenders = await scrapeKeyword(keyword, { 
          scrapeDetails, 
          downloadDocuments,
          outputDir: "output"
        });
        console.log(`  Found ${tenders.length} rows`);
        
        // Count how many have detail fields
        if (scrapeDetails) {
          const tendersWithDetails = tenders.filter(t => 
            Object.keys(t).some(k => !['keyword', 'publishedDate', 'closingDate', 'openingDate', 'title', 'reference', 'organisation', 'detailUrl'].includes(k))
          );
          console.log(`  Enriched ${tendersWithDetails.length}/${tenders.length} with detail data`);
          
          // Count documents downloaded
          if (downloadDocuments) {
            const totalDocs = tenders.reduce((sum, t) => {
              const nitDocs = t.nitDocuments?.filter(d => d.localPath)?.length || 0;
              const workDocs = t.workItemDocuments?.filter(d => d.localPath)?.length || 0;
              return sum + nitDocs + workDocs;
            }, 0);
            if (totalDocs > 0) {
              console.log(`  Downloaded ${totalDocs} documents`);
            }
          }
        }

        // Store per-keyword results (merge with existing per-keyword file unless RESET=1)
        const fname = safeFilename(keyword) + ".json";
        const perPath = `output/by-keyword/${fname}`;
        const existingPer = reset ? [] : readJsonArrayIfExists(perPath);
        const mergedPer = mergeUnique(existingPer, tenders);
        
        // Only store if there's data
        if (mergedPer.length > 0) {
          byKeyword.set(keyword, { path: perPath, tenders: mergedPer });
        }

        for (const t of tenders) {
          const key = tenderKey(t);
          if (!key) continue;
          if (seen.has(key)) continue;
          seen.add(key);
          results.push(t);
        }
      } catch (err) {
        console.error(`Failed for keyword "${keyword}": ${err?.message ?? err}`);
        // Still ensure a stable per-keyword file exists (keep existing unless RESET=1)
        const fname = safeFilename(keyword) + ".json";
        const perPath = `output/by-keyword/${fname}`;
        const existingPer = reset ? [] : readJsonArrayIfExists(perPath);
        
        // Only store if there's existing data
        if (!byKeyword.has(keyword) && existingPer.length > 0) {
          byKeyword.set(keyword, { path: perPath, tenders: existingPer });
        }
      }

      // Polite inter-keyword delay (plus jitter)
      await sleep(jitter(delayMs, 0.35));
    });
  }

  fs.mkdirSync("output", { recursive: true });
  fs.mkdirSync("output/by-keyword", { recursive: true });

  // Write per-keyword files (keyword-based filename) - only if they have data
  let savedKeywordFiles = 0;
  for (const [, payload] of byKeyword.entries()) {
    if (payload.tenders.length > 0) {
      fs.writeFileSync(
        payload.path,
        JSON.stringify(payload.tenders, null, 2),
        "utf-8"
      );
      savedKeywordFiles++;
    }
  }

  // Only write combined results if there's data
  if (results.length > 0) {
    fs.writeFileSync("output/tenders.json", JSON.stringify(results, null, 2), "utf-8");
    console.log(
      `Saved ${results.length} unique tenders to output/tenders.json` + (reset ? " (reset)" : " (merged)")
    );
  } else {
    console.log("No tenders found - output/tenders.json not created");
  }
  
  console.log(`Saved ${savedKeywordFiles} keyword files with data`);
}

run();


