import { NextResponse } from "next/server";
import { listReferrals, isOwnerEmail } from "@/lib/redis";
 
export const runtime = "nodejs";
 
// Simple owner-gated view of every subscriber attributed to a referral
// link, e.g. GET /api/admin/referrals?ownerEmail=you@example.com
// Filter by a specific creator with &ref=ama.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ownerEmail = searchParams.get("ownerEmail");
  const refFilter = searchParams.get("ref");
 
  if (!isOwnerEmail(ownerEmail)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
 
  try {
    let referrals = await listReferrals();
    if (refFilter) {
      referrals = referrals.filter((r) => r.referrer === refFilter);
    }
 
    const summary = {};
    for (const r of referrals) {
      if (!r.referrer) continue;
      summary[r.referrer] = summary[r.referrer] || { total: 0, active: 0 };
      summary[r.referrer].total += 1;
      if (r.subscriptionStatus === "active") summary[r.referrer].active += 1;
    }
 
    return NextResponse.json({ referrals, summary });
  } catch (err) {
    console.error("admin referrals route error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
