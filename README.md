# Venture Compass

Users enter their skills, budget, and country from anywhere in the world; the app calls
Claude to generate a personalized business dossier (3 ideas, startup costs, a marketing
plan, and a profit estimate).

- Free-tier hosting: Vercel
- Subscription paywall: Paystack (monthly, non-owner users only) — a Nigerian-registered
  business account that can still accept payments from customers **anywhere in the
  world**, not just Nigeria (see the international payments note below)
- Rate limiting + subscription cache: Upstash Redis (free tier)
- AI generation: Anthropic API

Owner emails (you) bypass payment and rate limits entirely.

> **Why Paystack, for a global product?** Stripe doesn't support direct signup for
> businesses registered in Nigeria, so it's off the table for the merchant side. Paystack
> solves the Nigeria problem for your side of the account — but it also **already
> supports customers worldwide**: once "international payments" is enabled on your
> Paystack business, anyone with a Visa, Mastercard, or Verve card can pay you, and funds
> settle to you in Naira (or USD, if you set up a domiciliary account). You don't need a
> second payment provider to reach a global audience — you need one setting turned on.

---

## 1. Get your accounts (all have free tiers)

| Service | What it's for | Free tier |
|---|---|---|
| [Vercel](https://vercel.com) | Hosting | Yes — see the commercial-use note below |
| [Anthropic Console](https://console.anthropic.com) | AI generation | Pay-as-you-go, no monthly fee |
| [Paystack](https://paystack.com) | Subscription billing | Free to integrate, ~1.5% + ₦100 per local charge (capped); international card fees are somewhat higher — check Paystack's pricing page for current rates |
| [Upstash](https://upstash.com) | Redis (rate limiting + subscription cache) | Yes, 10K commands/day free |

**A note on Vercel's Hobby (free) plan:** Vercel's free tier is licensed for personal,
non-commercial projects. Since this app charges a subscription, it's technically
commercial use. It's fine to build and test on the free Hobby plan, but once you're
actually charging real users, move to Vercel's Pro plan (~$20/month) to stay within
their terms — at that point your subscription revenue should comfortably cover it.

## 2. Set up Paystack (including global customers)

1. Sign up at [paystack.com](https://paystack.com) with your Nigerian business or
   individual details.
2. Go to **Payments → Plans → Create Plan**. Set a name (e.g. "Venture Compass
   Monthly"), an amount, and interval "Monthly." Save it and copy the **Plan Code**
   (starts with `PLN_...`) — this is `PAYSTACK_PLAN_CODE`.
3. **Enable international payments**, so customers outside Nigeria can subscribe too:
   go to **Settings → Preferences** and turn on **Accept international payments** (or
   apply for it if it's not immediately available — Paystack reviews some business
   types before approving this). Once enabled, anyone worldwide can pay with Visa,
   Mastercard, or Verve.
4. Go to **Settings → API Keys & Webhooks** and copy your **Secret Key** — this is
   `PAYSTACK_SECRET_KEY`. Use the **test key** (`sk_test_...`) while developing, switch
   to `sk_live_...` when you go live.
5. Stay on this page — you'll add the webhook URL here in step 5, after you have a
   deployed URL.

## 3. Set up Upstash Redis

Pick a region close to wherever most of your users (and you) actually are — this app
has no single home country baked in. As a reasonable default for a founder based in
Nigeria serving a global audience, a European region (Ireland `eu-west-1` or Frankfurt
`eu-central-1`) is a solid middle ground: it's well-connected to Africa, Europe, and
reasonably fast for the Americas and Asia too. If most of your early users turn out to
be concentrated elsewhere (e.g. mostly US-based), switch the primary region to match.

**Steps:**
1. Sign up free at [upstash.com](https://upstash.com).
2. Click **Create Database → Redis**.
3. Under **Type**, choose **Regional** (Global replication costs more per region and
   isn't needed for a rate-limit/subscription cache).
4. Pick your primary region per the guidance above.
5. Create the database, then copy **UPSTASH_REDIS_REST_URL** and
   **UPSTASH_REDIS_REST_TOKEN** from its detail page — these go into Vercel's
   environment variables.

**Matching your Vercel function region:** under **Settings → Functions → Function
Region** in Vercel, pick a region close to your Redis region (e.g. London `lhr1` or
Paris `cdg1` for a European Redis database) so API routes aren't paying a double
latency hop.

## 4. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, click **Add New → Project**, import the repo.
3. Before the first deploy, add all environment variables from `.env.example`
   under **Settings → Environment Variables**:
   - `ANTHROPIC_API_KEY`
   - `ANTHROPIC_MODEL` (optional, defaults to `claude-sonnet-4-6`)
   - `PAYSTACK_SECRET_KEY`
   - `PAYSTACK_PLAN_CODE`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `OWNER_EMAILS` — your own email(s), comma-separated, to bypass payment
   - `NEXT_PUBLIC_APP_URL` — fill in after your first deploy gives you a URL
     (e.g. `https://venture-compass.vercel.app`)
4. Under **Settings → Functions**, set the **Function Region** per the note above.
5. Deploy. Grab the resulting URL and update `NEXT_PUBLIC_APP_URL`, then redeploy.

## 5. Connect the Paystack webhook

The webhook is what marks a user as "active" after they pay, and "canceled" if a
recurring charge fails repeatedly — without it, no one's subscription would ever activate.

1. In the Paystack Dashboard, go to **Settings → API Keys & Webhooks**.
2. Set the **Webhook URL** to: `https://your-app.vercel.app/api/webhook`
3. Save. No separate signing secret is needed — the webhook is verified using your
   `PAYSTACK_SECRET_KEY`, which you've already set.

## 6. Test it end to end

1. Visit your deployed URL.
2. Enter your **own** email (from `OWNER_EMAILS`) — you should be able to generate
   immediately, no payment needed.
3. Enter a different email — you should be redirected to Paystack's payment page. Use
   Paystack's [test card](https://paystack.com/docs/payments/test-payments) in test mode
   to complete a subscription. Once international payments are enabled, this works
   the same way whether the test scenario is a Nigerian or foreign card.
4. After paying, go back to the app and generate again with that same email — it should
   now work, since the webhook marked it "active."

Switch `PAYSTACK_SECRET_KEY` to your live key when you're ready to charge real users.

---

## Vercel 404: NOT_FOUND troubleshooting

If you deploy and get a bare `404: NOT_FOUND` from Vercel's edge network (with a request
ID like `cptx::...`), it almost always means Vercel found no build output — most commonly
because:
- **Root Directory mismatch**: if you zipped/pushed this as a subfolder inside a larger
  repo, set **Settings → General → Root Directory** to that subfolder's name, then
  redeploy.
- The **Domains** tab is pointing at a stale or unassigned deployment rather than the
  current Production one.

## How the gating works

Every request to `/api/generate` is checked in this order:

1. **Owner bypass** — if the submitted email is in `OWNER_EMAILS`, skip straight to
   generation. No payment, no rate limit.
2. **Subscription check** — otherwise, look up the email's status in Redis. If it's not
   `"active"`, return a 402 with a checkout link instead of calling Claude.
3. **Rate limit** — even paying subscribers are capped (default: 10 generations/day/email)
   so no single account can run up unbounded Anthropic API cost. Adjust the limit in
   `lib/redis.js` (`getGenerateLimiter`).
4. **Generate** — only after passing all three does the app call the Anthropic API.

## Cost notes

At current Anthropic pricing, each generation costs roughly $0.005–$0.02 depending on the
model you choose (`ANTHROPIC_MODEL` in your env vars). At a modest monthly price with a
10/day generation cap, your worst-case AI cost per subscriber per month is well under
your subscription revenue. Switch to `claude-haiku-4-5-20251001` for the cheapest option
if quality holds up for your users; check `https://docs.claude.com` for current model IDs
and pricing before launch, as these change over time.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

Paystack webhooks won't reach `localhost` directly — use a tunneling tool like
[ngrok](https://ngrok.com) and point the Paystack webhook URL at the tunnel to test the
payment flow locally.
