/**
 * Step 13: Extract text from PDFs using hybrid pipeline (fully local, free)
 *
 * For each PDF in the database that hasn't been processed:
 * 1. Try pdf-parse (text layer extraction) for text-selectable PDFs
 * 2. Fall back to local Tesseract OCR for scanned/faded/handwritten docs
 *    (pdftoppm converts pages to images, tesseract OCRs each image)
 *
 * Requires: brew install poppler tesseract
 *
 * Usage:
 *   pnpm scrape:extract-ocr
 *   pnpm scrape:extract-ocr --force    # re-process all, even completed
 *   pnpm scrape:extract-ocr --limit 10 # process only 10 files
 */
import { execFileSync } from "node:child_process"
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { files } from "../../lib/db/schema"
import { getFileAsBuffer, putFile } from "../../lib/r2"
import { extractRelease } from "../../lib/r2-paths"
import { info, progress, summary } from "./logger"
import { requireBinary } from "./utils"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const FORCE = process.argv.includes("--force")
const LIMIT_FLAG = process.argv.indexOf("--limit")
const LIMIT =
  LIMIT_FLAG === -1 ? undefined : Number(process.argv[LIMIT_FLAG + 1])

/** Minimum alphabetic chars to consider extraction successful. */
const MIN_TEXT_LENGTH = 100
/** Maximum text length stored in the DB column. */
const MAX_DB_TEXT = 1_000_000
/** Page number markers that pdf-parse extracts from scanned PDFs with no real text. */
const PAGE_MARKER_RE = /^\s*-{1,3}\s*\d+\s*(of|\/)\s*\d+\s*-{1,3}\s*$/gim
/** Only count actual letters as "meaningful" */
const WORD_CHARS_RE = /[a-zA-Z]/g

/** Check if extracted text has enough real content (not just page markers). */
function hasMeaningfulText(text: string): boolean {
  const stripped = text.replace(PAGE_MARKER_RE, "")
  const letters = stripped.match(WORD_CHARS_RE)
  return (letters?.length ?? 0) >= MIN_TEXT_LENGTH
}

/**
 * OCR a PDF buffer using pdftoppm + tesseract (fully local).
 * Converts each page to a PNG, runs tesseract on each, concatenates results.
 */
function ocrPdfWithTesseract(pdfBuffer: Buffer): string {
  // Create a temp directory for this PDF's processing
  const tmpDir = join(tmpdir(), `ocr-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(tmpDir, { recursive: true })

  try {
    // Write the PDF to a temp file
    const pdfPath = join(tmpDir, "input.pdf")
    writeFileSync(pdfPath, pdfBuffer)

    // Convert PDF pages to PNG images using pdftoppm
    const pagesPrefix = join(tmpDir, "page")
    execFileSync("pdftoppm", ["-png", "-r", "200", pdfPath, pagesPrefix], {
      stdio: "pipe",
      timeout: 900_000, // 15 min max for conversion (large scanned PDFs)
    })

    // Find all generated page images and sort them
    const pageImages = readdirSync(tmpDir)
      .filter((f) => f.startsWith("page-") && f.endsWith(".png"))
      .sort()

    if (pageImages.length === 0) {
      return ""
    }

    // OCR each page with tesseract
    const pageTexts: string[] = []
    for (const img of pageImages) {
      const imgPath = join(tmpDir, img)
      try {
        const text = execFileSync("tesseract", [imgPath, "stdout"], {
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 60_000, // 1 min per page max
          encoding: "utf-8",
        })
        pageTexts.push(text.trim())
      } catch {
        // Skip pages that fail OCR
        pageTexts.push("")
      }
    }

    return pageTexts.filter(Boolean).join("\n\n")
  } finally {
    // Clean up temp directory
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  info("Step 13: Extracting text from PDFs (hybrid text + local OCR pipeline)\n")

  requireBinary("pdftoppm", "brew install poppler")
  requireBinary("tesseract", "brew install tesseract")

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL env var")
    process.exit(1)
  }

  const client = postgres(databaseUrl)
  const db = drizzle(client)
  info("Connected to database\n")

  // Fetch PDFs to process
  const conditions = [eq(files.mimeType, "application/pdf")]
  if (!FORCE) {
    conditions.push(eq(files.extractionStatus, "pending"))
  }

  let pdfFiles = await db
    .select({
      id: files.id,
      title: files.title,
      r2Key: files.r2Key,
      mimeType: files.mimeType,
    })
    .from(files)
    .where(and(...conditions))
    .orderBy(files.id)

  if (LIMIT) {
    pdfFiles = pdfFiles.slice(0, LIMIT)
  }

  info(`Found ${pdfFiles.length} PDFs to process${FORCE ? " (--force)" : ""}\n`)

  if (pdfFiles.length === 0) {
    summary(["No PDFs to process. All done!"])
    await client.end()
    return
  }

  // Stats
  const stats = { textExtracted: 0, ocrExtracted: 0, failed: 0, skipped: 0 }

  for (let i = 0; i < pdfFiles.length; i++) {
    const file = pdfFiles[i]

    if (!file.r2Key) {
      progress(i, pdfFiles.length, "SKIP", file.title, "no R2 key")
      await db
        .update(files)
        .set({ extractionStatus: "skipped", extractionError: "No R2 key" })
        .where(eq(files.id, file.id))
      stats.skipped++
      continue
    }

    // Mark as processing
    await db
      .update(files)
      .set({ extractionStatus: "processing", extractionError: null })
      .where(eq(files.id, file.id))

    // Download PDF from R2
    let pdfBuffer: Buffer | null = null
    try {
      pdfBuffer = await getFileAsBuffer(file.r2Key)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      progress(i, pdfFiles.length, "FAIL", file.title, `download failed: ${msg.slice(0, 80)}`)
      await db
        .update(files)
        .set({
          extractionStatus: "failed",
          extractionError: `Download failed: ${msg.slice(0, 500)}`,
        })
        .where(eq(files.id, file.id))
      stats.failed++
      continue
    }

    if (!pdfBuffer) {
      progress(i, pdfFiles.length, "FAIL", file.title, "not found in R2")
      await db
        .update(files)
        .set({ extractionStatus: "failed", extractionError: "PDF not found in R2" })
        .where(eq(files.id, file.id))
      stats.failed++
      continue
    }

    // --- Step 1: Try pdf-parse (text layer, free, fast) ---
    let extractedText = ""
    let method: "text" | "ocr" = "text"

    try {
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: pdfBuffer })
      const result = await parser.getText()
      await parser.destroy()

      if (hasMeaningfulText(result.text)) {
        extractedText = result.text
      }
    } catch {
      // pdf-parse failed, will try OCR
    }

    // --- Step 2: Fall back to local Tesseract OCR ---
    if (!extractedText) {
      method = "ocr"
      try {
        extractedText = ocrPdfWithTesseract(pdfBuffer)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        progress(i, pdfFiles.length, "FAIL", file.title, `OCR failed: ${msg.slice(0, 80)}`)
        await db
          .update(files)
          .set({
            extractionStatus: "failed",
            extractionMethod: "ocr",
            extractionError: `OCR failed: ${msg.slice(0, 500)}`,
          })
          .where(eq(files.id, file.id))
        stats.failed++
        continue
      }
    }

    // --- Validate result ---
    if (!hasMeaningfulText(extractedText)) {
      progress(i, pdfFiles.length, "FAIL", file.title, "no meaningful text")
      await db
        .update(files)
        .set({
          extractionStatus: "failed",
          extractionMethod: method,
          extractionError: "Extracted text too short / no meaningful content",
        })
        .where(eq(files.id, file.id))
      stats.failed++
      continue
    }

    // --- Upload transcript to R2 ---
    const release = extractRelease(file.r2Key)
    const filename = file.r2Key.split("/").pop()!.replace(/\.pdf$/i, "")
    const transcriptKey = release
      ? `assets/${release}/transcripts/${filename}.txt`
      : `assets/transcripts/${filename}.txt`

    try {
      await putFile(transcriptKey, extractedText, "text/plain; charset=utf-8")
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      progress(i, pdfFiles.length, "FAIL", file.title, `upload failed: ${msg.slice(0, 80)}`)
      await db
        .update(files)
        .set({
          extractionStatus: "failed",
          extractionMethod: method,
          extractionError: `R2 upload failed: ${msg.slice(0, 500)}`,
        })
        .where(eq(files.id, file.id))
      stats.failed++
      continue
    }

    // --- Update DB ---
    const textContent =
      extractedText.length > MAX_DB_TEXT ? extractedText.slice(0, MAX_DB_TEXT) : extractedText

    await db
      .update(files)
      .set({
        textContent,
        transcriptR2Key: transcriptKey,
        extractionStatus: "completed",
        extractionMethod: method,
        extractionError: null,
      })
      .where(eq(files.id, file.id))

    if (method === "text") {
      stats.textExtracted++
    } else {
      stats.ocrExtracted++
    }

    progress(
      i,
      pdfFiles.length,
      "OK",
      file.title,
      `${method} — ${extractedText.length.toLocaleString()} chars`
    )
  }

  summary([
    `Done! Processed ${pdfFiles.length} PDFs:`,
    `  Text extracted: ${stats.textExtracted}`,
    `  OCR extracted:  ${stats.ocrExtracted}`,
    `  Failed:         ${stats.failed}`,
    `  Skipped:        ${stats.skipped}`,
  ])

  await client.end()
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
