// Insert the reviewed Gemini draft moments (scripts/test/outputs/moments/)
// into video_moments with source='ai-generated'. Safety rails:
//   - never touches a file that already has official moments
//   - only deletes/replaces rows it owns (source='ai-generated')
//   - skips drafts that failed to parse, and lone full-clip moments
//     (parseVideoMoments drops those for official text; mirror that here)
//   - --dry-run prints what it would do without writing
//
//   pnpm tsx scripts/populate-ai-moments.ts [--dry-run]
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { videoMoments } from "../lib/db/schema.js"

const DRAFTS_DIR = "scripts/test/outputs/moments"
const dryRun = process.argv.includes("--dry-run")

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)

interface Draft {
  durationSeconds: number
  fileId?: number
  moments:
    | { startSeconds: number; endSeconds: number; description: string }[]
    | null
  parseError: string | null
  prefix: string
  release: string
}

function loadDrafts(): Draft[] {
  const drafts: Draft[] = []
  for (const release of readdirSync(DRAFTS_DIR)) {
    const dir = join(DRAFTS_DIR, release)
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) {
        continue
      }
      drafts.push(JSON.parse(readFileSync(join(dir, name), "utf-8")))
    }
  }
  return drafts
}

async function main() {
  const officialFileIds = new Set(
    (
      await db
        .select({ fileId: videoMoments.fileId })
        .from(videoMoments)
        .where(eq(videoMoments.source, "official"))
    ).map((r) => r.fileId)
  )

  let inserted = 0
  let videos = 0

  for (const draft of loadDrafts()) {
    const label = `${draft.release}/${draft.prefix}`

    if (draft.fileId === undefined) {
      console.log(`  SKIP ${label}: no fileId (pre-batch draft format)`)
      continue
    }
    if (draft.parseError || !draft.moments || draft.moments.length === 0) {
      console.log(`  SKIP ${label}: no usable moments`)
      continue
    }
    if (officialFileIds.has(draft.fileId)) {
      console.log(`  SKIP ${label}: file already has official moments`)
      continue
    }
    if (draft.moments.length === 1 && draft.moments[0].startSeconds === 0) {
      console.log(`  SKIP ${label}: single full-clip moment (would not render)`)
      continue
    }

    const rows = [...draft.moments]
      .sort((a, b) => a.startSeconds - b.startSeconds)
      .map((m, i) => ({
        fileId: draft.fileId as number,
        startSeconds: m.startSeconds,
        endSeconds: Math.min(m.endSeconds, draft.durationSeconds),
        description: m.description,
        source: "ai-generated",
        sortOrder: i,
      }))

    if (dryRun) {
      console.log(`  DRY ${label}: would insert ${rows.length} moments`)
    } else {
      await db
        .delete(videoMoments)
        .where(
          and(
            eq(videoMoments.fileId, draft.fileId),
            eq(videoMoments.source, "ai-generated")
          )
        )
      await db.insert(videoMoments).values(rows)
      console.log(`  ${label}: ${rows.length} moments`)
    }

    videos++
    inserted += rows.length
  }

  console.log(
    `\n${dryRun ? "Dry run: would insert" : "Done:"} ${inserted} ai-generated moments across ${videos} videos`
  )
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
