import { TRPCError } from "@trpc/server"
import { getRedis } from "@/lib/redis"
import { publicProcedure } from "./init"

interface RateLimitConfig {
  maxRequests: number
  windowSeconds: number
}

export const RATE_LIMITS = {
  view: { maxRequests: 1, windowSeconds: 60 },
  query: { maxRequests: 60, windowSeconds: 60 },
  // Global per-user write cap (and per-IP for Guests). 40/min is generous for a
  // human marking through the feed while still capping scripted abuse.
  mutation: { maxRequests: 40, windowSeconds: 60 },
  // Sensitive auth mutations (e.g. changePassword): a tight per-user cap to
  // blunt online brute-force of the current password from a hijacked session.
  // ~100x stricter than the generic mutation tier.
  sensitive: { maxRequests: 5, windowSeconds: 15 * 60 },
} as const satisfies Record<string, RateLimitConfig>

export type RateLimitAction = keyof typeof RATE_LIMITS

/**
 * Checks rate limit for a given action type against Redis.
 *
 * Throws `TRPCError` with code `TOO_MANY_REQUESTS` when the limit is exceeded.
 * Degrades gracefully (allows the request) if Redis is unavailable.
 *
 * @param action      - The action type whose limits to enforce
 * @param ip          - Client IP address
 * @param resourceKey - Optional sub-key for per-resource limits (e.g. fileId)
 */
export async function checkRateLimit(
  action: RateLimitAction,
  ip: string,
  resourceKey?: string
): Promise<void> {
  const config = RATE_LIMITS[action]
  const redis = getRedis()
  if (!redis) {
    return
  }

  const suffix = resourceKey ? `:${resourceKey}` : ""
  const rlKey = `ratelimit:${action}:${ip}${suffix}`

  try {
    if (config.maxRequests === 1) {
      const allowed = await redis.set(rlKey, "1", {
        nx: true,
        ex: config.windowSeconds,
      })
      if (!allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limited",
        })
      }
    } else {
      const current = await redis.incr(rlKey)
      // Always ensure a TTL exists (NX = set only if missing). On the first hit
      // this starts the window; on later hits it's a cheap no-op. Without it, a
      // lost `expire` (crash/transient between INCR and EXPIRE) would leave the
      // counter with no TTL — permanently locking out that user/IP.
      await redis.expire(rlKey, config.windowSeconds, "NX")
      if (current > config.maxRequests) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limited",
        })
      }
    }
  } catch (e) {
    if (e instanceof TRPCError) {
      throw e
    }
  }
}

export function rateLimitedProcedure(
  action: RateLimitAction,
  keyFn?: (rawInput: unknown) => string
) {
  return publicProcedure.use(async ({ ctx, next, getRawInput, path }) => {
    const ip = ctx.clientIp ?? "unknown"

    let resourceKey: string | undefined
    if (keyFn) {
      const rawInput = await getRawInput()
      resourceKey = keyFn(rawInput)
    } else if (action === "query") {
      // Scope each query procedure to its own per-IP bucket. Otherwise every
      // read shares one `ratelimit:query:{ip}` budget, so a single page load
      // (the homepage fires ~10 queries) plus the paginating video feed drain
      // it together and trip TOO_MANY_REQUESTS on unrelated reads. The mutation
      // and sensitive tiers stay global by design (write/auth caps).
      resourceKey = path
    }

    await checkRateLimit(action, ip, resourceKey)

    return next()
  })
}
