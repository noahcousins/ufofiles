import { readFileSync, writeFileSync } from "node:fs"
import { CSV_PATH, RECORDS_PATH, URLS_PATH } from "./config"
import { mapRowToRecord, parseCSV } from "./csv-parser"
import { info } from "./logger"
import type { UfoRecord } from "./types"

const BOM_RE = /^﻿/

export function main() {
  info("Step 2: Parsing CSV into structured records\n")

  const csvText = readFileSync(CSV_PATH, "utf-8")
  const rows = parseCSV(csvText)
  const headers = rows[0].map((h) => h.replace(BOM_RE, "").trim().toLowerCase())

  const records: UfoRecord[] = rows
    .slice(1)
    .map((cols) => mapRowToRecord(headers, cols))

  info(`Parsed ${records.length} records`)

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
