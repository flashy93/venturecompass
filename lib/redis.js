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
// junk Stripe sessions.
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

export async function setSubscriptionStatus(email, status) {
  const redis = getRedis();
  // status: "active" | "canceled" | "past_due" etc.
  await redis.set(SUB_KEY(email), status);
}

export async function getSubscriptionStatus(email) {
  const redis = getRedis();
  return redis.get(SUB_KEY(email));
}

export function isOwnerEmail(email) {
  const owners = (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return owners.includes((email || "").toLowerCase().trim());
}
