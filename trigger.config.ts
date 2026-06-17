import { ffmpeg } from "@trigger.dev/build/extensions/core"
import { defineConfig } from "@trigger.dev/sdk/v3"

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_null",
  dirs: ["./trigger"],
  // Hard per-run ceiling (cost guardrail, ADR-0002). A 60s 720p re-encode on the
  // small machine finishes well under this; if a job hangs it can't bill more.
  maxDuration: 150,
  retries: {
    enabledInDev: false,
    default: {
      // Clip failures are usually deterministic (bad input/bounds), so retrying
      // just multiplies wasted compute. One attempt; no retry.
      maxAttempts: 1,
    },
  },
  build: {
    extensions: [ffmpeg()],
  },
})
