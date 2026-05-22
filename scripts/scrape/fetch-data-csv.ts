import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { chromium } from "playwright"
import { PROJECT_ROOT } from "./config"

async function main() {
  console.log("Fetching uap-data.csv via page context...\n")

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto("https://www.war.gov/UFO/", {
    waitUntil: "networkidle",
    timeout: 60_000,
  })

  const csv = await page.evaluate(async () => {
    const res = await fetch("/Portals/1/Interactive/2026/UFO/uap-data.csv")
    return res.text()
  })

  const outPath = join(PROJECT_ROOT, "uap-data.csv")
  writeFileSync(outPath, csv)

  const lines = csv.split("\n").filter((l) => l.trim())
  console.log(`Saved ${lines.length} lines to ${outPath}`)
  console.log(`\nHeaders:\n${lines[0]}`)
  console.log(`\nFirst 3 data rows:`)
  for (const line of lines.slice(1, 4)) {
    console.log(line.slice(0, 200))
  }

  // Check for release 2 records
  const r2 = lines.filter((l) => l.includes("Release 02") || l.includes("release_02") || l.includes("5/22/26"))
  console.log(`\nRelease 02 records found: ${r2.length}`)
  if (r2.length > 0) {
    console.log("Sample release 02 row:")
    console.log(r2[0].slice(0, 300))
  }

  await browser.close()
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
