/**
 * In-memory sliding window rate limiter for API routes.
 * No external dependencies required.
 */

interface RateLimiterOptions {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
}

interface RateLimiter {
  check: (ip: string) => RateLimitResult;
}

/**
 * Creates an in-memory rate limiter using a sliding window approach.
 * Expired entries are cleaned up periodically (every 5 minutes).
 */
function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { maxRequests, windowMs } = options;

  // Map of IP -> array of request timestamps
  const requests = new Map<string, number[]>();

  // Periodic cleanup of expired entries every 5 minutes
  const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requests.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, valid);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref?.();

  return {
    check(ip: string): RateLimitResult {
      const now = Date.now();
      const timestamps = requests.get(ip) || [];

      // Filter to only timestamps within the current window
      const validTimestamps = timestamps.filter((t) => now - t < windowMs);

      if (validTimestamps.length >= maxRequests) {
        // Rate limit exceeded
        requests.set(ip, validTimestamps);
        return { success: false, remaining: 0 };
      }

      // Record this request
      validTimestamps.push(now);
      requests.set(ip, validTimestamps);

      return {
        success: true,
        remaining: maxRequests - validTimestamps.length,
      };
    },
  };
}

/** Rate limiter for /api/trades/generate — 30 requests per hour per IP */
export const tradeGenerateLimiter = createRateLimiter({
  maxRequests: 30,
  windowMs: 60 * 60 * 1000,
});

/** Rate limiter for all /api/espn/* routes — 60 requests per hour per IP (shared) */
export const espnLimiter = createRateLimiter({
  maxRequests: 60,
  windowMs: 60 * 60 * 1000,
});

/**
 * Helper to extract client IP from a Next.js request.
 */
export function getClientIp(request: Request & { ip?: string }): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    (request as any).ip ||
    "anonymous"
  );
}
