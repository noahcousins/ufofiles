import { TRPCError } from "@trpc/server"
import { publicProcedure } from "./init"
import { checkRateLimit, type RateLimitAction } from "./rateLimit"

/**
 * Base middleware: require a signed-in identity (Guest or Member) and narrow
 * `ctx.user` to non-null for downstream resolvers.
 */
const authed = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sign in to continue",
    })
  }
  return next({ ctx: { ...ctx, user: ctx.user } })
})

/**
 * Any signed-in User (Guest included). Rate limits are **user-keyed** rather
 * than IP-keyed (ADR-0003) so a shared IP doesn't throttle distinct accounts.
 */
export function protectedProcedure(
  action: RateLimitAction = "mutation",
  keyFn?: (rawInput: unknown) => string
) {
  return authed.use(async ({ ctx, next, getRawInput }) => {
    const resourceKey = keyFn ? keyFn(await getRawInput()) : undefined

    // Per-user cap.
    await checkRateLimit(action, `user:${ctx.user.id}`, resourceKey)

    // Guest-only IP backstop: Guests are free to mint (one per anonymous
    // sign-in), so a per-user limit alone is trivially bypassed by rotating
    // Guests. Keying anonymous traffic by IP as well caps the real cost
    // regardless of how many Guest identities a single client spins up.
    // Members are not IP-limited here — they're hard to mint and we don't want
    // to throttle several real Members behind one NAT.
    if (ctx.user.isAnonymous) {
      await checkRateLimit(
        action,
        `ip:${ctx.clientIp ?? "unknown"}`,
        resourceKey
      )
    }

    return next()
  })
}

/**
 * A verified Member. Guests and unverified accounts are rejected — this is the
 * Export gate (ADR-0003). Magic-link and Google sign-ins arrive verified.
 */
export function memberProcedure(
  action: RateLimitAction = "mutation",
  keyFn?: (rawInput: unknown) => string
) {
  return protectedProcedure(action, keyFn).use(({ ctx, next }) => {
    if (ctx.user.isAnonymous || !ctx.user.emailVerified) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Upgrade to a member to continue",
      })
    }
    return next()
  })
}
