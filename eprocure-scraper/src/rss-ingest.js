import axios from "axios";
import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { RSS_FEEDS } from "./rss-feeds.js";

function normalizeText(s) {
  if (!s) return "";
  return String(s).replace(/\s+/g, " ").trim();
}

function safeDateFromRss(pubDateRaw) {
  const d = pubDateRaw ? new Date(pubDateRaw) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
}

export function compileKeywords(rawKeywords) {
  const kws = (rawKeywords || [])
    .map((k) => String(k || "").trim())
    .filter(Boolean)
    .map((k) => k.replace(/\s+/g, " "));

  // De-dupe, preserving order
  const out = [];
  const seen = new Set();
  for (const k of kws) {
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
}

export function matchKeywords({ keywords, title, description, content }) {
  const haystack = `${title || ""}\n${description || ""}\n${content || ""}`.toLowerCase();
  const matched = [];
  for (const kw of keywords || []) {
    const needle = String(kw).toLowerCase();
    if (!needle) continue;
    if (haystack.includes(needle)) matched.push(kw);
  }
  return matched;
}

export function parseRssXml({ xml, feedUrl, sourceHint }) {
  const $ = cheerio.load(xml, { xmlMode: true, decodeEntities: true });
  const channelTitle = normalizeText($("channel > title").first().text()) || null;

  const items = [];
  $("item").each((_, el) => {
    const $el = $(el);
    const title = normalizeText($el.find("title").first().text()) || null;
    const link = normalizeText($el.find("link").first().text()) || null;
    const guid = normalizeText($el.find("guid").first().text()) || null;
    const description = normalizeText($el.find("description").first().text()) || null;
    const content = normalizeText($el.find("content\\:encoded").first().text()) || null;
    const pubDateRaw = normalizeText($el.find("pubDate").first().text()) || null;
    const pubDate = safeDateFromRss(pubDateRaw);

    // Some feeds include <link/> empty but have <guid isPermaLink="true"> as URL.
    const linkFallback = !link && guid && /^https?:\/\//i.test(guid) ? guid : null;

    items.push({
      source: sourceHint || null,
      feedUrl,
      channelTitle,
      title,
      link: link || linkFallback,
      guid,
      description,
      content,
      pubDateRaw,
      pubDate,
    });
  });

  return { channelTitle, items };
}

export async function fetchRssXml(feedUrl) {
  const referer = (() => {
    try {
      return new URL(feedUrl).origin + "/";
    } catch {
      return undefined;
    }
  })();

  const res = await axios.get(feedUrl, {
    timeout: Number(process.env.RSS_TIMEOUT_MS || 20000),
    maxContentLength: 10 * 1024 * 1024,
    headers: {
      // Some publishers are picky; keep it normal and explicit.
      "User-Agent":
        process.env.RSS_USER_AGENT ||
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1",
      "Accept-Language": "en-IN,en;q=0.9",
      ...(referer ? { Referer: referer } : {}),
    },
    responseType: "text",
    validateStatus: (s) => s >= 200 && s < 300,
  });

  const xml = typeof res.data === "string" ? res.data : String(res.data || "");
  return xml;
}

export async function ingestRssFeeds({
  keywords,
  feeds = RSS_FEEDS,
  concurrency = Number(process.env.RSS_CONCURRENCY || 4),
} = {}) {
  const compiledKeywords = compileKeywords(keywords || []);
  const limit = pLimit(Math.max(1, concurrency));

  const out = {
    ok: true,
    keywords: compiledKeywords,
    feedsTotal: feeds.length,
    feedsOk: 0,
    feedsFailed: 0,
    itemsTotal: 0,
    itemsMatched: 0,
    errors: [],
    items: [],
    matchedItems: [],
  };

  const tasks = feeds.map((f) =>
    limit(async () => {
      try {
        const xml = await fetchRssXml(f.url);
        const parsed = parseRssXml({ xml, feedUrl: f.url, sourceHint: f.source });
        out.feedsOk += 1;
        out.itemsTotal += parsed.items.length;

        for (const item of parsed.items) {
          const matched = compiledKeywords.length
            ? matchKeywords({
                keywords: compiledKeywords,
                title: item.title,
                description: item.description,
                content: item.content,
              })
            : [];

          const annotated = { ...item, keywordsMatched: matched };
          out.items.push(annotated);
          if (!compiledKeywords.length || matched.length) {
            out.itemsMatched += 1;
            out.matchedItems.push(annotated);
          }
        }
      } catch (err) {
        out.feedsFailed += 1;
        out.errors.push({
          feedUrl: f.url,
          source: f.source,
          message: err?.message ?? String(err),
        });
      }
    })
  );

  await Promise.all(tasks);
  return out;
}


