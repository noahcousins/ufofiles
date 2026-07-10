import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { captcha, emailOTP, magicLink } from "better-auth/plugins"
import { headers } from "next/headers"
import { cache } from "react"
import { validateSignupEmail } from "@/lib/auth/email-validation"
import { db } from "@/lib/db"
import { account, session, user, verification } from "@/lib/db/schema"
import {
  sendChangeEmailVerificationEmail,
  sendEmailVerificationEmail,
  sendMagicLinkEmail,
  sendResetPasswordEmail,
  sendVerificationOtpEmail,
} from "@/lib/email"
import { syncLoopsContact } from "@/lib/loops"

// Endpoints that take an email in the body and (would) send to it / create an
// account. We validate the address before any of that happens (ADR-0004).
// Google OAuth carries no email in the body, so it's never matched — correct,
// since Google addresses arrive valid + verified.
const EMAIL_VALIDATION_ENDPOINTS = new Set([
  "/sign-up/email",
  "/sign-in/magic-link",
  "/email-otp/send-verification-otp",
  "/request-password-reset",
])

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

// Cloudflare Turnstile guards the email/credential endpoints. Only enabled when
// BOTH keys are present: enabling the server check without the client widget
// would reject every real sign-in with MISSING_RESPONSE.
const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const captchaPlugins =
  turnstileSecret && turnstileSiteKey
    ? [
        captcha({
          provider: "cloudflare-turnstile",
          secretKey: turnstileSecret,
          endpoints: [
            "/sign-up/email",
            "/sign-in/email",
            "/sign-in/magic-link",
            // Email-send endpoints: gate the manual resend / reset-request too,
            // so the Resend-cost abuse path isn't captcha-free (the initial OTP
            // send rides /sign-up/email, already covered above).
            "/email-otp/send-verification-otp",
            "/request-password-reset",
          ],
        }),
      ]
    : []

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),

  // Branded, explicit cookie names (e.g. `ufofiles.session_token`). Changing
  // the prefix renames the cookie, so any sessions live at deploy time are
  // invalidated once. `useSecureCookies` is gated to production because local
  // dev runs over plain http://localhost, where Secure cookies are dropped.
  advanced: {
    cookiePrefix: "ufofiles",
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  // Explicit allow-list of origins better-auth honours for callbacks / CSRF.
  // baseURL is trusted automatically; this adds the public domains plus a
  // localhost fallback in dev.
  trustedOrigins: [
    "https://showmeufos.com",
    "https://www.showmeufos.com",
    ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000"]),
  ],

  // Cache the session in a short-lived signed cookie so `getSession()` reads
  // the cookie instead of querying Postgres on every call — notably the
  // magic-link "check your email" tab, which polls it. better-auth refreshes
  // the cache whenever the session changes (sign-in/out, email verification).
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  // Rate limiting for the unauthenticated /api/auth/* surface. Magic-link /
  // sign-up are throttled to blunt email-spam and account-stuffing. NOTE:
  // storage is in-memory (per instance) — on a multi-instance/serverless
  // deploy switch `storage` to "database" (adds a `rateLimit` table) for a
  // shared counter.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/magic-link": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/sign-in/email": { window: 60, max: 10 },
      "/email-otp/send-verification-otp": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 5 },
    },
  },

  // Members can use email/password, magic link, or Google. Password sign-ups
  // start unverified and sign in immediately, but stay non-Members (can't
  // Export) until they verify — the Export gate keys off `emailVerified`.
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    // Password reset: `requestPasswordReset` emails this link, which hits the
    // server reset endpoint, validates the token, and redirects to
    // /reset-password?token=… where the user picks a new password.
    sendResetPassword: async ({ user: u, url }) => {
      await sendResetPasswordEmail(u.email, url)
    },
  },

  // Let signed-in users link/unlink a Google account from the account page.
  // Trusting Google means a Google sign-in can attach to an existing account
  // with the same email; `unlinkAccount` refuses to remove a user's only
  // credential, so no one can lock themselves out.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  // Link-based email verification. Sign-up verification runs through the email
  // OTP plugin, but better-auth's change-email *confirmation* path is gated on a
  // configured `sendVerificationEmail` (and its `/verify-email` endpoint is what
  // the confirmation link resolves to), so it must exist here.
  emailVerification: {
    sendVerificationEmail: async ({ user: u, url }) => {
      await sendEmailVerificationEmail(u.email, url)
    },
  },

  // Let signed-in users change their email from the account page. When the
  // current email is verified, better-auth sends a confirmation link to that
  // *current* address and only applies the change once it's clicked — so a
  // hijacked session can't quietly move the account. Unverified accounts have
  // no trusted address to confirm against, so the change applies immediately.
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
      sendChangeEmailConfirmation: async ({
        user: u,
        newEmail,
        url,
      }: {
        newEmail: string
        url: string
        user: { email: string }
      }) => {
        await sendChangeEmailVerificationEmail(u.email, newEmail, url)
      },
    },
  },

  // Only advertise Google when it's actually configured. The client reads this
  // through the session/me surface to decide whether to render the button.
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : undefined,

  // Mirror every account into Loops as a contact (the marketing send-list).
  // Runs for all providers (email/password, magic link, Google). Failures are
  // swallowed inside `syncLoopsContact`, so a Loops outage never breaks auth.
  databaseHooks: {
    user: {
      create: {
        after: async (u) => {
          // New sign-up: no marketing-preference row exists yet, and the
          // opt-out model treats "no row" as subscribed — so seed the contact
          // subscribed. The account-settings toggle can flip it later.
          await syncLoopsContact({
            email: u.email,
            userId: u.id,
            name: u.name,
            emailVerified: u.emailVerified,
            subscribed: true,
          })
        },
      },
      update: {
        after: async (u) => {
          // Email / name / verification changes: keep the contact fresh.
          // `subscribed` is intentionally omitted so a profile update never
          // overrides an unsubscribe made in Loops or via the consent toggle.
          await syncLoopsContact({
            email: u.email,
            userId: u.id,
            name: u.name,
            emailVerified: u.emailVerified,
          })
        },
      },
    },
  },

  // Validate the email before any send/create on the email-bearing endpoints
  // (ADR-0004): reject disposable / undeliverable domains up front so a bad
  // address never costs us a Resend send. Runs after Turnstile/rate-limit.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!EMAIL_VALIDATION_ENDPOINTS.has(ctx.path)) {
        return
      }
      const email = (ctx.body as { email?: unknown } | undefined)?.email
      if (typeof email !== "string") {
        return
      }
      const result = await validateSignupEmail(email)
      if (!result.ok) {
        throw new APIError("BAD_REQUEST", {
          message: result.reason ?? "Enter a valid email address.",
        })
      }
    }),
  },

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url)
      },
    }),

    // Email verification by one-time code (not a link). `sendVerificationOnSignUp`
    // fires the code during /sign-up/email; the client finishes with
    // `emailOTP.verifyEmail`, which flips `emailVerified` → Member.
    emailOTP({
      sendVerificationOnSignUp: true,
      sendVerificationOTP: async ({ email, otp }) => {
        await sendVerificationOtpEmail(email, otp)
      },
    }),

    ...captchaPlugins,

    // Must be last: lets better-auth set cookies from Next server actions.
    nextCookies(),
  ],
})

/**
 * Server-side session read, memoized per request via React `cache()`. On a
 * single request the root layout (seeds the client store) and the (protected)
 * layout (auth guard) both read the session — `cache()` collapses that into one
 * lookup instead of two.
 */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() })
)
