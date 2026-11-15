import { incrementRateLimit } from '@/lib/redis';

export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    return xff.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Sliding window / fixed-window rate limiter backed by Redis (with in-memory fallback)
 */
export async function checkRateLimit(params: {
  scope: 'login' | 'otp_send' | 'otp_verify' | 'order_place';
  identifier: string;
  maxRequests: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const cleanId = params.identifier.toLowerCase().trim() || 'anon';
  const key = `${params.scope}:${cleanId}`;
  const { count, ttlRemainingSec } = await incrementRateLimit(key, params.windowSeconds);

  return {
    allowed: count <= params.maxRequests,
    remaining: Math.max(0, params.maxRequests - count),
    resetInSeconds: ttlRemainingSec,
  };
}

