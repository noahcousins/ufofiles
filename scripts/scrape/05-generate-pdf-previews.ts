import { execFileSync } from "node:child_process"
import { mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  PDF_DPI,
  PDF_PREVIEW_DIR,
  PDF_SCALE_TO,
  RELEASE,
  SOURCE_DIR,
} from "./config"
import { info, progress, summary } from "./logger"
import type { PreviewStats } from "./types"
import { fileExists, requireBinary } from "./utils"

const FORCE = process.argv.includes("--force")
const PDF_EXT_RE = /\.pdf$/i

interface ManifestEntry {
  basePath: string
  pages: number
}

/**
 * pdftoppm uses variable-width page numbering (page-1, page-01, page-001)
 * depending on total page count. Normalize to 3-digit zero-padded names
 * so the frontend can reliably request page-001.jpg, page-002.jpg, etc.
 */
function normalizePageFiles(dir: string): string[] {
  const raw = readdirSync(dir)
    .filter((f) => f.startsWith("page-") && f.endsWith(".jpg"))
    .sort()

  const normalized: string[] = []

  for (let i = 0; i < raw.length; i++) {
    const padded = `page-${String(i + 1).padStart(3, "0")}.jpg`
    if (raw[i] !== padded) {
      renameSync(join(dir, raw[i]), join(dir, padded))
    }
    normalized.push(padded)
  }

  return normalized
}

export function main() {
  info("Step 5: Generating PDF page previews\n")

  requireBinary("pdftoppm", "brew install poppler")

  // scan for local PDFs
  const pdfFiles = readdirSync(SOURCE_DIR).filter((f) =>
    f.toLowerCase().endsWith(".pdf")
  )
  info(`Found ${pdfFiles.length} PDF files\n`)

  if (pdfFiles.length === 0) {
    summary(["No PDFs to process"])
    return
  }

  mkdirSync(PDF_PREVIEW_DIR, { recursive: true })

  const manifest: Record<string, ManifestEntry> = {}
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
    const outputDir = join(PDF_PREVIEW_DIR, stem)
    const firstPage = join(outputDir, "page-001.jpg")

    // skip if already generated
    if (!FORCE && fileExists(firstPage)) {
      // still count pages for manifest
      const pages = readdirSync(outputDir).filter(
        (f) => f.startsWith("page-") && f.endsWith(".jpg")
      )
      manifest[`source/${RELEASE}/${filename}`] = {
        basePath: `assets/${RELEASE}/pdf-pages/${stem}`,
        pages: pages.length,
      }
      progress(i, stats.total, "SKIP", filename, `${pages.length} pages`)
      stats.skipped++
      continue
    }

    mkdirSync(outputDir, { recursive: true })

    try {
      process.stdout.write(
        `[${i + 1}/${stats.total}] ${filename} — rendering...`
      )

      // render all pages as JPEG
      execFileSync("pdftoppm", [
        "-jpeg",
        "-r",
        String(PDF_DPI),
        "-scale-to",
        String(PDF_SCALE_TO),
        inputPath,
        join(outputDir, "page"),
      ])

      // normalize page numbering to 3-digit padding
      const pages = normalizePageFiles(outputDir)

      if (pages.length === 0) {
        process.stdout.write(" no pages rendered (empty PDF?)\n")
        stats.failed++
        continue
      }

      manifest[`source/${RELEASE}/${filename}`] = {
        basePath: `assets/${RELEASE}/pdf-pages/${stem}`,
        pages: pages.length,
      }
      stats.generated++
      process.stdout.write(` done (${pages.length} pages)\n`)
    } catch (err: unknown) {
      process.stdout.write("\n")
      const msg = err instanceof Error ? err.message.slice(0, 120) : String(err)
      progress(i, stats.total, "FAIL", filename, msg)
      stats.failed++
    }
  }

  // write manifest
  const manifestPath = join(PDF_PREVIEW_DIR, "manifest.json")
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  info(`\nManifest written with ${Object.keys(manifest).length} entries`)

  summary([
    `Done! ${stats.generated} generated, ${stats.skipped} skipped, ${stats.failed} failed`,
    `Output: ${PDF_PREVIEW_DIR}`,
  ])
}

if (process.argv[1]?.includes("05-generate-pdf-previews")) {
  try {
    main()
  } catch (err) {
    console.error("Fatal:", err)
    process.exit(1)
  }
}
