/**
 * Backfill existing accounts into Loops as contacts.
 *
 * The `databaseHooks` in `lib/auth.ts` only sync accounts created or updated
 * once the Loops integration shipped. This one-off script pushes every
 * existing user into Loops so the send-list is complete. It's idempotent —
 * Loops `updateContact` upserts by `userId`, so re-running just refreshes.
 *
 * Subscription status follows the same opt-out model as the app: a user is
 * `subscribed` unless they have a marketing-preferences row set to `false`.
 *
 * Usage:
 *   pnpm db:backfill-loops              # sync everyone
 *   pnpm db:backfill-loops --dry-run    # print what would sync, call nothing
 *   pnpm db:backfill-loops --limit 50   # only the first 50 (by created_at)
 */
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { user, userMarketingPreferences } from "../lib/db/schema"
import { syncLoopsContact } from "../lib/loops"

const DRY_RUN = process.argv.includes("--dry-run")

// Loops' API allows ~10 requests/second. We sync sequentially with a pause
// between calls to stay comfortably under that, so a large table can't trip
// the rate limiter mid-run.
const PACE_MS = 150

function parseLimit(): number | undefined {
  const idx = process.argv.indexOf("--limit")
  if (idx === -1) {
    return
  }
  const value = Number.parseInt(process.argv[idx + 1] ?? "", 10)
  if (!Number.isInteger(value) || value <= 0) {
    console.error("--limit needs a positive integer")
    process.exit(1)
  }
  return value
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL env var")
    process.exit(1)
  }
  // Fail fast rather than logging one skip warning per contact.
  if (!(DRY_RUN || process.env.LOOPS_API_KEY)) {
    console.error("Missing LOOPS_API_KEY env var (or pass --dry-run)")
    process.exit(1)
  }

  const limit = parseLimit()
  const client = postgres(databaseUrl)
  const db = drizzle(client)

  // Left join preferences: most users have no row, which the opt-out model
  // treats as subscribed. An explicit `false` row is the only opt-out.
  const query = db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      marketingConsent: userMarketingPreferences.marketingConsent,
    })
    .from(user)
    .leftJoin(
      userMarketingPreferences,
      eq(user.id, userMarketingPreferences.userId)
    )
    .orderBy(user.createdAt)

  const rows = limit ? await query.limit(limit) : await query

  console.log(
    `${DRY_RUN ? "[dry-run] " : ""}Backfilling ${rows.length} contact(s) into Loops...\n`
  )

  let synced = 0
  let failed = 0
  for (const [i, row] of rows.entries()) {
    const subscribed = row.marketingConsent ?? true
    const label = `[${i + 1}/${rows.length}] ${row.email}${subscribed ? "" : " (unsubscribed)"}`

    if (DRY_RUN) {
      console.log(`${label} — would sync`)
      continue
    }

    const ok = await syncLoopsContact({
      email: row.email,
      userId: row.id,
      name: row.name,
      emailVerified: row.emailVerified,
      subscribed,
    })
    if (ok) {
      synced++
      console.log(`${label} — OK`)
    } else {
      failed++
      console.log(`${label} — FAILED (see error above)`)
    }

    if (i < rows.length - 1) {
      await delay(PACE_MS)
    }
  }

  console.log("\n========================================")
  if (DRY_RUN) {
    console.log(`Dry run: ${rows.length} contact(s) would be synced.`)
  } else {
    console.log(`Done! ${rows.length} contact(s) processed:`)
    console.log(`  Synced: ${synced}`)
    console.log(`  Failed: ${failed}`)
  }
  console.log("========================================")

  await client.end()
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
