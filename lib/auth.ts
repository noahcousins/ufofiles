import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { anonymous, captcha, magicLink } from "better-auth/plugins"
import { mergeGuestMarksIntoMember } from "@/lib/auth/merge-marks"
import { db } from "@/lib/db"
import { account, session, user, verification } from "@/lib/db/schema"
import { sendMagicLinkEmail, sendVerificationEmail } from "@/lib/email"

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

// Cloudflare Turnstile guards the email/credential endpoints (NOT the silent
// anonymous guest mint — that must stay frictionless). Only enabled when BOTH
// keys are present: enabling the server check without the client widget would
// reject every real sign-in with MISSING_RESPONSE.
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

  // Rate limiting for the unauthenticated /api/auth/* surface. The anonymous
  // sign-in endpoint mints a Guest (a DB row) per call, so it's the real
  // unauth entry point and gets the tightest cap; magic-link / sign-up are
  // throttled to blunt email-spam and account-stuffing. NOTE: storage is
  // in-memory (per instance) — on a multi-instance/serverless deploy switch
  // `storage` to "database" (adds a `rateLimit` table) for a shared counter.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/anonymous": { window: 60, max: 5 },
      "/sign-in/magic-link": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/sign-in/email": { window: 60, max: 10 },
    },
  },

  // Members can use email/password, magic link, or Google. Password sign-ups
  // start unverified and sign in immediately, but stay non-Members (can't
  // Export) until they verify — the Export gate keys off `emailVerified`.
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url)
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

  plugins: [
    // Guests: a credential-less user created on the visitor's first mark.
    anonymous({
      // Fires when a Guest signs in / links a real account. Merge the Guest's
      // marks into the Member, then the plugin deletes the Guest identity.
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await mergeGuestMarksIntoMember(
          db,
          anonymousUser.user.id,
          newUser.user.id
        )
      },
    }),

    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url)
      },
    }),

    ...captchaPlugins,

    // Must be last: lets better-auth set cookies from Next server actions.
    nextCookies(),
  ],
})
