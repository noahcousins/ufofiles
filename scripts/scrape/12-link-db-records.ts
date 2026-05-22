import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { files, releases } from "../../lib/db/schema"
import { RECORDS_PATH, RELEASE, SOURCE_DIR, TRANSCRIPT_DIR } from "./config"
import { info, summary } from "./logger"
import type { UfoRecord } from "./types"
import { getExtension, getMimeType } from "./utils"

const SAFE_NAME_RE = /[^a-zA-Z0-9_-]/g
const TXT_EXT_RE = /\.txt$/i
const FILE_EXT_RE = /\.[^.]+$/
const MAX_DB_TEXT = 1_000_000

/** try to find a local file matching a record's title (doc, video, or collision-suffixed). */
function findLocalFile(
  r: UfoRecord,
  fileSizes: Map<string, number>,
  videoIdToFile?: Map<string, string>
): string | null {
  const base = r.title.replace(SAFE_NAME_RE, "_")

  // check document name first (PDF, image, etc.)
  const ext = getExtension(r.documentUrl, r.type)
  const docName = base + ext
  if (fileSizes.has(docName)) {
    return docName
  }

  // check video name
  const videoName = `${base}.mp4`
  if (fileSizes.has(videoName)) {
    return videoName
  }

  // check video-ID-suffixed names (from collision handling in 04-download-videos)
  if (r.videoId) {
    const vidSuffixed = `${base}_vid${r.videoId}.mp4`
    if (fileSizes.has(vidSuffixed)) {
      return vidSuffixed
    }
  }

  // check by filename from documentUrl (files may have been saved with their original name)
  if (r.documentUrl) {
    const urlFilename = decodeURIComponent(r.documentUrl.split("?")[0].split("/").pop() ?? "")
    if (urlFilename && fileSizes.has(urlFilename)) {
      return urlFilename
    }
  }

  // check videoId→file map (handles duplicates saved under a different title)
  if (r.videoId && videoIdToFile) {
    const match = videoIdToFile.get(r.videoId)
    if (match && fileSizes.has(match)) {
      return match
    }
  }

  return null
}

/** Read transcript .txt files into a map keyed by filename stem. */
function buildTranscriptMap(): Map<string, string> {
  const map = new Map<string, string>()
  try {
    for (const f of readdirSync(TRANSCRIPT_DIR)) {
      if (f.endsWith(".txt")) {
        const content = readFileSync(join(TRANSCRIPT_DIR, f), "utf-8").trim()
        if (content.length > 0) {
          map.set(f.replace(TXT_EXT_RE, ""), content)
        }
      }
    }
  } catch {
    // transcripts dir may not exist
  }
  return map
}

/** Cap text to MAX_DB_TEXT for the DB column, or null if no text. */
function capText(raw: string | undefined): string | null {
  if (!raw) {
    return null
  }
  return raw.length > MAX_DB_TEXT ? raw.slice(0, MAX_DB_TEXT) : raw
}

export async function main() {
  info("Step 12: Linking local files to database records\n")

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL env var")
    process.exit(1)
  }

  const client = postgres(databaseUrl)
  const db = drizzle(client)
  info("Connected to database\n")

  // load records from JSON (same source as seed-db)
  const records: UfoRecord[] = JSON.parse(readFileSync(RECORDS_PATH, "utf-8"))
  info(`${records.length} records from ufo-records.json`)

  // build local file size map
  const fileSizes = new Map<string, number>()
  for (const f of readdirSync(SOURCE_DIR)) {
    const stat = statSync(join(SOURCE_DIR, f))
    if (!stat.isDirectory()) {
      fileSizes.set(f, stat.size)
    }
  }
  info(`${fileSizes.size} local files found`)

  const transcripts = buildTranscriptMap()
  info(`${transcripts.size} transcripts found\n`)

  // find the release
  const [release] = await db
    .select()
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
  info(`Release "${RELEASE}" (id=${release.id})\n`)

  // load all existing DB file records for this release
  const dbFiles = await db
    .select({ id: files.id, title: files.title })
    .from(files)
    .where(eq(files.releaseId, release.id))

  const titleToId = new Map<string, number>()
  for (const f of dbFiles) {
    titleToId.set(f.title, f.id)
  }
  info(`${dbFiles.length} file records in database for this release\n`)

  // build videoId→filename map so duplicate-videoId records can find the file
  const videoIdToFile = new Map<string, string>()
  for (const r of records) {
    if (r.videoId) {
      const base = r.title.replace(SAFE_NAME_RE, "_")
      const videoName = `${base}.mp4`
      if (fileSizes.has(videoName)) {
        videoIdToFile.set(r.videoId, videoName)
      }
    }
  }

  // match and update
  let updated = 0
  let noFile = 0
  let noDbRecord = 0

  for (const r of records) {
    const localName = findLocalFile(r, fileSizes, videoIdToFile)

    if (!localName) {
      noFile++
      continue
    }

    const fileId = titleToId.get(r.title)
    if (!fileId) {
      noDbRecord++
      continue
    }

    const fileSize = fileSizes.get(localName)
    const r2Key = `source/${RELEASE}/${localName}`
    const mimeType = getMimeType(localName)

    // look up transcript for this file
    const stem = localName.replace(FILE_EXT_RE, "")
    const rawText = transcripts.get(stem)
    const textContent = capText(rawText)
    const transcriptR2Key = rawText
      ? `assets/${RELEASE}/transcripts/${stem}.txt`
      : null

    await db
      .update(files)
      .set({ r2Key, fileSize, mimeType, textContent, transcriptR2Key })
      .where(and(eq(files.id, fileId), eq(files.releaseId, release.id)))

    updated++

    if (updated % 50 === 0) {
      info(`  ... ${updated} records updated`)
    }
  }

  info(`\nUpdated ${updated} records`)
  if (noFile > 0) {
    info(`  ${noFile} records had no matching local file`)
  }
  if (noDbRecord > 0) {
    info(`  ${noDbRecord} records had no matching DB row (run db:seed first)`)
  }

  summary([
    `Done! ${updated} file records linked to R2`,
    `r2Key format: source/${RELEASE}/{filename}`,
  ])

  await client.end()
}

if (process.argv[1]?.includes("12-link-db-records")) {
  main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
  })
}
