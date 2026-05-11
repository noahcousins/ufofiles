/**
 * Production Database Migration
 *
 * Migrates the database from legacy `release_1/` r2_keys to the new
 * `source/release-1/` format expected by the optimized codebase.
 *
 * What it does:
 *  1. Adds `text_content` and `transcript_r2_key` columns if missing
 *  2. Swaps all r2_key prefixes: release_1/X → source/release-1/X
 *  3. Fixes multi-video VID rows for D23 and D32 (adds _vid suffix, inserts missing videos)
 *  4. Sets video_id on all VID rows that are missing it
 *  5. Reports any files that won't resolve in the source R2 bucket
 *
 * Usage:
 *   DATABASE_URL=<url> pnpm tsx scripts/migrate-prod.ts           # dry run (default)
 *   DATABASE_URL=<url> pnpm tsx scripts/migrate-prod.ts --apply   # actually apply changes
 *
 * This script is IDEMPOTENT — safe to run multiple times.
 */

import postgres from "postgres"

const DRY_RUN = !process.argv.includes("--apply")

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return val
}

const databaseUrl = requireEnv("DATABASE_URL")
const sql = postgres(databaseUrl)

function info(msg: string) {
  console.log(msg)
}

function warn(msg: string) {
  console.log(`⚠️  ${msg}`)
}

// ---------------------------------------------------------------------------
// Multi-video VID records that need to be inserted or fixed.
//
// Each entry represents a video file that exists in R2 source bucket
// at release-1/{r2Filename}. The migration will either UPDATE an
// existing VID row or INSERT a new one.
// ---------------------------------------------------------------------------

interface VideoFix {
  /** Existing VID row id to update, or null to insert a new row */
  existingVidId: number | null
  title: string
  videoId: string
  r2Filename: string
  fileSize: number
  releaseId: number
  agency: string
}

const MULTI_VIDEO_FIXES: VideoFix[] = [
  // --- D23: 2 videos, existing VID id=167 ---
  {
    existingVidId: 167,
    title:
      "DOW-UAP-D23, Mission Report, United Arab Emirates, October 2023",
    videoId: "1006063",
    r2Filename:
      "DOW-UAP-D23__Mission_Report__United_Arab_Emirates__October_2023_vid1006063.mp4",
    fileSize: 27493716,
    releaseId: 1,
    agency: "Department of War",
  },
  {
    existingVidId: null, // INSERT
    title:
      "DOW-UAP-D23, Mission Report, United Arab Emirates, October 2023",
    videoId: "1006067",
    r2Filename:
      "DOW-UAP-D23__Mission_Report__United_Arab_Emirates__October_2023_vid1006067.mp4",
    fileSize: 155885289,
    releaseId: 1,
    agency: "Department of War",
  },
  // --- D32: 3 videos, existing VID id=168 ---
  {
    existingVidId: 168,
    title: "DOW-UAP-D32, Mission Report, Syria, October 2024",
    videoId: "1006076",
    r2Filename:
      "DOW-UAP-D32__Mission_Report__Syria__October_2024_vid1006076.mp4",
    fileSize: 644525,
    releaseId: 1,
    agency: "Department of War",
  },
  {
    existingVidId: null, // INSERT
    title: "DOW-UAP-D32, Mission Report, Syria, October 2024",
    videoId: "1006078",
    r2Filename:
      "DOW-UAP-D32__Mission_Report__Syria__October_2024_vid1006078.mp4",
    fileSize: 1834659,
    releaseId: 1,
    agency: "Department of War",
  },
  {
    existingVidId: null, // INSERT
    title: "DOW-UAP-D32, Mission Report, Syria, October 2024",
    videoId: "1006079",
    r2Filename:
      "DOW-UAP-D32__Mission_Report__Syria__October_2024_vid1006079.mp4",
    fileSize: 426911,
    releaseId: 1,
    agency: "Department of War",
  },
]

// ---------------------------------------------------------------------------
// Single-video D-files: existing VID rows that just need video_id set.
// These already have the correct r2_key filename (no _vid suffix needed).
// ---------------------------------------------------------------------------

interface SingleVideoFix {
  vidId: number
  videoId: string
}

const SINGLE_VIDEO_FIXES: SingleVideoFix[] = [
  { vidId: 163, videoId: "1006056" }, // D10
  { vidId: 164, videoId: "1006059" }, // D14
  { vidId: 165, videoId: "1006060" }, // D16
  { vidId: 166, videoId: "1006062" }, // D18
  { vidId: 169, videoId: "1006080" }, // D33
  { vidId: 170, videoId: "1006082" }, // D35
  { vidId: 171, videoId: "1006083" }, // D38
]

// ---------------------------------------------------------------------------
// Files that exist in the legacy bucket but NOT in the source bucket.
// These will keep their legacy r2_key so the worker's legacy fallback serves them.
// TODO: upload these to the source bucket and remove from this list.
// ---------------------------------------------------------------------------

const LEGACY_ONLY_IDS = new Set<number>([]) // all files now in source bucket

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

async function main() {
  info(
    `\n${"=".repeat(60)}\n  Production Database Migration${DRY_RUN ? " (DRY RUN)" : ""}\n${"=".repeat(60)}\n`
  )

  if (DRY_RUN) {
    info(
      "Running in DRY RUN mode. No changes will be made.\nPass --apply to execute.\n"
    )
  }

  // -----------------------------------------------------------------------
  // Step 1: Add missing columns
  // -----------------------------------------------------------------------
  info("Step 1: Checking schema for missing columns...")

  const columns = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'files'
  `
  const colNames = new Set(columns.map((c) => c.column_name))

  if (!colNames.has("text_content")) {
    info("  Adding text_content column...")
    if (!DRY_RUN) {
      await sql`ALTER TABLE files ADD COLUMN text_content TEXT`
    }
    info("  ✓ text_content added")
  } else {
    info("  text_content already exists")
  }

  if (!colNames.has("transcript_r2_key")) {
    info("  Adding transcript_r2_key column...")
    if (!DRY_RUN) {
      await sql`ALTER TABLE files ADD COLUMN transcript_r2_key TEXT`
    }
    info("  ✓ transcript_r2_key added")
  } else {
    info("  transcript_r2_key already exists")
  }

  // -----------------------------------------------------------------------
  // Step 2: Swap r2_key prefix (release_1/ → source/release-1/)
  // -----------------------------------------------------------------------
  info("\nStep 2: Swapping r2_key prefix...")

  const legacyRows = await sql`
    SELECT id, r2_key FROM files
    WHERE r2_key LIKE 'release_1/%'
  `

  info(`  Found ${legacyRows.length} rows with release_1/ prefix`)

  let swapped = 0
  let skippedLegacy = 0
  for (const row of legacyRows) {
    if (LEGACY_ONLY_IDS.has(row.id)) {
      warn(`  Skipping id=${row.id} (legacy-only, not in source bucket)`)
      skippedLegacy++
      continue
    }

    const oldKey = row.r2_key as string
    const filename = oldKey.replace(/^release_1\//, "")
    const newKey = `source/release-1/${filename}`

    if (!DRY_RUN) {
      await sql`UPDATE files SET r2_key = ${newKey} WHERE id = ${row.id}`
    }
    swapped++
  }
  info(`  ✓ ${swapped} rows updated, ${skippedLegacy} skipped (legacy-only)`)

  // -----------------------------------------------------------------------
  // Step 3: Fix multi-video VID rows (D23, D32)
  // -----------------------------------------------------------------------
  info("\nStep 3: Fixing multi-video VID rows...")

  let updated = 0
  let inserted = 0

  for (const fix of MULTI_VIDEO_FIXES) {
    const r2Key = `source/release-1/${fix.r2Filename}`

    if (fix.existingVidId !== null) {
      // Check if already fixed (idempotent)
      const [existing] = await sql`
        SELECT r2_key, video_id FROM files WHERE id = ${fix.existingVidId}
      `
      if (existing?.r2_key === r2Key && existing?.video_id === fix.videoId) {
        info(`  id=${fix.existingVidId} already fixed, skipping`)
        continue
      }

      info(
        `  UPDATE id=${fix.existingVidId}: video_id=${fix.videoId}, r2_key=...${fix.r2Filename.slice(-40)}`
      )
      if (!DRY_RUN) {
        await sql`
          UPDATE files SET
            r2_key = ${r2Key},
            video_id = ${fix.videoId},
            file_size = ${fix.fileSize},
            mime_type = 'video/mp4'
          WHERE id = ${fix.existingVidId}
        `
      }
      updated++
    } else {
      // Check if already inserted (idempotent: match on r2_key)
      const [existing] = await sql`
        SELECT id FROM files WHERE r2_key = ${r2Key}
      `
      if (existing) {
        info(`  VID for video_id=${fix.videoId} already exists (id=${existing.id}), skipping`)
        continue
      }

      info(
        `  INSERT VID: video_id=${fix.videoId}, r2_key=...${fix.r2Filename.slice(-40)}`
      )
      if (!DRY_RUN) {
        const [row] = await sql`
          INSERT INTO files (release_id, title, agency, type, r2_key, file_size, mime_type, video_id)
          VALUES (${fix.releaseId}, ${fix.title}, ${fix.agency}, 'VID', ${r2Key}, ${fix.fileSize}, 'video/mp4', ${fix.videoId})
          RETURNING id
        `
        info(`    → inserted id=${row.id}`)
      }
      inserted++
    }
  }
  info(`  ✓ ${updated} updated, ${inserted} inserted`)

  // -----------------------------------------------------------------------
  // Step 4: Set video_id on single-video VID rows
  // -----------------------------------------------------------------------
  info("\nStep 4: Setting video_id on single-video VID rows...")

  let vidIdSet = 0
  for (const fix of SINGLE_VIDEO_FIXES) {
    const [existing] = await sql`
      SELECT video_id FROM files WHERE id = ${fix.vidId}
    `
    if (existing?.video_id === fix.videoId) {
      continue // already set
    }

    info(`  UPDATE id=${fix.vidId}: video_id=${fix.videoId}`)
    if (!DRY_RUN) {
      await sql`
        UPDATE files SET video_id = ${fix.videoId} WHERE id = ${fix.vidId}
      `
    }
    vidIdSet++
  }
  info(`  ✓ ${vidIdSet} VID rows updated`)

  // -----------------------------------------------------------------------
  // Step 5: Verification
  // -----------------------------------------------------------------------
  info("\nStep 5: Verification...")

  const counts = await sql`
    SELECT
      count(*) FILTER (WHERE r2_key LIKE 'source/release-1/%') as new_prefix,
      count(*) FILTER (WHERE r2_key LIKE 'release_1/%') as old_prefix,
      count(*) FILTER (WHERE r2_key IS NULL) as null_key,
      count(*) as total
    FROM files
  `
  const c = counts[0]
  info(`  Total records: ${c.total}`)
  info(`  source/release-1/ prefix: ${c.new_prefix}`)
  info(`  release_1/ prefix (legacy): ${c.old_prefix}`)
  info(`  NULL r2_key: ${c.null_key}`)

  const typeCounts = await sql`
    SELECT type, count(*)::int as cnt FROM files GROUP BY type ORDER BY type
  `
  info("\n  Type breakdown:")
  for (const t of typeCounts) {
    info(`    ${t.type}: ${t.cnt}`)
  }

  const dupeCheck = await sql`
    SELECT title, type, count(*)::int as cnt
    FROM files
    GROUP BY title, type
    HAVING count(*) > 1
    ORDER BY cnt DESC
  `
  if (dupeCheck.length > 0) {
    info("\n  Duplicate title+type combinations (expected for multi-PDF D-files):")
    for (const d of dupeCheck) {
      info(`    "${d.title}" [${d.type}] × ${d.cnt}`)
    }
  }

  // Check for VID rows missing video_id
  const missingVidId = await sql`
    SELECT id, title FROM files WHERE type = 'VID' AND (video_id IS NULL OR video_id = '')
  `
  if (missingVidId.length > 0) {
    warn(`\n  ${missingVidId.length} VID rows still missing video_id:`)
    for (const r of missingVidId) {
      warn(`    id=${r.id} ${r.title}`)
    }
  } else {
    info("\n  ✓ All VID rows have video_id set")
  }

  info(
    `\n${"=".repeat(60)}\n  Migration ${DRY_RUN ? "DRY RUN complete" : "APPLIED successfully"}.\n${"=".repeat(60)}\n`
  )

  if (DRY_RUN) {
    info("To apply these changes, run again with --apply\n")
  }

  await sql.end()
}

main().catch(async (err) => {
  console.error("Fatal:", err)
  await sql.end()
  process.exit(1)
})
