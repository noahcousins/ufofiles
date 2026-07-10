import { eq } from "drizzle-orm"
import { z } from "zod/v4"
import { db } from "@/lib/db"
import { userMarketingPreferences } from "@/lib/db/schema"
import { syncLoopsContact } from "@/lib/loops"
import { router } from "../init"
import { protectedProcedure } from "../procedures"

// Email-marketing opt-in for the signed-in user — an explicit permission to
// send product emails, distinct from cookie/analytics consent. Set by a real
// checkbox in account settings. One row per user, upserted.
export const marketingRouter = router({
  get: protectedProcedure("query")
    .input(z.void())
    .query(async ({ ctx }) => {
      const row = await db.query.userMarketingPreferences.findFirst({
        where: eq(userMarketingPreferences.userId, ctx.user.id),
      })
      // Opt-out model: no row means the user is subscribed (the default). A row
      // with `false` is an explicit opt-out. The send-list is therefore every
      // user EXCEPT those with a row where marketing_consent = false.
      return { consent: row?.marketingConsent ?? true }
    }),

  setConsent: protectedProcedure("mutation")
    .input(z.object({ consent: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .insert(userMarketingPreferences)
        .values({ userId: ctx.user.id, marketingConsent: input.consent })
        .onConflictDoUpdate({
          target: userMarketingPreferences.userId,
          set: { marketingConsent: input.consent, updatedAt: new Date() },
        })
      // Mirror the opt-in/out to Loops so the send-list stays in sync. Best
      // effort — `syncLoopsContact` swallows failures, and Postgres remains the
      // source of truth if Loops is unreachable.
      await syncLoopsContact({
        email: ctx.user.email,
        userId: ctx.user.id,
        subscribed: input.consent,
      })
      return { consent: input.consent }
    }),
})
