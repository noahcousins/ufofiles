import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  CSV_PATH,
  PROJECT_ROOT,
  RECORDS_PATH,
  RELEASE,
  RELEASE_DATES,
  URLS_PATH,
} from "./config"
import { mapRowToRecord, parseCSV } from "./csv-parser"
import { info, warn } from "./logger"
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
    // Log every release date present so a new/unconfigured release is obvious.
    const releaseDates = new Map<string, number>()
    for (const r of records) {
      const d = r.releaseDate || "unknown"
      releaseDates.set(d, (releaseDates.get(d) || 0) + 1)
    }
    info("Release dates found in CSV:")
    for (const [d, c] of releaseDates) {
      info(`  ${d}: ${c} records`)
    }

    const before = records.length
    const targetDate = RELEASE_DATES[RELEASE]
    if (targetDate) {
      // Known release: keep only the records published on this release's date.
      records = records.filter((r) => r.releaseDate === targetDate)
      info(
        `Kept ${records.length}/${before} records for ${RELEASE} (date ${targetDate})`
      )
    } else {
      // Unconfigured release: drop everything from known prior releases so the
      // leftover rows are the new ones. Add the date to RELEASE_DATES once known.
      const priorDates = new Set(Object.values(RELEASE_DATES))
      records = records.filter((r) => !priorDates.has(r.releaseDate))
      warn(
        `No date configured for ${RELEASE} in RELEASE_DATES; dropped ${before - records.length} records from known prior releases, ${records.length} remain`
      )
    }

    // Safety net: drop any title already ingested in a prior release's JSON.
    const knownTitles = new Set<string>()
    for (const rel of Object.keys(RELEASE_DATES)) {
      if (rel === RELEASE) {
        continue
      }
      const prevPath = join(PROJECT_ROOT, `ufo-records-${rel}.json`)
      if (existsSync(prevPath)) {
        const prevRecords: UfoRecord[] = JSON.parse(
          readFileSync(prevPath, "utf-8")
        )
        for (const r of prevRecords) {
          knownTitles.add(r.title)
        }
      }
    }
    if (knownTitles.size) {
      const beforeDedup = records.length
      records = records.filter((r) => !knownTitles.has(r.title))
      if (beforeDedup !== records.length) {
        info(
          `Deduplicated ${beforeDedup - records.length} records already present in prior release JSON(s)`
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
