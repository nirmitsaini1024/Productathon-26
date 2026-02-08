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

/**
 * Parse the tender detail page to extract additional information
 * @param {string} html - HTML content of the detail page
 * @returns {Object} - Extracted tender details
 */
export function parseTenderDetail(html) {
  const $ = load(html);
  const details = {};

  // Extract from tables with td_caption (label) and td_field (value) pattern
  $("td.td_caption").each((_, el) => {
    const $caption = $(el);
    const labelText = normalizeSpace($caption.text()).replace(/\*$/, "").trim();
    const lowerLabel = labelText.toLowerCase();
    
    // Get the value from the next td.td_field sibling
    const $field = $caption.next("td.td_field");
    if (!$field.length) return;
    
    const value = normalizeSpace($field.text());
    if (!value || value === "NA" || value === "na") return;

    // === BASIC DETAILS ===
    if (lowerLabel.includes("organisation chain")) {
      details.organisationChain = value;
    } else if (lowerLabel.includes("tender reference number")) {
      details.tenderReferenceNumber = value;
    } else if (lowerLabel.includes("tender id")) {
      details.tenderId = value;
    } else if (lowerLabel.includes("withdrawal allowed")) {
      details.withdrawalAllowed = value;
    } else if (lowerLabel.includes("tender type")) {
      details.tenderType = value;
    } else if (lowerLabel.includes("form of contract")) {
      details.formOfContract = value;
    } else if (lowerLabel.includes("tender category")) {
      details.tenderCategory = value;
    } else if (lowerLabel.includes("no. of covers") || lowerLabel.includes("no of covers")) {
      details.numberOfCovers = value;
    } else if (lowerLabel.includes("general technical evaluation allowed")) {
      details.generalTechnicalEvaluationAllowed = value;
    } else if (lowerLabel.includes("itemwise technical evaluation allowed")) {
      details.itemWiseTechnicalEvaluationAllowed = value;
    } else if (lowerLabel.includes("payment mode")) {
      details.paymentMode = value;
    } else if (lowerLabel.includes("is multi currency allowed for boq")) {
      details.isMultiCurrencyAllowedForBOQ = value;
    } else if (lowerLabel.includes("is multi currency allowed for fee")) {
      details.isMultiCurrencyAllowedForFee = value;
    } else if (lowerLabel.includes("allow two stage bidding")) {
      details.allowTwoStageBidding = value;
    }
    
    // === TENDER FEE & EMD DETAILS ===
    else if (lowerLabel.includes("tender fee in") && !lowerLabel.includes("exemption")) {
      details.tenderFee = value;
    } else if (lowerLabel.includes("fee payable to") && !details.feePayableTo) {
      details.feePayableTo = value;
    } else if (lowerLabel.includes("fee payable at") && !details.feePayableAt) {
      details.feePayableAt = value;
    } else if (lowerLabel.includes("tender fee exemption allowed")) {
      details.tenderFeeExemptionAllowed = value;
    } else if (lowerLabel.includes("emd amount in") || (lowerLabel.includes("emd") && lowerLabel.includes("amount") && !lowerLabel.includes("exemption"))) {
      details.emdAmount = value;
    } else if (lowerLabel.includes("emd exemption allowed")) {
      details.emdExemptionAllowed = value;
    } else if (lowerLabel.includes("emd fee type")) {
      details.emdFeeType = value;
    } else if (lowerLabel.includes("emd percentage")) {
      details.emdPercentage = value;
    } else if (lowerLabel.includes("emd payable to")) {
      details.emdPayableTo = value;
    } else if (lowerLabel.includes("emd payable at")) {
      details.emdPayableAt = value;
    }
    
    // === WORK ITEM DETAILS ===
    else if (lowerLabel === "title") {
      details.workTitle = value;
    } else if (lowerLabel.includes("work description")) {
      details.workDescription = value;
    } else if (lowerLabel.includes("nda/pre qualification") || lowerLabel.includes("nda / pre qualification")) {
      details.ndaPreQualification = value;
    } else if (lowerLabel.includes("independent external monitor") || lowerLabel.includes("remarks")) {
      details.independentExternalMonitorRemarks = value;
    } else if (lowerLabel.includes("tender value in") || (lowerLabel === "tender value")) {
      details.tenderValue = value;
    } else if (lowerLabel.includes("product category")) {
      details.productCategory = value;
    } else if (lowerLabel.includes("sub category")) {
      details.subCategory = value;
    } else if (lowerLabel.includes("contract type")) {
      details.contractType = value;
    } else if (lowerLabel.includes("bid validity")) {
      details.bidValidityDays = value;
    } else if (lowerLabel.includes("period of work")) {
      details.periodOfWorkDays = value;
    } else if (lowerLabel === "location") {
      details.workLocation = value;
    } else if (lowerLabel.includes("pincode")) {
      details.pincode = value;
    } else if (lowerLabel.includes("pre bid meeting place")) {
      details.preBidMeetingPlace = value;
    } else if (lowerLabel.includes("pre bid meeting address")) {
      details.preBidMeetingAddress = value;
    } else if (lowerLabel.includes("pre bid meeting date")) {
      details.preBidMeetingDate = value;
    } else if (lowerLabel.includes("bid opening place")) {
      details.bidOpeningPlace = value;
    } else if (lowerLabel.includes("should allow nda tender")) {
      details.shouldAllowNDATender = value;
    } else if (lowerLabel.includes("allow preferential bidder")) {
      details.allowPreferentialBidder = value;
    }
    
    // === CRITICAL DATES ===
    else if (lowerLabel.includes("published date")) {
      details.publishedDateFull = value;
    } else if (lowerLabel.includes("bid opening date")) {
      details.bidOpeningDateFull = value;
    } else if (lowerLabel.includes("document download") && lowerLabel.includes("start")) {
      details.docDownloadStartDate = value;
    } else if (lowerLabel.includes("document download") && lowerLabel.includes("end")) {
      details.docDownloadEndDate = value;
    } else if (lowerLabel.includes("bid submission start date")) {
      details.bidSubmissionStartDate = value;
    } else if (lowerLabel.includes("bid submission end date")) {
      details.bidSubmissionEndDate = value;
    } else if (lowerLabel.includes("clarification start date")) {
      details.clarificationStartDate = value;
    } else if (lowerLabel.includes("clarification end date")) {
      details.clarificationEndDate = value;
    }
  });

  // Also extract organization chain from bold td_field at the top
  if (!details.organisationChain) {
    const orgChain = $("td.td_caption:contains('Organisation Chain')")
      .next("td.td_field")
      .find("b")
      .text();
    if (orgChain) {
      details.organisationChain = normalizeSpace(orgChain);
    }
  }

  // Extract tender inviting authority
  const authoritySection = $("td.pageheader:contains('Tender Inviting Authority')").closest("table");
  if (authoritySection.length) {
    const authorityTable = authoritySection.nextAll("table").first();
    const authorityName = authorityTable.find("td.td_caption:contains('Name')").next("td.td_field").text();
    const authorityAddress = authorityTable.find("td.td_caption:contains('Address')").next("td.td_field").text();
    
    if (normalizeSpace(authorityName)) {
      details.tenderInvitingAuthorityName = normalizeSpace(authorityName);
    }
    if (normalizeSpace(authorityAddress)) {
      details.tenderInvitingAuthorityAddress = normalizeSpace(authorityAddress);
    }
  }

  // Extract payment instruments
  const paymentInstruments = [];
  $("#offlineInstrumentsTableView tr.even, #offlineInstrumentsTableView tr.odd").each((_, row) => {
    const $row = $(row);
    const instrument = normalizeSpace($row.find("td").eq(1).text());
    if (instrument) {
      paymentInstruments.push(instrument);
    }
  });
  if (paymentInstruments.length > 0) {
    details.paymentInstruments = paymentInstruments;
  }

  // Extract cover information
  const covers = [];
  $("#packetTableView tr").each((_, row) => {
    const $row = $(row);
    const cells = $row.find("td.td_field");
    if (cells.length >= 3) {
      const coverNo = normalizeSpace(cells.eq(0).text());
      const coverType = normalizeSpace(cells.eq(1).text());
      const description = normalizeSpace(cells.eq(2).text());
      const docType = normalizeSpace(cells.eq(3).text());
      
      if (coverNo || coverType || description) {
        covers.push({
          coverNo: coverNo || null,
          coverType: coverType || null,
          description: description || null,
          documentType: docType || null
        });
      }
    }
  });
  if (covers.length > 0) {
    details.covers = covers;
  }

  // Extract NIT documents
  const nitDocuments = [];
  $("#table tr").each((_, row) => {
    const $row = $(row);
    if ($row.hasClass("list_header")) return;
    
    const cells = $row.find("td");
    if (cells.length >= 4) {
      const docName = normalizeSpace(cells.eq(1).find("a").text() || cells.eq(1).text());
      const description = normalizeSpace(cells.eq(2).text());
      const size = normalizeSpace(cells.eq(3).text());
      const downloadLink = cells.eq(1).find("a").attr("href");
      
      if (docName) {
        nitDocuments.push({
          name: docName,
          description: description || null,
          sizeKB: size || null,
          downloadUrl: downloadLink ? absUrl(BASE_URL, downloadLink) : null
        });
      }
    }
  });
  if (nitDocuments.length > 0) {
    details.nitDocuments = nitDocuments;
  }

  // Extract work item documents
  const workItemDocuments = [];
  $("#workItemDocumenttable tr.even, #workItemDocumenttable tr.odd").each((_, row) => {
    const $row = $(row);
    const cells = $row.find("td");
    if (cells.length >= 5) {
      const docType = normalizeSpace(cells.eq(1).text());
      const docName = normalizeSpace(cells.eq(2).find("span").first().text() || cells.eq(2).text());
      const description = normalizeSpace(cells.eq(3).text());
      const size = normalizeSpace(cells.eq(4).text());
      const downloadLink = cells.eq(2).find("a").first().attr("href");
      
      if (docName) {
        workItemDocuments.push({
          type: docType || null,
          name: docName,
          description: description || null,
          sizeKB: size || null,
          downloadUrl: downloadLink ? absUrl(BASE_URL, downloadLink) : null
        });
      }
    }
  });
  if (workItemDocuments.length > 0) {
    details.workItemDocuments = workItemDocuments;
  }

  return details;
}


