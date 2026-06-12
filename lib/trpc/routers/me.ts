import { z } from "zod/v4"
import { router } from "../init"
import { rateLimitedProcedure } from "../rateLimit"

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
)

export const meRouter = router({
  // Public client config — lets the upgrade dialog hide the Google button when
  // OAuth isn't configured for this deployment.
  config: rateLimitedProcedure("query")
    .input(z.void())
    .query(() => ({ googleEnabled })),
})
