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
export async function initializeSubscriptionTransaction({ email, callbackUrl }) {
  const planCode = process.env.PAYSTACK_PLAN_CODE;
  if (!planCode) throw new Error("PAYSTACK_PLAN_CODE is not set");

  const json = await paystackRequest("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email,
      plan: planCode,
      callback_url: callbackUrl,
    }),
  });
  return json.data; // { authorization_url, access_code, reference }
}

export function verifyWebhookSignature(rawBody, signatureHeader) {
  const crypto = require("crypto");
  const hash = crypto.createHmac("sha512", getSecretKey()).update(rawBody).digest("hex");
  return hash === signatureHeader;
}
