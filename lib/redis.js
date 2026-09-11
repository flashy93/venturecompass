import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
 
let redisClient = null;
let generateLimiter = null;
let checkoutLimiter = null;
 
function getRedis() {
  if (!redisClient) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error("Upstash Redis env vars are not set");
    }
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisClient;
}
 
// Paying subscribers: generous but capped, so one account can't rack up
// unbounded Anthropic API cost. Adjust the "10, 1 d" window to taste.
export function getGenerateLimiter() {
  if (!generateLimiter) {
    generateLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, "1 d"),
      prefix: "ratelimit:generate",
    });
  }
  return generateLimiter;
}
 
// Applies per-IP to the checkout route, so it can't be spammed to create
// junk Stripe/Paystack sessions.
export function getCheckoutLimiter() {
  if (!checkoutLimiter) {
    checkoutLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      prefix: "ratelimit:checkout",
    });
  }
  return checkoutLimiter;
}
 
const SUB_KEY = (email) => `subscription:${email.toLowerCase().trim()}`;
const REF_KEY = (email) => `referrer:${email.toLowerCase().trim()}`;
const REF_INDEX_KEY = "referrer:index"; // set of every email that has a referrer, for listing
 
export async function setSubscriptionStatus(email, status) {
  const redis = getRedis();
  await redis.set(SUB_KEY(email), status);
}
 
export async function getSubscriptionStatus(email) {
  const redis = getRedis();
  return redis.get(SUB_KEY(email));
}
 
// Records which creator/campaign a subscriber came from. Only ever set once
// per email (first attribution wins) so re-subscribing or clicking a
// different link later doesn't overwrite the original credit.
export async function setReferrerIfAbsent(email, ref) {
  if (!ref) return;
  const redis = getRedis();
  const key = REF_KEY(email);
  const existing = await redis.get(key);
  if (existing) return;
  await redis.set(key, ref);
  await redis.sadd(REF_INDEX_KEY, email.toLowerCase().trim());
}
 
export async function getReferrer(email) {
  const redis = getRedis();
  return redis.get(REF_KEY(email));
}
 
// Returns [{ email, referrer, subscriptionStatus }] for every subscriber
// that was ever attributed to a referral link. Used by the admin endpoint
// to calculate payouts.
export async function listReferrals() {
  const redis = getRedis();
  const emails = (await redis.smembers(REF_INDEX_KEY)) || [];
  const results = await Promise.all(
    emails.map(async (email) => {
      const [referrer, subscriptionStatus] = await Promise.all([
        redis.get(REF_KEY(email)),
        redis.get(SUB_KEY(email)),
      ]);
      return { email, referrer, subscriptionStatus };
    })
  );
  return results;
}
 
export function isOwnerEmail(email) {
  const owners = (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return owners.includes((email || "").toLowerCase().trim());
}
