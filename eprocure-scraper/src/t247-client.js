import axios from "axios";

const DEFAULT_URL =
  "https://t247_api.tender247.com/apigateway/T247Tender/api/tender/search-tender";

export async function searchTender247(payload) {
  const url = process.env.T247_SEARCH_URL || DEFAULT_URL;

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Optional auth hooks (only used if you set them)
  if (process.env.T247_AUTHORIZATION) headers.Authorization = process.env.T247_AUTHORIZATION;
  if (process.env.T247_API_KEY) headers["x-api-key"] = process.env.T247_API_KEY;

  const res = await axios.post(url, payload, { headers, timeout: 30_000, validateStatus: () => true });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Tender247 API failed: HTTP ${res.status}`);
  }

  return res.data;
}


