import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Periodic cleanup to prevent memory leak in long-lived serverless instances
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60_000; // every 5 minutes

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}

/**
 * In-memory sliding-window rate limiter (per serverless instance).
 * Returns a 429 Response if the limit is exceeded, or null if the request is allowed.
 *
 * @param request  - incoming NextRequest (uses x-forwarded-for for IP)
 * @param limit    - max requests per window (default 30)
 * @param windowMs - window size in ms (default 60 000 = 1 minute)
 */
export function rateLimit(
  request: NextRequest,
  { limit = 30, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): NextResponse | null {
  cleanup();

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    );
  }

  return null;
}
