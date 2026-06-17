import { TRPCError } from "@trpc/server"
import { publicProcedure } from "./init"
import { checkRateLimit, type RateLimitAction } from "./rateLimit"

/**
 * Base middleware: require a signed-in account and narrow `ctx.user` to
 * non-null for downstream resolvers.
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
 * Any signed-in account (the auth-modal gate). Rate limits are **user-keyed**
 * so a shared IP doesn't throttle distinct accounts.
 */
export function protectedProcedure(
  action: RateLimitAction = "mutation",
  keyFn?: (rawInput: unknown) => string
) {
  return authed.use(async ({ ctx, next, getRawInput }) => {
    const resourceKey = keyFn ? keyFn(await getRawInput()) : undefined
    await checkRateLimit(action, `user:${ctx.user.id}`, resourceKey)
    return next()
  })
}

/**
 * A verified Member — unverified accounts are rejected. This is the Clip /
 * Export gate (ADR-0003). Magic-link and Google sign-ins arrive verified.
 */
export function memberProcedure(
  action: RateLimitAction = "mutation",
  keyFn?: (rawInput: unknown) => string
) {
  return protectedProcedure(action, keyFn).use(({ ctx, next }) => {
    if (!ctx.user.emailVerified) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Verify your email to continue",
      })
    }
    return next()
  })
}
