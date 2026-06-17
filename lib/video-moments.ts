export interface ParsedMoment {
  description: string
  endSeconds: number | null
  sortOrder: number
  startSeconds: number
}

// Accepts MM:SS and HH:MM:SS (optional hours group).
const TIMESTAMP_LINE =
  /^(\d{1,2}:\d{2}(?::\d{2})?)(?:-(\d{1,2}:\d{2}(?::\d{2})?))?:\s*(.+)/

function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map(Number)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return parts[0] * 60 + parts[1]
}

export function parseVideoMoments(description: string): ParsedMoment[] {
  const marker = description.indexOf("Video Description")
  if (marker === -1) {
    return []
  }

  const afterMarker = description.slice(marker)
  const lines = afterMarker.split("\n")

  const moments: { start: number; end: number | null; lines: string[] }[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      continue
    }

    if (/^Video Duration:/i.test(line)) {
      continue
    }

    const match = line.match(TIMESTAMP_LINE)
    if (match) {
      const start = parseTimestamp(match[1])
      const end = match[2] ? parseTimestamp(match[2]) : null
      moments.push({ start, end, lines: [match[3]] })
    } else if (
      moments.length > 0 &&
      !(
        /^Video Description/i.test(line) ||
        /^This video description is provided/i.test(line)
      )
    ) {
      moments[moments.length - 1].lines.push(line)
    }
  }

  const filtered = moments.filter(
    (m) => !/^no content\b/i.test(m.lines.join(" ").trim())
  )

  if (
    filtered.length === 1 &&
    filtered[0].start === 0 &&
    filtered[0].end !== null
  ) {
    return []
  }

  return filtered.map((m, i) => ({
    startSeconds: m.start,
    endSeconds: m.end,
    description: m.lines.join(" ").trim(),
    sortOrder: i,
  }))
}
