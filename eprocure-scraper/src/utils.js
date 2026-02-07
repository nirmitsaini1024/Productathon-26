import crypto from "crypto";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function jitter(ms, pct = 0.2) {
  const delta = Math.floor(ms * pct);
  const min = Math.max(0, ms - delta);
  const max = ms + delta;
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function newRequestId() {
  return crypto.randomBytes(6).toString("hex");
}

export function normalizeSpace(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function absUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function safeFilename(input, { maxLen = 80 } = {}) {
  const s = normalizeSpace(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const out = s || "keyword";
  return out.length > maxLen ? out.slice(0, maxLen) : out;
}


