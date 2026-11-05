/**
 * Edge-compatible sliding window rate limiter for Cloudflare Pages
 * Tracks requests per IP address in memory with automatic cleanup.
 */

const ipRequests = new Map<string, number[]>();
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  ip: string;
}

export function checkRateLimit(
  request: Request,
  maxRequests: number = 30,
  windowMs: number = 60 * 1000
): RateLimitResult {
  const now = Date.now();

  // Periodic garbage collection for memory efficiency on Edge
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    for (const [ip, timestamps] of ipRequests.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        ipRequests.delete(ip);
      } else {
        ipRequests.set(ip, valid);
      }
    }
    lastCleanup = now;
  }

  // Extract client IP from Cloudflare or proxy headers
  const cfIp = request.headers.get('cf-connecting-ip');
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  const ip =
    cfIp ||
    (forwardedFor ? forwardedFor.split(',')[0].trim() : null) ||
    realIp ||
    '127.0.0.1';

  const timestamps = (ipRequests.get(ip) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0];
    const reset = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      reset,
      ip,
    };
  }

  timestamps.push(now);
  ipRequests.set(ip, timestamps);

  return {
    allowed: true,
    remaining: maxRequests - timestamps.length,
    reset: Math.ceil(windowMs / 1000),
    ip,
  };
}
