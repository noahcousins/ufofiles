export function parseIncidentYear(
  raw: string | null | undefined
): number | null {
  if (!raw || raw.trim() === "" || raw.trim().toUpperCase() === "N/A") {
    return null
  }

  const trimmed = raw.trim()
  const currentYearShort = new Date().getFullYear() % 100

  const bare4 = trimmed.match(/^(\d{4})$/)
  if (bare4) {
    return Number.parseInt(bare4[1], 10)
  }

  const dateMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (dateMatch) {
    const yearPart = Number.parseInt(dateMatch[3], 10)
    if (yearPart >= 100) {
      return yearPart
    }
    return yearPart <= currentYearShort ? 2000 + yearPart : 1900 + yearPart
  }

  const embedded = trimmed.match(/(\d{4})/)
  if (embedded) {
    return Number.parseInt(embedded[1], 10)
  }

  return null
}
