import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { BrowserContext } from "playwright"
import { chromium } from "playwright"
import {
  DOC_BATCH_PAUSE_MS,
  DOC_BATCH_SIZE,
  DOWNLOAD_TIMEOUT_MS,
  RECORDS_PATH,
  SOURCE_DIR,
  WAR_GOV_UFO,
} from "./config"
import { info, progress, summary } from "./logger"
import type { DownloadStats, UfoRecord } from "./types"
import { fileExists, getExtension, sleep, withRetry } from "./utils"

const SAFE_NAME_RE = /[^a-zA-Z0-9_-]/g

/**
 * deduplicate records by documentUrl and assign stable filenames.
 * when multiple URLs share the same title, appends _doc{index} to disambiguate.
 */
function resolveDocs(records: UfoRecord[]): {
  unique: UfoRecord[]
  nameFor: (url: string) => string
} {
  const seen = new Set<string>()
  const unique: UfoRecord[] = []
  for (const r of records) {
    if (!seen.has(r.documentUrl)) {
      seen.add(r.documentUrl)
      unique.push(r)
    }
  }

  const nameOwners = new Map<string, string>()
  const resolved = new Map<string, string>()
  for (const r of unique) {
    const ext = getExtension(r.documentUrl, r.type)
    const base = r.title.replace(SAFE_NAME_RE, "_")
    const owner = nameOwners.get(base + ext)
    if (!owner) {
      nameOwners.set(base + ext, r.documentUrl)
      resolved.set(r.documentUrl, base + ext)
    } else if (owner !== r.documentUrl) {
      // collision — suffix both
      if (resolved.get(owner) === base + ext) {
        resolved.set(owner, `${base}_doc1${ext}`)
      }
      const count = [...resolved.values()].filter((v) =>
        v.startsWith(`${base}_doc`)
      ).length
      resolved.set(r.documentUrl, `${base}_doc${count + 1}${ext}`)
    }
  }

  return {
    unique,
    nameFor: (url: string) => resolved.get(url) ?? url,
  }
}

/**
 * fallback: open a fresh page on war.gov, fetch the file in-page,
 * and stream it back via base64 in chunks to avoid OOM.
 */
async function downloadViaPage(
  context: BrowserContext,
  url: string,
  outPath: string
): Promise<boolean> {
  const dlPage = await context.newPage()
  try {
    await dlPage.goto(WAR_GOV_UFO, {
      waitUntil: "commit",
      timeout: 30_000,
    })

    const result = await dlPage.evaluate(async (fileUrl: string) => {
      try {
        const resp = await fetch(fileUrl, { credentials: "include" })
        if (!resp.ok) {
          return { error: resp.status }
        }
        const blob = await resp.blob()
        const buf = await blob.arrayBuffer()
        const bytes = new Uint8Array(buf)
        // convert to base64 in chunks to avoid call-stack overflow
        const CHUNK = 32_768
        let b64 = ""
        for (let i = 0; i < bytes.length; i += CHUNK) {
          const chunk = bytes.subarray(i, i + CHUNK)
          let binary = ""
          for (const byte of chunk) {
            binary += String.fromCharCode(byte)
          }
          b64 += btoa(binary)
        }
        return { ok: true, data: b64, size: bytes.length }
      } catch (e: unknown) {
        return { error: (e as Error).message }
      }
    }, url)

    if (result.ok && "data" in result) {
      const buffer = Buffer.from(result.data as string, "base64")
      writeFileSync(outPath, buffer)
      return true
    }
    return false
  } finally {
    await dlPage.close()
  }
}

export async function main() {
  info("Step 3: Downloading documents (PDFs / images)\n")

  const records: UfoRecord[] = JSON.parse(readFileSync(RECORDS_PATH, "utf-8"))
  const downloadable = records.filter((r) => r.documentUrl)
  const { unique, nameFor } = resolveDocs(downloadable)

  info(
    `${unique.length} unique documents to download into ${SOURCE_DIR} (${downloadable.length - unique.length} duplicates removed)\n`
  )
  mkdirSync(SOURCE_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    acceptDownloads: true,
    extraHTTPHeaders: {
      Referer: WAR_GOV_UFO,
    },
  })
  const page = await context.newPage()

  // establish session on the site (loads cookies, etc.)
  await page.goto(WAR_GOV_UFO, { waitUntil: "networkidle" })
  info("Session established on war.gov\n")

  const stats: DownloadStats = {
    success: 0,
    skipped: 0,
    failed: 0,
    total: unique.length,
  }

  for (let i = 0; i < unique.length; i++) {
    const record = unique[i]
    const safeName = nameFor(record.documentUrl)
    const outPath = join(SOURCE_DIR, safeName)

    // skip if already downloaded
    if (fileExists(outPath)) {
      progress(i, stats.total, "SKIP", safeName)
      stats.skipped++
      stats.success++
      continue
    }

    try {
      // strategy 1: playwright API request context (shares cookies)
      const response = await withRetry(
        () =>
          context.request.get(record.documentUrl, {
            timeout: DOWNLOAD_TIMEOUT_MS,
          }),
        { label: safeName }
      )

      if (response.ok()) {
        const buffer = await response.body()
        writeFileSync(outPath, buffer)
        const kb = (buffer.length / 1024).toFixed(0)
        progress(i, stats.total, "OK", safeName, `${kb} KB`)
        stats.success++
      } else {
        // strategy 2: fall back to in-page fetch
        info(
          `[${i + 1}/${stats.total}] API got ${response.status()}, trying in-page fetch...`
        )
        const ok = await downloadViaPage(context, record.documentUrl, outPath)
        if (ok) {
          progress(i, stats.total, "OK", safeName, "page fallback")
          stats.success++
        } else {
          progress(i, stats.total, "FAIL", safeName)
          stats.failed++
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 120) : String(err)
      progress(i, stats.total, "ERROR", safeName, msg)
      stats.failed++
    }

    // brief pause every N files to be polite
    if (i % DOC_BATCH_SIZE === DOC_BATCH_SIZE - 1) {
      await sleep(DOC_BATCH_PAUSE_MS)
    }
  }

  summary([
    `Done! ${stats.success} ok (${stats.skipped} skipped), ${stats.failed} failed`,
    `Files in: ${SOURCE_DIR}`,
  ])

  await browser.close()
}

if (process.argv[1]?.includes("03-download-docs")) {
  main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
  })
}
