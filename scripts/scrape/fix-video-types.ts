import { and, eq, inArray, like, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { files, releases } from "../../lib/db/schema"
import { RELEASE } from "./config"
import { info, summary } from "./logger"

const D_FILES = [
  {
    r2Key: `source/${RELEASE}/DOW-UAP-D10__Mission_Report__Middle_East__May_2022.mp4`,
    title: "DOW-UAP-D10, Mission Report, Middle East, May 2022",
    size: 6_815_744,
  },
  {
    r2Key: `source/${RELEASE}/DOW-UAP-D14__Mission_Report__Iraq__May_2022.mp4`,
    title: "DOW-UAP-D14, Mission Report, Iraq, May 2022",
    size: 12_793_856,
  },
  {
    r2Key: `source/${RELEASE}/DOW-UAP-D16__Mission_Report__Syria__July_2022.mp4`,
    title: "DOW-UAP-D16, Mission Report, Syria, July 2022",
    size: 3_985_408,
  },
  {
    r2Key: `source/${RELEASE}/DOW-UAP-D18__Mission_Report__Iraq__December_2022.mp4`,
    title: "DOW-UAP-D18, Mission Report, Iraq, December 2022",
    size: 5_347_737,
  },
  {
    r2Key: `source/${RELEASE}/DOW-UAP-D23__Mission_Report__United_Arab_Emirates__October_2023.mp4`,
    title: "DOW-UAP-D23, Mission Report, United Arab Emirates, October 2023",
    size: 27_472_691,
  },
  {
    r2Key: `source/${RELEASE}/DOW-UAP-D32__Mission_Report__Syria__October_2024.mp4`,
    title: "DOW-UAP-D32, Mission Report, Syria, October 2024",
    size: 629_145,
  },
  {
    r2Key: `source/${RELEASE}/DOW-UAP-D33__Mission_Report__Greece__October_2023.mp4`,
    title: "DOW-UAP-D33, Mission Report, Greece, October 2023",
    size: 198_280_806,
  },
  {
    r2Key: `source/${RELEASE}/DOW-UAP-D35__Mission_Report__Greece__October_2023.mp4`,
    title: "DOW-UAP-D35, Mission Report, Greece, October 2023",
    size: 2_411_724,
  },
  {
    r2Key: `source/${RELEASE}/DOW-UAP-D38__Range_Fouler_Debrief__Middle_East__May_2020.mp4`,
    title: "DOW-UAP-D38, Range Fouler Debrief, Middle East, May 2020",
    size: 142_739_456,
  },
]

export async function main() {
  info("Fix: Correcting video/PDF type mismatches\n")

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL env var")
    process.exit(1)
  }

  const client = postgres(databaseUrl)
  const db = drizzle(client)

  // fix VID records that actually point to PDFs
  const fixed = await db
    .update(files)
    .set({ type: "PDF", mimeType: "application/pdf" })
    .where(and(eq(files.type, "VID"), like(files.r2Key, "%.pdf")))
    .returning({ id: files.id, title: files.title })

  info(`Fixed ${fixed.length} VID → PDF:`)
  for (const r of fixed) {
    info(`  id=${r.id} ${r.title}`)
  }

  // get release
  const [release] = await db
    .select({ id: releases.id })
    .from(releases)
    .where(eq(releases.name, RELEASE))
    .limit(1)

  if (!release) {
    console.error(
      `Release "${RELEASE}" not found in database. Run db:seed first.`
    )
    await client.end()
    process.exit(1)
  }
  info(`\nRelease "${RELEASE}" (id=${release.id})`)

  // insert missing D* video records
  const r2Keys = D_FILES.map((f) => f.r2Key)
  const existing = await db
    .select({ r2Key: files.r2Key })
    .from(files)
    .where(inArray(files.r2Key, r2Keys))

  const existingKeys = new Set(existing.map((r) => r.r2Key))
  const toInsert = D_FILES.filter((f) => !existingKeys.has(f.r2Key))

  info(`Already exist: ${existingKeys.size}`)
  info(`To insert: ${toInsert.length}`)

  for (const f of toInsert) {
    const [inserted] = await db
      .insert(files)
      .values({
        releaseId: release.id,
        title: f.title,
        agency: "Department of War",
        type: "VID",
        r2Key: f.r2Key,
        fileSize: f.size,
        mimeType: "video/mp4",
      })
      .returning({ id: files.id, title: files.title })

    info(`  Inserted id=${inserted.id} ${inserted.title}`)
  }

  // final counts
  const counts = await db
    .select({
      type: files.type,
      count: sql<number>`count(*)::int`,
    })
    .from(files)
    .groupBy(files.type)
    .orderBy(files.type)

  summary([
    `Fixed ${fixed.length} VID → PDF, inserted ${toInsert.length} video records`,
    "",
    "Final type counts:",
    ...counts.map((r) => `  ${r.type}: ${r.count}`),
  ])

  await client.end()
}

if (process.argv[1]?.includes("fix-video-types")) {
  main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
  })
}
