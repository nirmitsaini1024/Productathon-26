import { Resend } from "resend";

function requireResendApiKey() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return key;
}

function getFromAddress() {
  return process.env.RESEND_FROM || "HPCL Leads <onboarding@resend.dev>";
}

function isValidEmail(s) {
  const email = String(s || "").trim();
  // simple pragmatic check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function sendLeadEmail({ to, subject, message, lead }) {
  if (!isValidEmail(to)) throw new Error("Invalid 'to' email address");
  const safeSubject = String(subject || "").trim() || "HPCL Lead Outreach";
  const safeMessage = String(message || "").trim();

  const leadBlock = lead
    ? [
        `Company: ${lead.company_name ?? ""}`,
        `Location: ${lead.location?.city ?? ""}, ${lead.location?.state ?? ""}`,
        `Urgency: ${lead.urgency ?? ""} | Score: ${lead.lead_score ?? ""}% | Confidence: ${lead.confidence ?? ""}%`,
        `Why: ${lead.signals?.[0]?.summary ?? ""}`,
        `Source: ${lead.signals?.[0]?.source ?? lead.website ?? ""}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const text = [safeMessage, "", "---", leadBlock].filter(Boolean).join("\n");

  const resend = new Resend(requireResendApiKey());
  const from = getFromAddress();

  return await resend.emails.send({
    from,
    to,
    subject: safeSubject,
    text,
  });
}


