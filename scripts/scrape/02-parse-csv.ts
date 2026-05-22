import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { CSV_PATH, PROJECT_ROOT, RECORDS_PATH, RELEASE, URLS_PATH } from "./config"
import { mapRowToRecord, parseCSV } from "./csv-parser"
import { info } from "./logger"
import type { UfoRecord } from "./types"

const BOM_RE = /^﻿/

export function main() {
  info("Step 2: Parsing CSV into structured records\n")

  const csvText = readFileSync(CSV_PATH, "utf-8")
  const rows = parseCSV(csvText)
  const headers = rows[0].map((h) => h.replace(BOM_RE, "").trim().toLowerCase())

  let records: UfoRecord[] = rows
    .slice(1)
    .map((cols) => mapRowToRecord(headers, cols))

  info(`Parsed ${records.length} total records from CSV`)

  if (RELEASE !== "release-1") {
    // Filter by release date first (most reliable)
    const releaseDates = new Map<string, number>()
    for (const r of records) {
      const d = r.releaseDate || "unknown"
      releaseDates.set(d, (releaseDates.get(d) || 0) + 1)
    }
    info("Release dates found in CSV:")
    for (const [d, c] of releaseDates) info(`  ${d}: ${c} records`)

    // Keep only records NOT matching release-1's date
    const release1Date = "5/8/26"
    const before = records.length
    records = records.filter((r) => r.releaseDate !== release1Date)
    info(`Filtered out ${before - records.length} release-1 records`)
    info(`${records.length} new records for ${RELEASE}`)

    // Also deduplicate against release-1 JSON if available
    const prevPath = join(PROJECT_ROOT, "ufo-records-release-1.json")
    if (existsSync(prevPath)) {
      const prevRecords: UfoRecord[] = JSON.parse(
        readFileSync(prevPath, "utf-8")
      )
      const knownTitles = new Set(prevRecords.map((r) => r.title))
      const beforeDedup = records.length
      records = records.filter((r) => !knownTitles.has(r.title))
      if (beforeDedup !== records.length) {
        info(
          `Deduplicated ${beforeDedup - records.length} additional records from release-1 JSON`
        )
      }
    }
  }

  // categorize
  const pdfs = records.filter((r) => r.documentUrl && !r.videoId)
  const videos = records.filter((r) => r.videoId)
  const noUrl = records.filter((r) => !(r.documentUrl || r.videoId))

  info(`  ${pdfs.length} PDFs/images with direct download URLs`)
  info(`  ${videos.length} videos (via DVIDS API)`)
  if (noUrl.length) {
    info(`  ${noUrl.length} with no download URL`)
  }

  // write structured JSON
  writeFileSync(RECORDS_PATH, JSON.stringify(records, null, 2))
  info(`\nSaved: ${RECORDS_PATH}`)

  // write URL list (one per line)
  const urls = records.filter((r) => r.documentUrl).map((r) => r.documentUrl)
  writeFileSync(URLS_PATH, `${urls.join("\n")}\n`)
  info(`${urls.length} download URLs saved: ${URLS_PATH}`)

  // preview first 5 records
  info("\n--- First 5 records ---")
  for (const [i, r] of records.slice(0, 5).entries()) {
    info(`\n[${i + 1}] ${r.title}`)
    info(`    Agency: ${r.agency}`)
    info(`    Type: ${r.type}`)
    info(`    Download: ${r.documentUrl || r.videoId || "N/A"}`)
  }
}

if (process.argv[1]?.includes("02-parse-csv")) {
  main()
}
