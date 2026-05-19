/**
 * Import existing transcripts from R2 into the database.
 *
 * For each PDF in the database, derives the expected transcript R2 key,
 * downloads the .txt file if it exists, and populates textContent +
 * extraction metadata. The FTS trigger auto-builds search_vector.
 *
 * Use this instead of re-running OCR when transcripts already exist in R2.
 *
 * Usage:
 *   pnpm db:import-transcripts
 *   pnpm db:import-transcripts --force   # re-import even if already completed
 */
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { files } from "../lib/db/schema"
import { getFileAsBuffer } from "../lib/r2"
import { extractRelease } from "../lib/r2-paths"

const FORCE = process.argv.includes("--force")
const MAX_DB_TEXT = 1_000_000

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL env var")
    process.exit(1)
  }

  const client = postgres(databaseUrl)
  const db = drizzle(client)

  console.log("Importing transcripts from R2 into database...\n")

  // Get all PDFs that need transcripts
  const conditions = [eq(files.mimeType, "application/pdf")]
  if (!FORCE) {
    conditions.push(eq(files.extractionStatus, "pending"))
  }

  const pdfFiles = await db
    .select({
      id: files.id,
      title: files.title,
      r2Key: files.r2Key,
    })
    .from(files)
    .where(and(...conditions))
    .orderBy(files.id)

  console.log(
    `Found ${pdfFiles.length} PDFs to check${FORCE ? " (--force)" : ""}\n`
  )

  let imported = 0
  let notFound = 0
  let skipped = 0

  for (let i = 0; i < pdfFiles.length; i++) {
    const file = pdfFiles[i]

    if (!file.r2Key) {
      skipped++
      continue
    }

    // Derive the transcript key (same logic as extraction script)
    const release = extractRelease(file.r2Key)
    const filename = file.r2Key
      .split("/")
      .pop()!
      .replace(/\.pdf$/i, "")
    const transcriptKey = release
      ? `assets/${release}/transcripts/${filename}.txt`
      : `assets/transcripts/${filename}.txt`

    // Try to download the transcript from R2
    let textBuffer: Buffer | null = null
    try {
      textBuffer = await getFileAsBuffer(transcriptKey)
    } catch {
      // Not found or error
    }

    if (!textBuffer) {
      console.log(
        `[${i + 1}/${pdfFiles.length}] SKIP: ${file.title} (no transcript in R2)`
      )
      notFound++
      continue
    }

    const fullText = textBuffer.toString("utf-8")
    const textContent =
      fullText.length > MAX_DB_TEXT ? fullText.slice(0, MAX_DB_TEXT) : fullText

    await db
      .update(files)
      .set({
        textContent,
        transcriptR2Key: transcriptKey,
        extractionStatus: "completed",
        extractionMethod: "ocr",
        extractionError: null,
      })
      .where(eq(files.id, file.id))

    imported++
    console.log(
      `[${i + 1}/${pdfFiles.length}] OK: ${file.title} (${fullText.length.toLocaleString()} chars)`
    )
  }

  console.log("\n========================================")
  console.log(`Done! Checked ${pdfFiles.length} PDFs:`)
  console.log(`  Imported:  ${imported}`)
  console.log(`  Not in R2: ${notFound}`)
  console.log(`  Skipped:   ${skipped}`)
  console.log("========================================")

  await client.end()
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
