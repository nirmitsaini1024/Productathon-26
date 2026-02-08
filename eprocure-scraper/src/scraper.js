import axios from "axios";
import { load } from "cheerio";
import qs from "qs";
import { parseTenderList, parseTenderDetail } from "./parser.js";
import { absUrl, jitter, normalizeSpace, sleep } from "./utils.js";

const BASE_URL = "https://eprocure.gov.in/eprocure/app";

class SimpleCookieJar {
  constructor() {
    /** @type {Map<string, string>} */
    this.cookies = new Map(); // name -> value
  }

  absorbSetCookie(setCookieHeaders) {
    if (!setCookieHeaders) return;
    const headers = Array.isArray(setCookieHeaders)
      ? setCookieHeaders
      : [setCookieHeaders];

    for (const h of headers) {
      const first = String(h).split(";")[0];
      const eqIdx = first.indexOf("=");
      if (eqIdx <= 0) continue;
      const name = first.slice(0, eqIdx).trim();
      const value = first.slice(eqIdx + 1).trim();
      if (!name) continue;
      this.cookies.set(name, value);
    }
  }

  headerValue() {
    if (!this.cookies.size) return "";
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

function createHttpClient() {
  const jar = new SimpleCookieJar();
  const client = axios.create({
    timeout: 30_000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/x-www-form-urlencoded",
      Connection: "keep-alive",
    },
    validateStatus: () => true,
  });

  client.interceptors.request.use((config) => {
    const cookie = jar.headerValue();
    if (cookie) {
      config.headers = config.headers ?? {};
      config.headers.Cookie = cookie;
    }
    return config;
  });

  client.interceptors.response.use((res) => {
    jar.absorbSetCookie(res.headers?.["set-cookie"]);
    return res;
  });

  return client;
}

function findAdvancedSearchUrl(homeHtml) {
  const $ = load(homeHtml);
  const candidates = $("a[href]").toArray();

  for (const a of candidates) {
    const $a = $(a);
    const href = $a.attr("href");
    const text = normalizeSpace($a.text()).toLowerCase();
    if (!href) continue;
    if (text.includes("advanced") && text.includes("search")) return absUrl(BASE_URL, href);
    if (/FrontEndAdvancedSearch/i.test(href)) return absUrl(BASE_URL, href);
    if (/AdvancedSearch/i.test(href) && /component=/.test(href)) return absUrl(BASE_URL, href);
  }

  // Fallback: some deployments land on Advanced Search by component name.
  return BASE_URL;
}

function serializeForm($, $form) {
  /** @type {Record<string, string>} */
  const data = {};

  $form.find("input, select, textarea").each((_, el) => {
    const $el = $(el);
    const name = $el.attr("name");
    if (!name) return;

    const tag = (el.tagName || "").toLowerCase();
    if (tag === "select") {
      const $sel = $el.find("option:selected").first();
      const val = $sel.length ? ($sel.attr("value") ?? $sel.text()) : "";
      data[name] = String(val ?? "");
      return;
    }

    if (tag === "textarea") {
      data[name] = String($el.text() ?? "");
      return;
    }

    const type = String($el.attr("type") ?? "").toLowerCase();
    if (type === "checkbox" || type === "radio") {
      if (!$el.is(":checked")) return;
      data[name] = String($el.attr("value") ?? "on");
      return;
    }

    // Most importantly: include ALL hidden fields (tapestry state)
    data[name] = String($el.attr("value") ?? "");
  });

  return data;
}

function pickSubmitControl($, $form) {
  // Try to emulate a user clicking the primary "Search" submit.
  const submits = $form.find('input[type="submit"][name], button[type="submit"][name]').toArray();
  if (!submits.length) return null;

  const score = (el) => {
    const $el = $(el);
    const name = String($el.attr("name") ?? "");
    const value = normalizeSpace($el.attr("value") ?? $el.text()).toLowerCase();
    let s = 0;
    if (value.includes("search")) s += 10;
    if (name.toLowerCase().includes("search")) s += 5;
    if (/if_\d+/i.test(name)) s += 2; // common tapestry ids
    return s;
  };

  submits.sort((a, b) => score(b) - score(a));
  const $best = $(submits[0]);
  const name = $best.attr("name");
  if (!name) return null;
  const value = $best.attr("value") ?? "1";
  return { name, value: String(value) };
}

function injectKeyword($, $form, formData, keyword) {
  // Prefer the known field name. Otherwise fall back to first visible text input.
  if ($form.find('input[name="SearchDescription"]').length) {
    formData.SearchDescription = keyword;
    return;
  }

  const textInput = $form
    .find('input[type="text"][name], input:not([type])[name]')
    .filter((_, el) => !String($(el).attr("name")).startsWith("t:"))
    .first();

  const name = textInput.attr("name");
  if (name) {
    formData[name] = keyword;
  } else {
    // As a last resort, set the common name anyway.
    formData.SearchDescription = keyword;
  }
}

function injectTenderTypeIfMissing(formData) {
  // Server-side validation requires TenderType on FrontEndAdvancedSearch.
  // Observed options: 1 = Open Tender, 2 = Limited Tender.
  if (!("TenderType" in formData) || String(formData.TenderType || "").trim() === "" || formData.TenderType === "0") {
    formData.TenderType = "1";
  }
}

function detectServerError(html) {
  const $ = load(html);
  const text = normalizeSpace(
    [
      $(".error, .errormsg, #error, .validationError").text(),
      $("body").text(),
    ].join(" ")
  );

  const known = [
    "Please Select Tender Type",
    "Invalid Captcha",
    "Please enter Captcha",
    "Session expired",
  ];
  for (const msg of known) {
    if (text.includes(msg)) return msg;
  }
  return null;
}

async function httpGetWithRetry(client, url, { maxRetries = 3 } = {}) {
  let attempt = 0;
  while (true) {
    attempt++;
    let res;
    try {
      res = await client.get(url);
    } catch (err) {
      const retryableCodes = new Set(["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"]);
      const code = err?.code;
      if (attempt <= maxRetries && retryableCodes.has(code)) {
        await sleep(jitter(4000 * attempt, 0.4));
        continue;
      }
      throw err;
    }
    if (res.status >= 200 && res.status < 300) return res;

    const retryable = [429, 500, 502, 503, 504].includes(res.status);
    if (!retryable || attempt > maxRetries) {
      throw new Error(`GET ${url} failed: HTTP ${res.status}`);
    }
    await sleep(jitter(4000 * attempt, 0.4));
  }
}

async function httpPostWithRetry(client, url, body, { maxRetries = 3 } = {}) {
  let attempt = 0;
  while (true) {
    attempt++;
    let res;
    try {
      res = await client.post(url, body);
    } catch (err) {
      const retryableCodes = new Set(["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"]);
      const code = err?.code;
      if (attempt <= maxRetries && retryableCodes.has(code)) {
        await sleep(jitter(5000 * attempt, 0.4));
        continue;
      }
      throw err;
    }
    if (res.status >= 200 && res.status < 300) return res;

    const retryable = [429, 500, 502, 503, 504].includes(res.status);
    if (!retryable || attempt > maxRetries) {
      throw new Error(`POST ${url} failed: HTTP ${res.status}`);
    }
    await sleep(jitter(5000 * attempt, 0.4));
  }
}

async function submitHomeTenderSearch(client, homeHtml, keyword) {
  const $ = load(homeHtml);
  const $form = $("form#tenderSearch").length
    ? $("form#tenderSearch")
    : $("form").filter((_, f) => $(f).find('input[name="SearchDescription"]').length).first();

  if (!$form.length) {
    throw new Error("Home tender search form not found");
  }

  const action = absUrl(BASE_URL, $form.attr("action") ?? BASE_URL);
  if (!action) throw new Error("Home tender search form action not found");

  const formData = serializeForm($, $form);
  formData.SearchDescription = keyword;

  // Emulate clicking "Go" (observed: submitname=Go and Go=Go)
  if ("submitname" in formData) formData.submitname = "Go";
  if ("Go" in formData) formData.Go = formData.Go || "Go";

  const payload = qs.stringify(formData, { encodeValuesOnly: true });
  const res = await httpPostWithRetry(client, action, payload);

  const errMsg = detectServerError(res.data);
  if (errMsg) throw new Error(`Server validation: ${errMsg}`);

  return res.data;
}

export async function scrapeKeyword(keyword, options = {}) {
  const { scrapeDetails = true, downloadDocuments = false, outputDir = "output" } = options;
  const client = createHttpClient();

  // Step 1: Load homepage (sets initial session cookies)
  const homeRes = await httpGetWithRetry(client, BASE_URL);
  await sleep(jitter(900, 0.3));

  let tenders = [];

  // Preferred: Advanced Search (richer filtering), but it can be captcha-gated.
  try {
    const advUrl = findAdvancedSearchUrl(homeRes.data);
    const advRes = await httpGetWithRetry(client, advUrl);
    await sleep(jitter(900, 0.3));

    const $ = load(advRes.data);
    const $form = $("form#TenderAdvancedSearch").length
      ? $("form#TenderAdvancedSearch")
      : $("form").first();

    if (!$form.length) throw new Error("Advanced Search form not found");

    const action = absUrl(advUrl, $form.attr("action") ?? BASE_URL);
    const method = String($form.attr("method") ?? "post").toLowerCase();
    if (method !== "post") throw new Error(`Unexpected form method: ${method}`);

    const formData = serializeForm($, $form);
    if ("workItemTitle" in formData) formData.workItemTitle = keyword;
    else injectKeyword($, $form, formData, keyword);
    injectTenderTypeIfMissing(formData);

    const submit = pickSubmitControl($, $form);
    if (submit && !(submit.name in formData)) formData[submit.name] = submit.value;
    if ("submitname" in formData && submit?.name) formData.submitname = submit.name;

    const payload = qs.stringify(formData, { encodeValuesOnly: true });
    const res = await httpPostWithRetry(client, action, payload);

    const errMsg = detectServerError(res.data);
    if (errMsg) {
      const e = new Error(`Server validation: ${errMsg}`);
      if (/captcha/i.test(errMsg)) e.code = "CAPTCHA";
      throw e;
    }

    tenders = parseTenderList(res.data, keyword);
  } catch (err) {
    // Fallback: home tender search (observed to work without captcha more often).
    if (err?.code === "CAPTCHA" || /captcha/i.test(String(err?.message ?? ""))) {
      const html = await submitHomeTenderSearch(client, homeRes.data, keyword);
      tenders = parseTenderList(html, keyword);
    } else {
      throw err;
    }
  }

  // Step 2: Scrape details for each tender if requested
  if (scrapeDetails && tenders.length > 0) {
    console.log(`  Fetching details for ${tenders.length} tenders...`);
    
    for (let i = 0; i < tenders.length; i++) {
      const tender = tenders[i];
      
      try {
        // Add a small delay between detail requests to be polite
        if (i > 0) {
          await sleep(jitter(2000, 0.3));
        }
        
        // Fetch the detail page
        const detailRes = await httpGetWithRetry(client, tender.detailUrl);
        
        // Parse the detail page
        const details = parseTenderDetail(detailRes.data);
        
        // Merge details into the tender object
        Object.assign(tender, details);
        
        console.log(`    [${i + 1}/${tenders.length}] ${tender.reference || tender.title?.substring(0, 50)}`);
      } catch (err) {
        console.error(`    [${i + 1}/${tenders.length}] Failed to fetch details: ${err.message}`);
        // Continue with other tenders even if one fails
      }
    }
  }

  return tenders;
}


