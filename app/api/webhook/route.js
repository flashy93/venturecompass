import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { setSubscriptionStatus, setReferrerIfAbsent } from "@/lib/redis";
 
export const runtime = "nodejs";
 
// Paystack requires the raw request body to verify the webhook signature,
// so signature verification must happen before any JSON parsing.
export async function POST(req) {
  const signature = req.headers.get("x-paystack-signature");
  const rawBody = await req.text();
 
  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    console.error("Paystack webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
 
  const event = JSON.parse(rawBody);
 
  try {
    switch (event.event) {
      // Fires on the first successful charge that starts a subscription,
      // and on every successful recurring charge after that.
      case "charge.success":
      case "subscription.create": {
        const email = event.data?.customer?.email;
        const ref = event.data?.metadata?.ref;
        if (email) {
          await setSubscriptionStatus(email, "active");
          if (ref) await setReferrerIfAbsent(email, ref);
        }
        break;
      }
      // Fires when a subscription is cancelled or Paystack gives up retrying
      // a failed recurring charge.
      case "subscription.disable":
      case "subscription.not_renew": {
        const email = event.data?.customer?.email;
        if (email) await setSubscriptionStatus(email, "canceled");
        break;
      }
      case "invoice.payment_failed": {
        const email = event.data?.customer?.email;
        if (email) await setSubscriptionStatus(email, "past_due");
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Webhook handling error:", err);
    // Still return 200 so Paystack doesn't endlessly retry a broken handler;
    // the error is logged for investigation.
  }
 
  return NextResponse.json({ received: true });
}
