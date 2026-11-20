import { mkdirSync, readdirSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"
import {
  CARD_THUMB_DIR,
  CARD_THUMB_QUALITY,
  CARD_THUMB_WIDTH,
  PDF_PREVIEW_DIR,
  SOURCE_DIR,
  VIDEO_PREVIEW_DIR,
} from "./config"
import { info, progress, summary } from "./logger"
import type { PreviewStats } from "./types"
import { fileExists } from "./utils"

const IMG_EXT_RE = /\.(png|jpe?g)$/i
const EXT_RE = /\.[^.]+$/

interface ThumbTask {
  name: string
  outputName: string
  sourcePath: string
}

/**
 * Build the list of thumbnails to generate from all three file types.
 *
 * Output names include the source extension ({stem}_{ext}_card.webp) so that
 * files sharing the same stem but different types (e.g. D38.pdf and D38.mp4)
 * each get their own card thumbnail.
 */
function collectTasks(): ThumbTask[] {
  const tasks: ThumbTask[] = []

  // pdfs - use first page image from pdf-pages/{stem}/page-001.jpg
  try {
    for (const stem of readdirSync(PDF_PREVIEW_DIR)) {
      const stemDir = join(PDF_PREVIEW_DIR, stem)
      const firstPage = join(stemDir, "page-001.jpg")
      if (fileExists(firstPage)) {
        tasks.push({
          name: `${stem}.pdf`,
          outputName: `${stem}_pdf_card.webp`,
          sourcePath: firstPage,
        })
      }
    }
  } catch {
    // pdf-pages may not exist
  }

  // videos - use thumbnail from previews/{stem}_thumb.jpg
  try {
    for (const file of readdirSync(VIDEO_PREVIEW_DIR)) {
      if (!file.endsWith("_thumb.jpg")) {
        continue
      }
      const stem = file.replace("_thumb.jpg", "")
      tasks.push({
        name: `${stem}.mp4`,
        outputName: `${stem}_mp4_card.webp`,
        sourcePath: join(VIDEO_PREVIEW_DIR, file),
      })
    }
  } catch {
    // previews may not exist
  }

  // images - use source files directly
  for (const file of readdirSync(SOURCE_DIR)) {
    if (!IMG_EXT_RE.test(file)) {
      continue
    }
    const ext = file.split(".").pop()?.toLowerCase() ?? "img"
    const stem = file.replace(EXT_RE, "")
    tasks.push({
      name: file,
      outputName: `${stem}_${ext}_card.webp`,
      sourcePath: join(SOURCE_DIR, file),
    })
  }

  return tasks
}

export async function main() {
  info("Step 8: Generating card thumbnails (WebP)\n")

  const tasks = collectTasks()
  info(`${tasks.length} thumbnails to generate\n`)

  if (tasks.length === 0) {
    summary(["No files to generate thumbnails for"])
    return
  }

  mkdirSync(CARD_THUMB_DIR, { recursive: true })

  const stats: PreviewStats = {
    generated: 0,
    skipped: 0,
    failed: 0,
    total: tasks.length,
  }

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    const outputPath = join(CARD_THUMB_DIR, task.outputName)

    // skip if already generated
    if (fileExists(outputPath)) {
      progress(i, stats.total, "SKIP", task.name)
      stats.skipped++
      continue
    }

    try {
      await sharp(task.sourcePath)
        .resize({ width: CARD_THUMB_WIDTH })
        .webp({ quality: CARD_THUMB_QUALITY })
        .toFile(outputPath)

      progress(i, stats.total, "OK", task.name)
      stats.generated++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.slice(0, 120) : String(err)
      progress(i, stats.total, "FAIL", task.name, msg)
      stats.failed++
    }
  }

  summary([
    `Done! ${stats.generated} generated, ${stats.skipped} skipped, ${stats.failed} failed`,
    `Output: ${CARD_THUMB_DIR}`,
  ])
}

if (process.argv[1]?.includes("08-generate-card-thumbs")) {
  main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
  })
}
