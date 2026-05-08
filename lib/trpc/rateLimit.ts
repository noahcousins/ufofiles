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
  mutation: { maxRequests: 20, windowSeconds: 60 },
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
      if (current === 1) {
        await redis.expire(rlKey, config.windowSeconds)
      }
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
  return publicProcedure.use(async ({ ctx, next, getRawInput }) => {
    const ip = ctx.clientIp ?? "unknown"

    let resourceKey: string | undefined
    if (keyFn) {
      const rawInput = await getRawInput()
      resourceKey = keyFn(rawInput)
    }

    await checkRateLimit(action, ip, resourceKey)

    return next()
  })
}
