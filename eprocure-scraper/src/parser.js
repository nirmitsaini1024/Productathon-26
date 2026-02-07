import { load } from "cheerio";
import { absUrl, normalizeSpace } from "./utils.js";

const BASE_URL = "https://eprocure.gov.in/eprocure/app";

function looksLikeDate(s) {
  // Very loose check: gov site uses "05-Feb-2026 09:00 AM" etc.
  return /\b\d{1,2}-[A-Za-z]{3}-\d{4}\b/.test(s);
}

export function parseTenderList(html, keyword) {
  const $ = load(html);
  const tenders = [];

  // Only parse the tender results table rows; avoid scraping navigation links.
  const rows = $("#table tr.even, #table tr.odd");
  if (!rows.length) return tenders;

  rows.each((_, row) => {
    const $row = $(row);
    const cols = $row.find("td");
    if (!cols.length) return;

    // In the tenders list, the title/reference column contains the detail link.
    const anchor = $row.find("a[href]").first();
    const href = anchor.attr("href");
    if (!href) return;

    // Common column order: SNo | Published | Closing | Opening | Title/Ref | Organisation
    const publishedDate = normalizeSpace(cols.eq(1).text());
    const closingDate = normalizeSpace(cols.eq(2).text());
    const openingDate = normalizeSpace(cols.eq(3).text());

    // Title/reference are often co-located in the anchor cell.
    const titleRaw = normalizeSpace(anchor.text()).replace(/\[|\]/g, "");
    const refCellText = normalizeSpace(cols.eq(4).text() || anchor.closest("td").text());

    // Try to extract the reference portion like "[...][...]" if present.
    // Column text often looks like: "[Title.] [TenderRef][InternalId]"
    // We want the *tender reference number* (e.g. "[23/EE/...]" ), not the title.
    const bracketParts = refCellText.match(/\[[^\]]+\]/g) ?? [];
    const reference =
      bracketParts.length >= 3
        ? bracketParts.slice(1).join("") // drop title bracket, keep the rest
        : bracketParts.length === 2
          ? bracketParts[1]
          : refCellText;

    const organisation = normalizeSpace(cols.eq(5).text());
    const detailUrl = absUrl(BASE_URL, href);
    if (!detailUrl) return;

    // Skip if dates don't look like dates (defensive)
    if (publishedDate && !looksLikeDate(publishedDate)) return;

    tenders.push({
      keyword,
      publishedDate,
      closingDate,
      openingDate,
      title: titleRaw,
      reference,
      organisation,
      detailUrl,
    });
  });

  return tenders;
}


