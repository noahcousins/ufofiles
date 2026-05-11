import { execFileSync } from "node:child_process"
import { mkdirSync, readdirSync, readFileSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { SOURCE_DIR, TRANSCRIPT_DIR } from "./config"
import { info, progress, summary } from "./logger"
import type { PreviewStats } from "./types"
import { fileExists, requireBinary } from "./utils"

const FORCE = process.argv.includes("--force")
const PDF_EXT_RE = /\.pdf$/i
/** minimum bytes of actual text to keep a transcript (filters out scanned-image PDFs). */
const MIN_TEXT_BYTES = 20
/** strip control chars and whitespace to check if there's real text content. */
const JUNK_RE = /[\x00-\x1f\s]/g

export function main() {
  info("Step 6: Extracting text from PDFs\n")

  requireBinary("pdftotext", "brew install poppler")

  const pdfFiles = readdirSync(SOURCE_DIR).filter((f) =>
    f.toLowerCase().endsWith(".pdf")
  )
  info(`Found ${pdfFiles.length} PDF files\n`)

  if (pdfFiles.length === 0) {
    summary(["No PDFs to process"])
    return
  }

  mkdirSync(TRANSCRIPT_DIR, { recursive: true })

  const stats: PreviewStats = {
    generated: 0,
    skipped: 0,
    failed: 0,
    total: pdfFiles.length,
  }

  for (let i = 0; i < pdfFiles.length; i++) {
    const filename = pdfFiles[i]
    const stem = filename.replace(PDF_EXT_RE, "")
    const inputPath = join(SOURCE_DIR, filename)
    const outputPath = join(TRANSCRIPT_DIR, `${stem}.txt`)

    // skip if already extracted
    if (!FORCE && fileExists(outputPath)) {
      progress(i, stats.total, "SKIP", filename)
      stats.skipped++
      continue
    }

    try {
      process.stdout.write(
        `[${i + 1}/${stats.total}] ${filename} — extracting...`
      )

      execFileSync("pdftotext", [inputPath, outputPath], { stdio: "pipe" })

      // verify output has meaningful content
      // scanned-image PDFs produce empty files or junk (form-feed chars, whitespace)
      if (!fileExists(outputPath)) {
        process.stdout.write(" no output (scanned image?)\n")
        stats.failed++
        continue
      }

      const raw = readFileSync(outputPath, "utf-8")
      const meaningful = raw.replace(JUNK_RE, "")
      if (meaningful.length < MIN_TEXT_BYTES) {
        unlinkSync(outputPath)
        process.stdout.write(" junk only (scanned image?) — removed\n")
        stats.failed++
        continue
      }

      process.stdout.write(" done\n")
      stats.generated++
    } catch (err: unknown) {
      process.stdout.write("\n")
      const msg = err instanceof Error ? err.message.slice(0, 120) : String(err)
      progress(i, stats.total, "FAIL", filename, msg)
      stats.failed++
    }
  }

  summary([
    `Done! ${stats.generated} extracted, ${stats.skipped} skipped, ${stats.failed} failed`,
    `Output: ${TRANSCRIPT_DIR}`,
  ])
}

if (process.argv[1]?.includes("06-extract-pdf-text")) {
  try {
    main()
  } catch (err) {
    console.error("Fatal:", err)
    process.exit(1)
  }
}
