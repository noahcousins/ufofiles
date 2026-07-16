import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  type SQL,
  type SQLWrapper,
  sql,
} from "drizzle-orm"
import { z } from "zod/v4"
import { cacheKey, withCache } from "@/lib/cache"
import { db } from "@/lib/db"
import { publicFileColumns } from "@/lib/db/file-columns"
import { files, fileTags, tags } from "@/lib/db/schema"
import { router } from "../init"
import { rateLimitedProcedure } from "../rateLimit"

const SIX_HOURS = 6 * 60 * 60
const ONE_DAY = 24 * 60 * 60

// Bound free-text / array inputs so an attacker can't blow up cache-key
// cardinality (and query cost) with unbounded, ever-varying inputs.
const MAX_SEARCH_LEN = 200
const MAX_AGENCY_LEN = 200
const MAX_TAGS = 50
const MAX_TAG_LEN = 100

const crossFilterInput = z
  .object({
    search: z.string().max(MAX_SEARCH_LEN).optional(),
    agency: z.string().max(MAX_AGENCY_LEN).optional(),
    type: z.enum(["image", "video", "pdf", "other"]).optional(),
    dateRange: z
      .enum(["2010-now", "2000s", "1960-2000", "pre-1960"])
      .optional(),
    releaseId: z.number().optional(),
    tags: z.array(z.string().max(MAX_TAG_LEN)).max(MAX_TAGS).optional(),
  })
  .optional()

const DATE_RANGES: Record<string, [number, number]> = {
  "2010-now": [2010, new Date().getFullYear()],
  "2000s": [2000, 2009],
  "1960-2000": [1960, 1999],
  "pre-1960": [0, 1959],
}

/**
 * Files having ALL the given tag slugs. `fileId` is the calling query's
 * file-id expression — `files.id` for drizzle-built queries, `sql`f.id`` for
 * the raw feed queries.
 */
function tagMatchCondition(fileId: SQLWrapper, tagSlugs: string[]) {
  return sql`${fileId} IN (
    SELECT ft.file_id FROM file_tags ft
    JOIN tags t ON t.id = ft.tag_id
    WHERE t.slug IN (${sql.join(
      tagSlugs.map((t) => sql`${t}`),
      sql`, `
    )})
    GROUP BY ft.file_id
    HAVING COUNT(DISTINCT t.slug) = ${tagSlugs.length}
  )`
}

/**
 * The date-range filter's bucket CASE, shared by dateRangeCounts and
 * videoFeedFacets. NULL years fall through the CASE as NULL — callers filter
 * them out.
 */
function dateBucketCase(incidentYear: SQLWrapper): SQL<string> {
  return sql<string>`
    CASE
      WHEN ${incidentYear} >= 2010 THEN '2010-now'
      WHEN ${incidentYear} >= 2000 THEN '2000s'
      WHEN ${incidentYear} >= 1960 THEN '1960-2000'
      WHEN ${incidentYear} IS NOT NULL THEN 'pre-1960'
    END
  `
}

/** Shared filter-condition builder used by list, typeCounts, etc. */
function buildFilterConditions(input: {
  search?: string
  agency?: string
  type?: "image" | "video" | "pdf" | "other"
  dateRange?: "2010-now" | "2000s" | "1960-2000" | "pre-1960"
  releaseId?: number
  tags?: string[]
}) {
  const conditions = []

  if (input.search) {
    conditions.push(
      sql`(
        setweight(to_tsvector('english', coalesce(${files.title}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${files.description}, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(${files.incidentLocation}, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(${files.textContent}, '')), 'C')
      ) @@ websearch_to_tsquery('english', ${input.search})`
    )
  }

  if (input.agency) {
    conditions.push(ilike(files.agency, `%${input.agency}%`))
  }

  if (input.type) {
    const mimePrefixes: Record<string, string> = {
      image: "image/%",
      video: "video/%",
      pdf: "application/pdf",
      other: "application/octet-stream",
    }
    const pattern = mimePrefixes[input.type]
    if (input.type === "pdf" || input.type === "other") {
      conditions.push(eq(files.mimeType, pattern))
    } else {
      conditions.push(ilike(files.mimeType, pattern))
    }
  }

  if (input.dateRange) {
    const [min, max] = DATE_RANGES[input.dateRange]
    conditions.push(gte(files.incidentYear, min))
    conditions.push(lte(files.incidentYear, max))
  }

  if (input.releaseId) {
    conditions.push(eq(files.releaseId, input.releaseId))
  }

  if (input.tags && input.tags.length > 0) {
    conditions.push(tagMatchCondition(files.id, input.tags))
  }

  return conditions
}

// Filters accepted by the video feed + its facet counts. A subset of the
// browser's filters: no search (no search UI on /watch) and no type (the feed
// is videos by definition).
const feedFilterFields = {
  agency: z.string().max(MAX_AGENCY_LEN).optional(),
  dateRange: z.enum(["2010-now", "2000s", "1960-2000", "pre-1960"]).optional(),
  releaseId: z.number().optional(),
  tags: z.array(z.string().max(MAX_TAG_LEN)).max(MAX_TAGS).optional(),
}

const feedFilterSchema = z.object(feedFilterFields)

type FeedFilterInput = z.infer<typeof feedFilterSchema>

/**
 * WHERE clause for the feed queries: baseline eligibility plus the optional
 * filters. Rendered as raw SQL against the `files f` alias the feed queries
 * use — the drizzle column refs in buildFilterConditions would render the
 * unaliased table name.
 */
function buildFeedWhere(input: FeedFilterInput) {
  const conditions = [
    sql`f.mime_type ILIKE 'video/%'`,
    sql`f.r2_key IS NOT NULL`,
  ]

  if (input.agency) {
    conditions.push(sql`f.agency ILIKE ${`%${input.agency}%`}`)
  }

  if (input.dateRange) {
    const [min, max] = DATE_RANGES[input.dateRange]
    conditions.push(sql`f.incident_year BETWEEN ${min} AND ${max}`)
  }

  if (input.releaseId) {
    conditions.push(sql`f.release_id = ${input.releaseId}`)
  }

  if (input.tags && input.tags.length > 0) {
    conditions.push(tagMatchCondition(sql`f.id`, input.tags))
  }

  return sql.join(conditions, sql` AND `)
}

// Shared column projection + row mapper for the video feed, so the paginated
// feed and the single-video "start here" lookup return identical item shapes.
const feedColumns = sql`
  f.id,
  f.title,
  f.agency,
  f.r2_key,
  f.file_size,
  f.mime_type,
  f.incident_date,
  f.incident_location,
  f.description,
  (SELECT r.name FROM releases r WHERE r.id = f.release_id) AS release_name,
  (SELECT r.title FROM releases r WHERE r.id = f.release_id) AS release_title,
  COALESCE(
    (SELECT json_agg(json_build_object('slug', t.slug, 'label', t.label))
     FROM file_tags ft
     JOIN tags t ON t.id = ft.tag_id
     WHERE ft.file_id = f.id),
    '[]'::json
  ) AS tags,
  COALESCE(
    (SELECT json_agg(
       json_build_object(
         'id', vm.id,
         'startSeconds', vm.start_seconds,
         'endSeconds', vm.end_seconds,
         'description', vm.description,
         'source', vm.source
       ) ORDER BY vm.sort_order
     )
     FROM video_moments vm
     WHERE vm.file_id = f.id),
    '[]'::json
  ) AS moments,
  (SELECT COUNT(*) FROM bookmarks b WHERE b.file_id = f.id)::int AS bookmark_count
`

type FeedRow = {
  agency: string | null
  bookmark_count: number | string | null
  description: string | null
  file_size: number | string | null
  id: number
  incident_date: string | null
  incident_location: string | null
  mime_type: string | null
  moments:
    | {
        id: number
        startSeconds: number
        endSeconds: number | null
        description: string
        source: "official" | "ai-generated"
      }[]
    | null
  r2_key: string | null
  release_name: string | null
  release_title: string | null
  tags: { slug: string; label: string }[] | null
  title: string
}

function mapFeedRow(row: FeedRow) {
  return {
    id: row.id,
    title: row.title,
    agency: row.agency,
    r2Key: row.r2_key,
    fileSize: row.file_size ? Number(row.file_size) : null,
    mimeType: row.mime_type,
    incidentDate: row.incident_date,
    incidentLocation: row.incident_location,
    description: row.description,
    release: row.release_name
      ? { name: row.release_name, title: row.release_title ?? row.release_name }
      : null,
    tags: row.tags ?? [],
    moments: row.moments ?? [],
    bookmarkCount: Number(row.bookmark_count ?? 0),
  }
}

export const filesRouter = router({
  list: rateLimitedProcedure("query")
    .input(
      z.object({
        search: z.string().max(MAX_SEARCH_LEN).optional(),
        agency: z.string().max(MAX_AGENCY_LEN).optional(),
        type: z.enum(["image", "video", "pdf", "other"]).optional(),
        dateRange: z
          .enum(["2010-now", "2000s", "1960-2000", "pre-1960"])
          .optional(),
        releaseId: z.number().optional(),
        tags: z.array(z.string().max(MAX_TAG_LEN)).max(MAX_TAGS).optional(),
        cursor: z.number().min(1).nullish(),
        pageSize: z.number().min(1).max(100).default(48),
        sortBy: z
          .enum(["newest", "oldest", "most-views", "least-views"])
          .default("most-views"),
        // A deep-linked file to surface first (e.g. the feed's "Details").
        // Still subject to the filters above — it only appears if it matches,
        // so filtering stays correct; when present and matching, it sorts to
        // the front so its modal opens without paging to find it.
        priorityId: z.number().int().positive().optional(),
      })
    )
    .query(async ({ input }) => {
      const { cursor, pageSize = 48, sortBy = "most-views" } = input

      const page = cursor ?? 1

      return withCache(
        cacheKey("files:list:v9", {
          search: input.search,
          agency: input.agency,
          type: input.type,
          dateRange: input.dateRange,
          releaseId: input.releaseId,
          tags: input.tags,
          page,
          pageSize,
          sortBy,
          priorityId: input.priorityId,
        }),
        SIX_HOURS,
        async () => {
          const conditions = buildFilterConditions(input)

          const where = conditions.length > 0 ? and(...conditions) : undefined

          // Shared public projection (excludes textContent + extraction* — see
          // lib/db/file-columns.ts).
          const listColumns = publicFileColumns

          const sortByViews =
            sortBy === "most-views" || sortBy === "least-views"

          // When a priority file is requested, sort it to the very front (it
          // still has to pass `where`, so it drops out when filtered away).
          const priorityOrder = input.priorityId
            ? [sql`(${files.id} = ${input.priorityId}) DESC`]
            : []

          const items = sortByViews
            ? await (() => {
                const viewCountExpr = sql<number>`(SELECT COUNT(*)::int FROM events WHERE events.file_id = ${files.id} AND events.type = 'view')`
                const orderFn = sortBy === "most-views" ? desc : asc
                return db
                  .select(listColumns)
                  .from(files)
                  .where(where)
                  .orderBy(
                    ...priorityOrder,
                    orderFn(viewCountExpr),
                    desc(files.createdAt)
                  )
                  .limit(pageSize)
                  .offset((page - 1) * pageSize)
              })()
            : await db
                .select(listColumns)
                .from(files)
                .where(where)
                .orderBy(
                  ...priorityOrder,
                  (sortBy === "newest" ? desc : asc)(files.createdAt)
                )
                .limit(pageSize)
                .offset((page - 1) * pageSize)

          const [total] = await db
            .select({ count: count() })
            .from(files)
            .where(where)

          const totalPages = Math.ceil(total.count / pageSize)

          return {
            items,
            total: total.count,
            nextCursor: page < totalPages ? page + 1 : undefined,
          }
        }
      )
    }),

  byId: rateLimitedProcedure("query")
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) =>
      withCache(cacheKey("files:byId", input), ONE_DAY, async () => {
        const [file] = await db
          .select(publicFileColumns)
          .from(files)
          .where(eq(files.id, input.id))
          .limit(1)

        if (!file) {
          return null
        }
        return file
      })
    ),

  agencies: rateLimitedProcedure("query").query(async () =>
    withCache("files:agencies", ONE_DAY, async () => {
      const result = await db
        .selectDistinct({ agency: files.agency })
        .from(files)
        .where(sql`${files.agency} != ''`)
        .orderBy(asc(files.agency))

      return result.map((r) => r.agency)
    })
  ),

  typeCounts: rateLimitedProcedure("query")
    .input(crossFilterInput)
    .query(async ({ input }) =>
      withCache(
        cacheKey("files:mimeTypeCounts:v5", input),
        SIX_HOURS,
        async () => {
          const category = sql<string>`
          CASE
            WHEN ${files.mimeType} LIKE 'image/%' THEN 'image'
            WHEN ${files.mimeType} LIKE 'video/%' THEN 'video'
            WHEN ${files.mimeType} = 'application/pdf' THEN 'pdf'
            ELSE 'other'
          END
        `.as("file_type")

          const conditions = buildFilterConditions(input ?? {})
          conditions.push(sql`${files.mimeType} IS NOT NULL`)

          const result = await db
            .select({
              type: category,
              count: count(),
            })
            .from(files)
            .where(and(...conditions))
            .groupBy(category)

          return result
        }
      )
    ),

  dateRangeCounts: rateLimitedProcedure("query")
    .input(crossFilterInput)
    .query(async ({ input }) =>
      withCache(
        cacheKey("files:dateRangeCounts:v2", input),
        SIX_HOURS,
        async () => {
          const bucket = dateBucketCase(files.incidentYear).as("date_bucket")

          const conditions = buildFilterConditions({
            ...input,
            dateRange: undefined,
          })
          conditions.push(sql`${files.incidentYear} IS NOT NULL`)

          const result = await db
            .select({
              bucket,
              count: count(),
            })
            .from(files)
            .where(and(...conditions))
            .groupBy(bucket)

          return result
        }
      )
    ),

  locations: rateLimitedProcedure("query").query(async () =>
    withCache("files:locations", ONE_DAY, async () => {
      const result = await db
        .select({
          location: files.incidentLocation,
          count: count().as("count"),
        })
        .from(files)
        .where(
          sql`${files.incidentLocation} IS NOT NULL AND ${files.incidentLocation} != '' AND ${files.incidentLocation} != 'N/A'`
        )
        .groupBy(files.incidentLocation)
        .orderBy(desc(count()))

      return result
    })
  ),

  tags: rateLimitedProcedure("query")
    .input(crossFilterInput)
    .query(async ({ input }) =>
      withCache(cacheKey("files:tags:v3", input), SIX_HOURS, async () => {
        const conditions = buildFilterConditions({
          ...input,
          tags: undefined,
        })

        const where =
          conditions.length > 0 ? sql`AND ${and(...conditions)}` : sql``

        const result = await db
          .select({
            slug: tags.slug,
            label: tags.label,
            category: tags.category,
            count: sql<number>`COUNT(DISTINCT ${fileTags.fileId})::int`.as(
              "count"
            ),
          })
          .from(tags)
          .innerJoin(fileTags, eq(fileTags.tagId, tags.id))
          .where(
            sql`${fileTags.fileId} IN (SELECT ${files.id} FROM ${files} WHERE 1=1 ${where})`
          )
          .groupBy(tags.slug, tags.label, tags.category)
          .orderBy(desc(sql`count`))

        return result
      })
    ),

  videoFeed: rateLimitedProcedure("query")
    .input(
      z.object({
        cursor: z.number().min(1).nullish(),
        pageSize: z.number().min(1).max(20).default(5),
        seed: z.string().default("default"),
        ...feedFilterFields,
      })
    )
    .query(async ({ input }) => {
      const { cursor, pageSize = 5, seed } = input
      const page = cursor ?? 1

      return withCache(
        cacheKey("files:videoFeed:v10", {
          page,
          pageSize,
          seed,
          agency: input.agency,
          dateRange: input.dateRange,
          releaseId: input.releaseId,
          tags: input.tags,
        }),
        SIX_HOURS,
        async () => {
          const where = buildFeedWhere(input)

          const feedQuery = sql`
            SELECT ${feedColumns}
            FROM files f
            WHERE ${where}
            ORDER BY md5(f.id::text || ${seed})
            LIMIT ${pageSize}
            OFFSET ${(page - 1) * pageSize}
          `

          const countQuery = sql`
            SELECT COUNT(*) AS count
            FROM files f
            WHERE ${where}
          `

          const items = await db.execute<FeedRow>(feedQuery)
          const [totalRow] = await db.execute<{ count: number | string }>(
            countQuery
          )
          const total = Number(totalRow?.count ?? 0)
          const totalPages = Math.ceil(total / pageSize)

          return {
            items: items.map(mapFeedRow),
            total,
            nextCursor: page < totalPages ? page + 1 : undefined,
          }
        }
      )
    }),

  // Faceted counts for the watch-page filter drawer. Each facet excludes its
  // own dimension (picking a release still shows the other releases' counts)
  // while applying the rest, and everything is scoped to feed-eligible videos.
  videoFeedFacets: rateLimitedProcedure("query")
    .input(feedFilterSchema.optional())
    .query(({ input }) => {
      // Normalize before keying: a missing input and an empty object must
      // share one cache key rather than fragmenting into two.
      const filters = input ?? {}

      return withCache(
        cacheKey("files:videoFeedFacets:v2", filters),
        SIX_HOURS,
        async () => {
          const releaseRows = await db.execute<{
            release_id: number
            count: number | string
          }>(sql`
            SELECT f.release_id, COUNT(*) AS count
            FROM files f
            WHERE ${buildFeedWhere({ ...filters, releaseId: undefined })}
            GROUP BY f.release_id
          `)

          const dateRows = await db.execute<{
            bucket: string
            count: number | string
          }>(sql`
            SELECT
              ${dateBucketCase(sql`f.incident_year`)} AS bucket,
              COUNT(*) AS count
            FROM files f
            WHERE ${buildFeedWhere({ ...filters, dateRange: undefined })}
              AND f.incident_year IS NOT NULL
            GROUP BY bucket
          `)

          const tagRows = await db.execute<{
            slug: string
            label: string
            category: string
            count: number | string
          }>(sql`
            SELECT t.slug, t.label, t.category,
              COUNT(DISTINCT ft.file_id) AS count
            FROM tags t
            JOIN file_tags ft ON ft.tag_id = t.id
            WHERE ft.file_id IN (
              SELECT f.id FROM files f
              WHERE ${buildFeedWhere({ ...filters, tags: undefined })}
            )
            GROUP BY t.slug, t.label, t.category
            ORDER BY count DESC
          `)

          const agencyRows = await db.execute<{ agency: string }>(sql`
            SELECT DISTINCT f.agency
            FROM files f
            WHERE ${buildFeedWhere({ ...filters, agency: undefined })}
              AND f.agency IS NOT NULL AND f.agency != ''
            ORDER BY f.agency
          `)

          return {
            agencies: agencyRows.map((r) => r.agency),
            releaseCounts: Object.fromEntries(
              releaseRows.map((r) => [r.release_id, Number(r.count)])
            ) as Record<number, number>,
            dateRangeCounts: dateRows.map((r) => ({
              bucket: r.bucket,
              count: Number(r.count),
            })),
            tags: tagRows.map((r) => ({
              slug: r.slug,
              label: r.label,
              category: r.category,
              count: Number(r.count),
            })),
          }
        }
      )
    }),

  // The single video a share link points at, in the feed item shape, so the
  // feed can pin it first and then randomize the rest from there.
  feedVideoById: rateLimitedProcedure("query")
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ input }) =>
      withCache(
        cacheKey("files:feedVideoById:v6", { id: input.id }),
        SIX_HOURS,
        async () => {
          const rows = await db.execute<FeedRow>(sql`
            SELECT ${feedColumns}
            FROM files f
            WHERE f.id = ${input.id}
              AND f.mime_type ILIKE 'video/%'
              AND f.r2_key IS NOT NULL
            LIMIT 1
          `)
          const row = rows[0]
          return row ? mapFeedRow(row) : null
        }
      )
    ),

  releaseCounts: rateLimitedProcedure("query")
    .input(crossFilterInput)
    .query(async ({ input }) =>
      withCache(
        cacheKey("files:releaseCounts:v1", input),
        SIX_HOURS,
        async () => {
          const conditions = buildFilterConditions({
            ...input,
            releaseId: undefined,
          })

          const where = conditions.length > 0 ? and(...conditions) : undefined

          const result = await db
            .select({
              releaseId: files.releaseId,
              count: count(),
            })
            .from(files)
            .where(where)
            .groupBy(files.releaseId)

          return Object.fromEntries(
            result.map((r) => [r.releaseId, r.count])
          ) as Record<number, number>
        }
      )
    ),
})
