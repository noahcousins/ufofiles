import type { UfoRecord } from "./types"

const BOM_RE = /^﻿/

/**
 * RFC-4180-ish CSV parser that handles:
 * - Quoted fields with embedded commas, newlines, and doubled quotes
 * - BOM prefix on the first header cell
 * - CRLF and LF line endings
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: inherent to a state-machine CSV parser
export function parseCSV(csvText: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i]
    const next = csvText[i + 1]

    if (c === '"' && inQuotes && next === '"') {
      // Escaped quote inside a quoted field
      cell += '"'
      i++
    } else if (c === '"') {
      inQuotes = !inQuotes
    } else if (c === "," && !inQuotes) {
      row.push(cell.trim())
      cell = ""
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (cell || row.length) {
        row.push(cell.trim())
        rows.push(row)
        row = []
        cell = ""
      }
      if (c === "\r" && next === "\n") {
        i++
      }
    } else {
      cell += c
    }
  }

  // Flush any remaining content
  if (cell || row.length) {
    row.push(cell.trim())
    rows.push(row)
  }

  return rows
}

// ---------------------------------------------------------------------------
// Header-name to UfoRecord field mapping
// ---------------------------------------------------------------------------

const HEADER_MAP: Record<string, keyof UfoRecord> = {
  title: "title",
  agency: "agency",
  "release date": "releaseDate",
  "incident date": "incidentDate",
  "incident location": "incidentLocation",
  type: "type",
  "pdf | image link": "documentUrl",
  "modal image": "imageUrl",
  "dvids video id": "videoId",
  "description blurb": "description",
  redaction: "redacted",
}

/** Map a raw CSV row into a typed UfoRecord using header indices. */
export function mapRowToRecord(headers: string[], cols: string[]): UfoRecord {
  const record: Record<string, string> = {
    agency: "",
    description: "",
    documentUrl: "",
    imageUrl: "",
    incidentDate: "",
    incidentLocation: "",
    redacted: "",
    releaseDate: "",
    title: "",
    type: "",
    videoId: "",
  }

  for (let i = 0; i < headers.length; i++) {
    const normalized = headers[i].replace(BOM_RE, "").trim().toLowerCase()
    const field = HEADER_MAP[normalized]
    if (field) {
      record[field] = (cols[i] || "").trim()
    }
  }

  return record as unknown as UfoRecord
}
