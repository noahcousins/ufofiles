import { writeFileSync } from "node:fs"
import { chromium } from "playwright"
import { CSV_PATH, CSV_URL, WAR_GOV_UFO } from "./config"
import { info, warn } from "./logger"

export async function main() {
  info("Step 1: Fetching CSV catalog from war.gov\n")

  let csvText: string | null = null

  // strategy 1: direct fetch (fast, no browser overhead)
  try {
    info(`Trying direct fetch: ${CSV_URL}`)
    const res = await fetch(CSV_URL)
    if (res.ok) {
      csvText = await res.text()
      info(`Direct fetch succeeded (${csvText.length} bytes)`)
    } else {
      warn(`Direct fetch returned ${res.status}, falling back to Playwright`)
    }
  } catch {
    warn("Direct fetch failed, falling back to Playwright")
  }

  // strategy 2: playwright page-context fetch (handles bot protection / sessions)
  if (!csvText) {
    info("Launching browser for page-context fetch...")
    const browser = await chromium.launch({ headless: false })
    try {
      const page = await browser.newPage()
      await page.goto(WAR_GOV_UFO, {
        waitUntil: "networkidle",
        timeout: 60_000,
      })

      csvText = await page.evaluate(async () => {
        const res = await fetch("/Portals/1/Interactive/2026/UFO/uap-csv.csv")
        return res.text()
      })
    } finally {
      await browser.close()
    }
  }

  writeFileSync(CSV_PATH, csvText)

  const lineCount = csvText.split("\n").filter((l) => l.trim()).length
  info(`\nSaved CSV: ${lineCount} lines (including header)`)
  info(`Output: ${CSV_PATH}`)
}

if (process.argv[1]?.includes("01-fetch-csv")) {
  main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
  })
}
