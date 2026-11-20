import { writeFileSync } from "node:fs"
import { chromium } from "playwright"
import { CSV_PATH, CSV_URL, WAR_GOV_UFO } from "./config"
import { info, warn } from "./logger"

export async function main() {
  info("Step 1: Fetching CSV catalog from war.gov\n")

  let csvText: string | null = null

  // The catalog is served from an edge cache that can lag behind a new release
  // by many minutes; a cache-busting query param forces a fresh copy.
  const bustedUrl = `${CSV_URL}?_=${Date.now()}`

  // strategy 1: direct fetch (fast, no browser overhead)
  try {
    info(`Trying direct fetch: ${bustedUrl}`)
    const res = await fetch(bustedUrl, { cache: "no-store" })
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

      // Fetch from the page context so the request carries the warmed-up
      // session/cookies that get past Akamai bot protection.
      const csvPath = new URL(bustedUrl).pathname + new URL(bustedUrl).search
      csvText = await page.evaluate(async (p) => {
        const res = await fetch(p, { cache: "no-store" })
        return res.text()
      }, csvPath)
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
