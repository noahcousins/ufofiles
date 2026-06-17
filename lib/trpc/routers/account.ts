import { TRPCError } from "@trpc/server"
import { APIError } from "better-auth/api"
import { z } from "zod/v4"
import { auth } from "@/lib/auth"
import { validateSignupEmail } from "@/lib/auth/email-validation"
import { router } from "../init"
import { protectedProcedure } from "../procedures"

/**
 * Self-service account management for the signed-in user: list sign-in methods,
 * change email/password, and link/unlink Google. Email and password are only
 * editable for accounts that have a password (the `credential` provider) —
 * Google / magic-link-only accounts have their email locked to the identity
 * provider. Every call proxies to `auth.api.*`, which need the request headers
 * (the session cookie) — forwarded via `ctx.headers` and narrowed below.
 */

/** Surfaces a better-auth APIError's message instead of a generic 500. */
function toTRPCError(error: unknown, fallback: string): TRPCError {
  if (error instanceof APIError) {
    return new TRPCError({ code: "BAD_REQUEST", message: error.message })
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallback })
}

/** Narrow `ctx.headers` to non-null. Always present for HTTP-called procedures
 *  (the session was resolved from them); absent only on the RSC caller, which
 *  never invokes these. */
function requireHeaders(headers: Headers | undefined): Headers {
  if (!headers) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Missing request context.",
    })
  }
  return headers
}

export const accountRouter = router({
  // Drives the account UI: which sign-in methods exist. `hasPassword` ⇒ signed
  // up with email + password (email + password are editable); `hasGoogle` ⇒ a
  // Google account is linked.
  providers: protectedProcedure("query").query(async ({ ctx }) => {
    const accounts = await auth.api.listUserAccounts({
      headers: requireHeaders(ctx.headers),
    })
    const providers = accounts.map((a) => a.providerId)
    return {
      hasGoogle: providers.includes("google"),
      hasPassword: providers.includes("credential"),
      providers,
    }
  }),

  // Begin linking a Google account: returns the OAuth URL for the client to
  // redirect to. Control comes back to `/account` once Google approves.
  linkGoogle: protectedProcedure("mutation").mutation(async ({ ctx }) => {
    try {
      const result = await auth.api.linkSocialAccount({
        body: { provider: "google", callbackURL: "/account" },
        headers: requireHeaders(ctx.headers),
      })
      return { url: result.url }
    } catch (error) {
      throw toTRPCError(error, "Couldn't start linking Google.")
    }
  }),

  // Remove a linked provider. better-auth refuses to unlink a user's only
  // credential, so this can't lock anyone out — we surface that message.
  unlinkProvider: protectedProcedure("mutation")
    .input(z.object({ providerId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await auth.api.unlinkAccount({
          body: { providerId: input.providerId },
          headers: requireHeaders(ctx.headers),
        })
      } catch (error) {
        throw toTRPCError(error, "Couldn't unlink that account.")
      }
      return { ok: true }
    }),

  // Change email. When the current address is verified, better-auth emails a
  // confirmation link there and defers the change until it's clicked; otherwise
  // it applies immediately. We validate the new address first (ADR-0004), same
  // as signup, so a disposable/undeliverable domain never gets a send.
  changeEmail: protectedProcedure("mutation")
    .input(z.object({ newEmail: z.string().email().max(254) }))
    .mutation(async ({ ctx, input }) => {
      const newEmail = input.newEmail.trim().toLowerCase()
      if (newEmail === ctx.user.email.toLowerCase()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That's already your email.",
        })
      }
      const valid = await validateSignupEmail(newEmail)
      if (!valid.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: valid.reason ?? "Enter a valid email address.",
        })
      }
      try {
        await auth.api.changeEmail({
          body: { newEmail, callbackURL: "/account" },
          headers: requireHeaders(ctx.headers),
        })
      } catch (error) {
        throw toTRPCError(error, "Couldn't change your email.")
      }
      // Pre-change verified state decides the UX copy: verified ⇒ "confirm via
      // the link we just emailed your current address"; unverified ⇒ done now.
      return { confirmationSent: ctx.user.emailVerified }
    }),

  // Change password. Requires the current password (better-auth verifies it)
  // and revokes other sessions so a leaked one can't survive a rotation.
  changePassword: protectedProcedure("mutation")
    .input(
      z.object({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(8).max(128),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await auth.api.changePassword({
          body: {
            currentPassword: input.currentPassword,
            newPassword: input.newPassword,
            revokeOtherSessions: true,
          },
          headers: requireHeaders(ctx.headers),
        })
      } catch (error) {
        throw toTRPCError(error, "Couldn't change your password.")
      }
      return { ok: true }
    }),
})
