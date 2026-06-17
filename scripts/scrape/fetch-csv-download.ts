import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { chromium } from "playwright"
import { PROJECT_ROOT } from "./config"

async function main() {
  console.log("Opening war.gov/UFO release 02 page...\n")

  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  // Intercept all network requests to find CSV/data sources
  const dataUrls: string[] = []
  page.on("response", async (response) => {
    const url = response.url()
    if (url.includes("csv") || url.includes("json") || url.includes("data")) {
      const ct = response.headers()["content-type"] || ""
      dataUrls.push(`${response.status()} ${ct} ${url}`)
    }
  })

  await page.goto(
    "https://www.war.gov/UFO/?releaseDate=Release+02#CIA-UAP-D001-Intelligence-Information-Report-USSR-1973",
    { waitUntil: "networkidle", timeout: 60_000 }
  )

  console.log("Page loaded.\n")

  // Log data URLs intercepted during page load
  console.log("=== Data URLs loaded by the page ===")
  for (const u of dataUrls) {
    console.log(`  ${u}`)
  }

  // Wait for the modal to appear (the hash should trigger it)
  await page.waitForTimeout(3000)

  // Find the download button in the modal
  const downloadBtn = await page.$(
    "button.record-modal-download, a.record-modal-download, .record-modal-download"
  )
  if (downloadBtn) {
    const tag = await downloadBtn.evaluate((el) => el.tagName)
    const text = await downloadBtn.innerText().catch(() => "")
    const href = await downloadBtn.evaluate(
      (el) => (el as HTMLAnchorElement).href || ""
    )
    const onclick = await downloadBtn.evaluate(
      (el) => el.getAttribute("onclick") || ""
    )
    const dataAttrs = await downloadBtn.evaluate((el) => {
      const attrs: Record<string, string> = {}
      for (const a of el.attributes) {
        if (a.name.startsWith("data-")) {
          attrs[a.name] = a.value
        }
      }
      return attrs
    })

    console.log("\n=== Download button found ===")
    console.log(`  tag: ${tag}`)
    console.log(`  text: "${text.trim()}"`)
    console.log(`  href: "${href}"`)
    console.log(`  onclick: "${onclick}"`)
    console.log("  data attrs:", dataAttrs)

    // Click it and see what happens
    console.log("\nClicking download button...")
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 10_000 }).catch(() => null),
      downloadBtn.click(),
    ])

    if (download) {
      console.log(`  Download triggered: ${download.url()}`)
      console.log(`  Suggested filename: ${download.suggestedFilename()}`)
    } else {
      console.log("  No download event. Checking for new requests...")
      await page.waitForTimeout(2000)
    }
  } else {
    console.log(
      "Download button not found with .record-modal-download selector"
    )
  }

  // Now let's look at ALL the CSV files referenced by the page
  console.log("\n=== Fetching CSV files from page context ===")

  // Try both release001 and release002 CSVs
  const csvUrls = [
    "/Portals/1/Interactive/2026/UFO/uap-release001.csv",
    "/Portals/1/Interactive/2026/UFO/uap-release002.csv",
    "/Portals/1/Interactive/2026/UFO/uap-csv.csv",
    "/Portals/1/Interactive/2026/UFO/uap-release-02.csv",
  ]

  for (const csvUrl of csvUrls) {
    const result = await page.evaluate(async (url) => {
      try {
        const res = await fetch(url)
        if (!res.ok) {
          return { status: res.status, ok: false, length: 0, preview: "" }
        }
        const text = await res.text()
        return {
          status: res.status,
          ok: true,
          length: text.length,
          lines: text.split("\n").length,
          preview: text.slice(0, 500),
        }
      } catch (e) {
        return {
          status: 0,
          ok: false,
          error: String(e),
          length: 0,
          preview: "",
        }
      }
    }, csvUrl)

    console.log(`\n${csvUrl}:`)
    console.log(
      `  status: ${result.status}, ok: ${result.ok}, length: ${result.length}`
    )
    if (result.ok) {
      console.log(`  lines: ${(result as any).lines}`)
      console.log(`  preview: ${(result as any).preview}`)

      // If we found a valid CSV, fetch and save the full content
      if (result.length > 100 && (result as any).preview?.includes(",")) {
        const fullCsv = await page.evaluate(async (url) => {
          const res = await fetch(url)
          return res.text()
        }, csvUrl)

        const filename = csvUrl.split("/").pop()!
        const outPath = join(PROJECT_ROOT, filename)
        writeFileSync(outPath, fullCsv)
        console.log(`  SAVED to ${outPath}`)
      }
    }
  }

  // Also dump the page's JavaScript to find how the CSV data maps to download URLs
  console.log("\n=== Looking for download URL logic in page scripts ===")
  const scripts = await page.$$eval("script", (els) =>
    els
      .map((el) => (el as HTMLScriptElement).innerText)
      .filter(
        (s) =>
          s.includes("download") || s.includes("medialink") || s.includes("csv")
      )
      .map((s) => s.slice(0, 2000))
  )
  for (const [i, s] of scripts.entries()) {
    console.log(`\n--- Script ${i + 1} (first 2000 chars) ---`)
    console.log(s)
  }

  await browser.close()
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
