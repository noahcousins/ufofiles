import { eq, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { files, videoMoments } from "../lib/db/schema.js"
import { parseVideoMoments } from "../lib/video-moments.js"

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)

async function main() {
  const rows = await db
    .select({
      id: files.id,
      title: files.title,
      description: files.description,
    })
    .from(files)
    .where(
      sql`${files.mimeType} ILIKE 'video/%' AND ${files.description} IS NOT NULL`
    )

  let videosWithMoments = 0
  let totalMoments = 0

  for (const row of rows) {
    if (!row.description) {
      continue
    }

    const moments = parseVideoMoments(row.description)

    await db.delete(videoMoments).where(eq(videoMoments.fileId, row.id))

    if (moments.length === 0) {
      continue
    }

    await db.insert(videoMoments).values(
      moments.map((m) => ({
        fileId: row.id,
        startSeconds: m.startSeconds,
        endSeconds: m.endSeconds,
        description: m.description,
        sortOrder: m.sortOrder,
      }))
    )

    videosWithMoments++
    totalMoments += moments.length
    console.log(`  ${row.title}: ${moments.length} moments`)
  }

  console.log(
    `\nDone: ${videosWithMoments} videos, ${totalMoments} moments inserted`
  )
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
