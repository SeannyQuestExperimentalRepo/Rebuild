/**
 * In-memory sliding window rate limiter for API routes.
 *
 * Each Vercel serverless instance maintains its own window, so this provides
 * "best effort" protection. For production-scale enforcement, swap the store
 * with @upstash/ratelimit + @upstash/redis.
 */

import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

// In-memory store keyed by "limiterName:identifier"
const store = new Map<string, RateLimitEntry>();

// Periodic cleanup to prevent memory leaks (every 5 minutes)
let cleanupScheduled = false;
function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setTimeout(() => {
    const now = Date.now();
    const keys = Array.from(store.keys());
    for (const key of keys) {
      const entry = store.get(key);
      // Remove entries idle for more than 10 minutes
      if (entry && now - entry.lastRefill > 600_000) {
        store.delete(key);
      }
    }
    cleanupScheduled = false;
  }, 300_000);
}

/**
 * Create a named rate limiter with the given config.
 *
 * Returns a function that checks rate limits given an identifier (IP or userId).
 * Returns { success: true, remaining } or { success: false, remaining: 0 }.
 */
export function createRateLimiter(name: string, config: RateLimitConfig) {
  return function check(identifier: string): {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  } {
    const key = `${name}:${identifier}`;
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;

    let entry = store.get(key);

    if (!entry) {
      entry = { tokens: config.limit - 1, lastRefill: now };
      store.set(key, entry);
      scheduleCleanup();
      return {
        success: true,
        limit: config.limit,
        remaining: config.limit - 1,
        reset: Math.ceil((now + windowMs) / 1000),
      };
    }

    // Refill tokens based on elapsed time
    const elapsed = now - entry.lastRefill;
    const refill = Math.floor((elapsed / windowMs) * config.limit);

    if (refill > 0) {
      entry.tokens = Math.min(config.limit, entry.tokens + refill);
      entry.lastRefill = now;
    }

    if (entry.tokens > 0) {
      entry.tokens--;
      return {
        success: true,
        limit: config.limit,
        remaining: entry.tokens,
        reset: Math.ceil((now + windowMs) / 1000),
      };
    }

    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset: Math.ceil((entry.lastRefill + windowMs) / 1000),
    };
  };
}

// ─── Pre-configured limiters ────────────────────────────────────────────────

/** Public API routes: 30 requests per 60 seconds per IP */
export const publicLimiter = createRateLimiter("public", {
  limit: 30,
  windowSeconds: 60,
});

/** Authenticated routes: 60 requests per 60 seconds per user */
export const authLimiter = createRateLimiter("auth", {
  limit: 60,
  windowSeconds: 60,
});

/** Auth endpoints (login/signup): 10 requests per 60 seconds per IP */
export const authFlowLimiter = createRateLimiter("auth-flow", {
  limit: 10,
  windowSeconds: 60,
});

/** Heavy query routes (trends): 15 requests per 60 seconds per IP */
export const queryLimiter = createRateLimiter("query", {
  limit: 15,
  windowSeconds: 60,
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract client IP from request headers */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Apply rate limit check and return 429 response if exceeded */
export function applyRateLimit(
  req: NextRequest,
  limiter: ReturnType<typeof createRateLimiter>,
  identifier?: string,
): NextResponse | null {
  const id = identifier || getClientIp(req);
  const result = limiter(id);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": result.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": result.reset.toString(),
          "Retry-After": Math.max(
            1,
            result.reset - Math.ceil(Date.now() / 1000),
          ).toString(),
        },
      },
    );
  }

  return null; // Not rate limited
}
