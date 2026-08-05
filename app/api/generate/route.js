import { NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/anthropic";
import { getGenerateLimiter, getSubscriptionStatus, isOwnerEmail } from "@/lib/redis";
 
export const runtime = "nodejs";
 
function buildPrompt({ skills, budget, country }) {
  return `You are a pragmatic startup advisor. A person gives you their skills, budget, and country. Generate a personalized business plan.
 
Skills: ${skills}
Budget: ${budget}
Country: ${country}
 
Respond with ONLY valid JSON (no markdown fences, no preamble) matching this exact shape:
{
  "ideas": [
    {"name": string, "pitch": string (1-2 sentences), "whyFit": string (why it fits their skills/budget/country)}
  ],
  "startupCosts": [
    {"item": string, "estCost": string (include local currency if known, else USD)}
  ],
  "totalCostEstimate": string,
  "marketingPlan": {
    "positioning": string (1-2 sentences),
    "channels": [ {"channel": string, "tactic": string} ],
    "firstNinetyDays": [ string ]
  },
  "profitEstimate": {
    "monthlyRevenueLow": string,
    "monthlyRevenueHigh": string,
    "monthlyCosts": string,
    "breakEvenTimeframe": string,
    "assumptions": string
  }
}
Generate exactly 3 ideas, ordered best-fit first. Provide 5-8 startupCosts line items for the top idea. Provide 3-5 marketing channels and 3-5 firstNinetyDays milestones.`;
}
 
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
 
export async function POST(req) {
  try {
    const body = await req.json();
    const { email, skills, budget, country } = body || {};
 
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }
    if (!skills?.trim() || !budget?.trim() || !country?.trim()) {
      return NextResponse.json({ error: "Skills, budget, and country are all required." }, { status: 400 });
    }
 
    const owner = isOwnerEmail(email);
 
    if (!owner) {
      // 1. Must have an active subscription.
      const status = await getSubscriptionStatus(email);
      if (status !== "active") {
        return NextResponse.json(
          {
            error: "subscription_required",
            message: "An active subscription is required to generate a dossier.",
            checkoutUrl: `/api/checkout?email=${encodeURIComponent(email)}`,
          },
          { status: 402 }
        );
      }
 
      // 2. Even paying subscribers are rate-limited, to cap worst-case API cost.
      const limiter = getGenerateLimiter();
      const { success, remaining, reset } = await limiter.limit(email.toLowerCase().trim());
      if (!success) {
        return NextResponse.json(
          {
            error: "rate_limited",
            message: "You've hit today's generation limit. Try again later.",
            resetAt: reset,
          },
          { status: 429 }
        );
      }
    }
 
    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system:
        "You respond with ONLY a single valid JSON object. Never include markdown code fences, explanations, or any text before or after the JSON.",
      messages: [{ role: "user", content: buildPrompt({ skills, budget, country }) }],
    });
 
    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
 
    const parsed = extractJson(rawText);
    if (!parsed) {
      // Logged server-side (Vercel > Logs) so you can see what actually came back.
      console.error("Could not parse model output as JSON:", rawText);
      return NextResponse.json(
        { error: "generation_failed", message: "Could not parse the generated plan. Please try again." },
        { status: 502 }
      );
    }
 
    return NextResponse.json({ data: parsed });
  } catch (err) {
    console.error("generate route error:", err);
    return NextResponse.json({ error: "server_error", message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
 
// Strips markdown fences if present, then falls back to extracting the
// outermost {...} block in case the model added any stray text around it.
function extractJson(text) {
  const stripped = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Fall through to bracket extraction below.
  }
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}
