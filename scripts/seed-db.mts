import { readFileSync } from "node:fs"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { files, releases } from "../lib/db/schema.js"

const YEAR_RE = /\b(1[89]\d{2}|20\d{2})\b/

function resolveRelease(): string {
  const idx = process.argv.indexOf("--release")
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1]
  }
  return "release-1"
}

function parseIncidentYear(dateStr: string | undefined): number | null {
  if (!dateStr) {
    return null
  }
  const match = dateStr.match(YEAR_RE)
  return match ? Number.parseInt(match[1], 10) : null
}

const RELEASE_META: Record<
  string,
  { title: string; date: string; description: string }
> = {
  "release-1": {
    title: "Release 1",
    date: "2026-05-08",
    description: "Initial release of declassified UAP files",
  },
  "release-2": {
    title: "Release 2",
    date: "2026-05-22",
    description: "Second release of declassified UAP files",
  },
  "release-3": {
    title: "Release 3",
    date: "2026-06-12",
    description: "Third release of declassified UAP files",
  },
}

interface UfoRecord {
  agency: string
  description: string
  documentUrl: string
  imageUrl: string
  incidentDate: string
  incidentLocation: string
  redacted: string
  releaseDate: string
  title: string
  type: string
  videoId: string
}

async function main() {
  const release = resolveRelease()
  console.log(`Seeding database for ${release}\n`)

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL env var")
    process.exit(1)
  }

  const client = postgres(databaseUrl)
  const db = drizzle(client)

  const recordsPath = join(
    import.meta.dirname!,
    "..",
    `ufo-records-${release}.json`
  )
  const records: UfoRecord[] = JSON.parse(readFileSync(recordsPath, "utf-8"))
  console.log(`${records.length} records from ${recordsPath}`)

  const meta = RELEASE_META[release] ?? {
    title: release,
    date: new Date().toISOString().slice(0, 10),
    description: `UAP files ${release}`,
  }

  const shouldClean = process.argv.includes("--clean")

  let [releaseRow] = await db
    .select()
    .from(releases)
    .where(eq(releases.name, release))
    .limit(1)

  if (releaseRow) {
    console.log(`Release "${release}" already exists (id=${releaseRow.id})`)
  } else {
    ;[releaseRow] = await db
      .insert(releases)
      .values({
        name: release,
        title: meta.title,
        releaseDate: meta.date,
        description: meta.description,
      })
      .returning()
    console.log(`Created release "${release}" (id=${releaseRow.id})`)
  }

  if (shouldClean) {
    const deleted = await db
      .delete(files)
      .where(eq(files.releaseId, releaseRow.id))
      .returning({ id: files.id })
    console.log(`--clean: deleted ${deleted.length} existing file records\n`)
  }

  const existing = await db
    .select({ title: files.title })
    .from(files)
    .where(eq(files.releaseId, releaseRow.id))
  const existingTitles = new Set(existing.map((f) => f.title))
  console.log(
    `${existingTitles.size} file records already exist for this release\n`
  )

  let inserted = 0
  for (const r of records) {
    if (existingTitles.has(r.title)) {
      continue
    }

    await db.insert(files).values({
      releaseId: releaseRow.id,
      title: r.title,
      agency: r.agency || "",
      releaseDate: r.releaseDate || null,
      incidentDate: r.incidentDate || null,
      incidentYear: parseIncidentYear(r.incidentDate),
      incidentLocation: r.incidentLocation || null,
      type: r.videoId ? "video" : r.type || "document",
      documentUrl: r.documentUrl || null,
      videoId: r.videoId || null,
      description: r.description || null,
      redacted: r.redacted?.toLowerCase() === "yes",
    })
    inserted++

    if (inserted % 50 === 0) {
      console.log(`  ... ${inserted} records inserted`)
    }
  }

  console.log(`\nDone! Inserted ${inserted} file records for ${release}`)

  await client.end()
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
