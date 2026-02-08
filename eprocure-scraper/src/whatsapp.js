function requireTwilioAuthToken() {
  const tok = process.env.TWILIO_AUTH_TOKEN;
  if (!tok) throw new Error("TWILIO_AUTH_TOKEN is not set");
  return tok;
}

function getTwilioAccountSid() {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  if (!sid) throw new Error("TWILIO_ACCOUNT_SID is not set");
  return sid;
}

function getWhatsAppFrom() {
  // Twilio WhatsApp Sandbox default number
  return String(process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886").trim();
}

function getContentSid() {
  // Default from the sample provided by the user
  return String(process.env.TWILIO_WHATSAPP_CONTENT_SID || "HXb5b62575e6e4ff6129ad7c8efe1f983e").trim();
}

function getDefaultContentVariables() {
  // Twilio expects ContentVariables as a JSON string.
  return String(
    process.env.TWILIO_WHATSAPP_CONTENT_VARIABLES || '{"1":"Tender title","2":"Tender link"}'
  ).trim();
}

function isProbablyE164Number(s) {
  const v = String(s || "").trim();
  // Very pragmatic: + then 7-15 digits.
  return /^\+\d{7,15}$/.test(v);
}

function toWhatsAppAddress(to) {
  const raw = String(to || "").trim();
  if (!raw) return "";
  if (raw.startsWith("whatsapp:")) return raw;
  if (isProbablyE164Number(raw)) return `whatsapp:${raw}`;
  return "";
}

function toJsonStringMaybe(v) {
  if (v == null) return null;
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export async function sendWhatsAppTemplateMessage({
  to,
  contentSid,
  contentVariables,
  from,
}) {
  const accountSid = getTwilioAccountSid();
  if (!accountSid) throw new Error("TWILIO_ACCOUNT_SID is not configured");

  const authToken = requireTwilioAuthToken();

  const safeTo = toWhatsAppAddress(to);
  if (!safeTo) throw new Error("Invalid 'to' phone number. Provide E.164 like +917451898577");

  const safeFrom = String(from || getWhatsAppFrom()).trim();
  const safeContentSid = String(contentSid || getContentSid()).trim();
  const safeVars = toJsonStringMaybe(contentVariables) || getDefaultContentVariables();

  if (!safeFrom) throw new Error("TWILIO_WHATSAPP_FROM is not configured");
  if (!safeContentSid) throw new Error("TWILIO_WHATSAPP_CONTENT_SID is not configured");
  if (!safeVars) throw new Error("TWILIO_WHATSAPP_CONTENT_VARIABLES is not configured");

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;

  const params = new URLSearchParams();
  params.set("From", safeFrom);
  params.set("To", safeTo);
  params.set("ContentSid", safeContentSid);
  params.set("ContentVariables", safeVars);

  const basic = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const text = await resp.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // keep json null
  }

  if (!resp.ok) {
    const msg =
      json?.message ||
      json?.error_message ||
      `Twilio API failed (status ${resp.status})`;
    const err = new Error(String(msg));
    err.status = resp.status;
    err.twilio = json;
    throw err;
  }

  return json;
}


