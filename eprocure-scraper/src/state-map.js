/**
 * Tender247 location strings look like: "City, State, India"
 * This map lets us attach HPCL-style numeric state ids for filtering.
 *
 * Source: user-provided state master list.
 */

export const STATES = [
  { state_id: 1429, state_name: "Andaman And Nicobar Islands", country_id: 101, statezone_id: 2 },
  { state_id: 1430, state_name: "Andhra Pradesh", country_id: 101, statezone_id: 2 },
  { state_id: 1431, state_name: "Arunachal Pradesh", country_id: 101, statezone_id: 4 },
  { state_id: 1432, state_name: "Assam", country_id: 101, statezone_id: 4 },
  { state_id: 1433, state_name: "Bihar", country_id: 101, statezone_id: 4 },
  { state_id: 1434, state_name: "Chandigarh", country_id: 101, statezone_id: 3 },
  { state_id: 1435, state_name: "Chhattisgarh", country_id: 101, statezone_id: 5 },
  { state_id: 1436, state_name: "Dadra And Nagar Haveli", country_id: 101, statezone_id: 1 },
  { state_id: 1437, state_name: "Daman And Diu", country_id: 101, statezone_id: 1 },
  { state_id: 1438, state_name: "Delhi", country_id: 101, statezone_id: 3 },
  { state_id: 4990, state_name: "Delhi NCR", country_id: 101, statezone_id: 0 },
  { state_id: 1439, state_name: "Goa", country_id: 101, statezone_id: 1 },
  { state_id: 1440, state_name: "Gujarat", country_id: 101, statezone_id: 1 },
  { state_id: 1441, state_name: "Haryana", country_id: 101, statezone_id: 3 },
  { state_id: 1442, state_name: "Himachal Pradesh", country_id: 101, statezone_id: 3 },
  { state_id: 1443, state_name: "Jammu And Kashmir", country_id: 101, statezone_id: 3 },
  { state_id: 1444, state_name: "Jharkhand", country_id: 101, statezone_id: 4 },
  { state_id: 1445, state_name: "Karnataka", country_id: 101, statezone_id: 2 },
  { state_id: 1446, state_name: "Kerala", country_id: 101, statezone_id: 2 },
  { state_id: 4994, state_name: "Ladakh", country_id: 101, statezone_id: 0 },
  { state_id: 1447, state_name: "Lakshadweep", country_id: 101, statezone_id: 0 },
  { state_id: 1448, state_name: "Madhya Pradesh", country_id: 101, statezone_id: 5 },
  { state_id: 1449, state_name: "Maharashtra", country_id: 101, statezone_id: 1 },
  { state_id: 1450, state_name: "Manipur", country_id: 101, statezone_id: 4 },
  { state_id: 1451, state_name: "Meghalaya", country_id: 101, statezone_id: 4 },
  { state_id: 1452, state_name: "Mizoram", country_id: 101, statezone_id: 4 },
  { state_id: 3539, state_name: "Multi State", country_id: 101, statezone_id: 0 },
  { state_id: 1453, state_name: "Nagaland", country_id: 101, statezone_id: 4 },
  { state_id: 1454, state_name: "Orissa", country_id: 101, statezone_id: 4 },
  { state_id: 1455, state_name: "Pondicherry", country_id: 101, statezone_id: 2 },
  { state_id: 3882, state_name: "Puducherry", country_id: 101, statezone_id: 2 },
  { state_id: 1456, state_name: "Punjab", country_id: 101, statezone_id: 3 },
  { state_id: 1457, state_name: "Rajasthan", country_id: 101, statezone_id: 1 },
  { state_id: 1458, state_name: "Sikkim", country_id: 101, statezone_id: 4 },
  { state_id: 1459, state_name: "Tamil Nadu", country_id: 101, statezone_id: 2 },
  { state_id: 3883, state_name: "Telangana", country_id: 101, statezone_id: 2 },
  { state_id: 1460, state_name: "Tripura", country_id: 101, statezone_id: 4 },
  { state_id: 1461, state_name: "Uttar Pradesh", country_id: 101, statezone_id: 3 },
  { state_id: 1462, state_name: "Uttarakhand", country_id: 101, statezone_id: 3 },
  { state_id: 1463, state_name: "West Bengal", country_id: 101, statezone_id: 4 },
];

const byName = new Map(STATES.map((s) => [String(s.state_name).toLowerCase(), s]));

export function extractStateNameFromSiteLocation(siteLocation) {
  const raw = String(siteLocation || "").trim();
  if (!raw) return null;
  // "City, State, India"
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[1];
  return parts[0] || null;
}

export function lookupStateByName(stateName) {
  if (!stateName) return null;
  const key = String(stateName).trim().toLowerCase();
  if (!key) return null;
  return byName.get(key) || null;
}


