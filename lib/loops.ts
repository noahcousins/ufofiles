import { LoopsClient } from "loops"

const apiKey = process.env.LOOPS_API_KEY

// Like Resend and the Upstash-backed pieces of this app, Loops degrades
// gracefully: with no LOOPS_API_KEY the sync is logged instead of dispatched,
// so local dev and preview builds work without a Loops account.
const loops = apiKey ? new LoopsClient(apiKey) : null

// Splits a display name into firstName / rest on any run of whitespace.
const WHITESPACE = /\s+/

interface SyncContactInput {
  email: string
  emailVerified?: boolean
  name?: string | null
  // Marketing subscription. OMIT to leave Loops' value untouched — an unrelated
  // profile update (email/name change) must not silently re-subscribe someone
  // who unsubscribed. Pass it explicitly (the consent toggle, a new sign-up) to
  // actually change the subscription.
  subscribed?: boolean
  userId: string
}

/**
 * Upsert a user into Loops as a contact, keyed by our stable `userId`. Loops'
 * `updateContact` creates the contact if it doesn't exist, so this is safe to
 * call on both sign-up and later profile changes.
 *
 * Never throws: a Loops outage must not break sign-up or account settings. On
 * failure it logs and returns, matching how `lib/email.tsx` treats Resend.
 *
 * Returns `true` when the upsert reached Loops, `false` when it was skipped
 * (no API key) or errored. Callers in the request path ignore this; the
 * backfill script uses it to tally successes.
 */
export async function syncLoopsContact(
  input: SyncContactInput
): Promise<boolean> {
  if (!loops) {
    console.warn(
      `[loops] LOOPS_API_KEY unset. Skipping contact sync for ${input.email}`
    )
    return false
  }

  const properties: Record<string, string | boolean> = {}

  const name = input.name?.trim()
  if (name) {
    const [firstName, ...rest] = name.split(WHITESPACE)
    properties.firstName = firstName
    if (rest.length > 0) {
      properties.lastName = rest.join(" ")
    }
  }
  if (input.emailVerified !== undefined) {
    properties.emailVerified = input.emailVerified
  }
  if (input.subscribed !== undefined) {
    properties.subscribed = input.subscribed
  }

  try {
    await loops.updateContact({
      email: input.email,
      userId: input.userId,
      properties,
    })
    return true
  } catch (error) {
    console.error(`[loops] Failed to sync contact ${input.email}:`, error)
    return false
  }
}
