import { NextResponse } from "next/server";
import { initializeSubscriptionTransaction } from "@/lib/paystack";
import { getCheckoutLimiter } from "@/lib/redis";
 
export const runtime = "nodejs";
 
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
 
function getClientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}
 
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  // Optional creator/campaign code, e.g. /api/checkout?email=...&ref=ama
  const ref = searchParams.get("ref") || undefined;
 
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
 
  try {
    const limiter = getCheckoutLimiter();
    const ip = getClientIp(req);
    const { success } = await limiter.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
    }
 
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get("host")}`;
    const { authorization_url } = await initializeSubscriptionTransaction({
      email,
      ref,
      callbackUrl: `${appUrl}?checkout=success`,
    });
 
    return NextResponse.redirect(authorization_url, { status: 303 });
  } catch (err) {
    console.error("checkout route error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
