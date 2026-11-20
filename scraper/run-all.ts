import { error, info, summary } from "./logger"

interface StepResult {
  error?: Error
  name: string
  ok: boolean
}

async function runAll() {
  info("UAP Scraper Pipeline\n")

  const steps = [
    {
      name: "Fetch CSV",
      run: () => import("./01-fetch-csv").then((m) => m.main()),
    },
    {
      name: "Parse CSV",
      run: () => import("./02-parse-csv").then((m) => m.main()),
    },
    {
      name: "Download Documents",
      run: () => import("./03-download-docs").then((m) => m.main()),
    },
    {
      name: "Download Videos",
      run: () => import("./04-download-videos").then((m) => m.main()),
    },
    {
      name: "Generate PDF Previews",
      run: () => import("./05-generate-pdf-previews").then((m) => m.main()),
    },
    {
      name: "Extract PDF Text",
      run: () => import("./06-extract-pdf-text").then((m) => m.main()),
    },
    {
      name: "Generate Video Previews",
      run: () => import("./07-generate-video-previews").then((m) => m.main()),
    },
    {
      name: "Generate Card Thumbnails",
      run: () => import("./08-generate-card-thumbs").then((m) => m.main()),
    },
    {
      name: "Transcode Videos",
      run: () => import("./09-transcode-videos").then((m) => m.main()),
    },
    {
      name: "Upload Source to R2",
      run: () => import("./10-upload-source-to-r2").then((m) => m.main()),
    },
    {
      name: "Upload Assets to R2",
      run: () => import("./11-upload-assets-to-r2").then((m) => m.main()),
    },
    {
      name: "Link DB Records",
      run: () => import("./12-link-db-records").then((m) => m.main()),
    },
  ]

  const results: StepResult[] = []

  for (const step of steps) {
    info(`\n${"=".repeat(50)}`)
    info(`Starting: ${step.name}`)
    info(`${"=".repeat(50)}\n`)

    try {
      await step.run()
      results.push({ name: step.name, ok: true })
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      error(`${step.name} failed: ${e.message}`)
      results.push({ name: step.name, ok: false, error: e })
      // Stop on failure - downstream steps depend on earlier ones
      break
    }
  }

  summary([
    "Pipeline complete",
    ...results.map(
      (r) =>
        `  ${r.ok ? "OK" : "FAIL"}: ${r.name}${r.error ? ` -- ${r.error.message}` : ""}`
    ),
  ])
}

runAll().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
