const PAYSTACK_BASE = "https://api.paystack.co";
 
function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}
 
async function paystackRequest(path, options = {}) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok || json.status === false) {
    throw new Error(json.message || `Paystack request failed: ${path}`);
  }
  return json;
}
 
// Starts a transaction against a recurring Plan. The first successful charge
// creates a subscription that Paystack will auto-bill going forward.
// `ref` is an optional creator/campaign code (e.g. "ama") — Paystack echoes
// metadata back on webhook events, so this is how we attribute a subscriber
// to whichever referral link they came from.
export async function initializeSubscriptionTransaction({ email, callbackUrl, ref }) {
  const planCode = process.env.PAYSTACK_PLAN_CODE;
  if (!planCode) throw new Error("PAYSTACK_PLAN_CODE is not set");
 
  // Paystack's /transaction/initialize requires "amount" even when a plan is
  // attached, and it must match the plan's amount exactly (in kobo/cents) —
  // fetch it from the plan itself so it can never drift out of sync.
  const planJson = await paystackRequest(`/plan/${planCode}`, { method: "GET" });
  const amount = planJson.data?.amount;
  if (!amount) throw new Error(`Could not read amount from Paystack plan ${planCode}`);
 
  const json = await paystackRequest("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email,
      amount,
      plan: planCode,
      callback_url: callbackUrl,
      metadata: ref ? { ref } : undefined,
    }),
  });
  return json.data; // { authorization_url, access_code, reference }
}
 
export function verifyWebhookSignature(rawBody, signatureHeader) {
  const crypto = require("crypto");
  const hash = crypto.createHmac("sha512", getSecretKey()).update(rawBody).digest("hex");
  return hash === signatureHeader;
}
