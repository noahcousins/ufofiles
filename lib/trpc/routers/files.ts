import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
} from "drizzle-orm"
import { z } from "zod/v4"
import { cacheKey, withCache } from "@/lib/cache"
import { db } from "@/lib/db"
import { files } from "@/lib/db/schema"
import { router } from "../init"
import { rateLimitedProcedure } from "../rateLimit"

const SIX_HOURS = 6 * 60 * 60
const ONE_DAY = 24 * 60 * 60

const DATE_RANGES: Record<string, [number, number]> = {
  "2010-now": [2010, new Date().getFullYear()],
  "2000s": [2000, 2009],
  "1960-2000": [1960, 1999],
  "pre-1960": [0, 1959],
}

/** Shared filter-condition builder used by list, typeCounts, etc. */
function buildFilterConditions(input: {
  search?: string
  agency?: string
  type?: "image" | "video" | "pdf" | "other"
  dateRange?: "2010-now" | "2000s" | "1960-2000" | "pre-1960"
  releaseId?: number
}) {
  const conditions = []

  if (input.search) {
    conditions.push(
      or(
        ilike(files.title, `%${input.search}%`),
        ilike(files.description, `%${input.search}%`),
        ilike(files.incidentLocation, `%${input.search}%`),
        ilike(files.textContent, `%${input.search}%`)
      )
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

  return conditions
}

export const filesRouter = router({
  list: rateLimitedProcedure("query")
    .input(
      z.object({
        search: z.string().optional(),
        agency: z.string().optional(),
        type: z.enum(["image", "video", "pdf", "other"]).optional(),
        dateRange: z
          .enum(["2010-now", "2000s", "1960-2000", "pre-1960"])
          .optional(),
        releaseId: z.number().optional(),
        cursor: z.number().min(1).nullish(),
        pageSize: z.number().min(1).max(100).default(48),
        sortBy: z
          .enum(["newest", "oldest", "most-views", "least-views"])
          .default("newest"),
      })
    )
    .query(async ({ input }) => {
      const {
        cursor,
        pageSize = 48,
        sortBy = "newest",
      } = input

      const page = cursor ?? 1

      return withCache(
        cacheKey("files:list:v6", {
          search: input.search,
          agency: input.agency,
          type: input.type,
          dateRange: input.dateRange,
          releaseId: input.releaseId,
          page,
          pageSize,
          sortBy,
        }),
        SIX_HOURS,
        async () => {
          const conditions = buildFilterConditions(input)

          const where = conditions.length > 0 ? and(...conditions) : undefined

          // exclude textContent from responses — too large for list queries
          const listColumns = {
            id: files.id,
            releaseId: files.releaseId,
            title: files.title,
            agency: files.agency,
            releaseDate: files.releaseDate,
            incidentDate: files.incidentDate,
            incidentYear: files.incidentYear,
            incidentLocation: files.incidentLocation,
            type: files.type,
            r2Key: files.r2Key,
            fileSize: files.fileSize,
            mimeType: files.mimeType,
            documentUrl: files.documentUrl,
            thumbnailUrl: files.thumbnailUrl,
            videoId: files.videoId,
            description: files.description,
            transcriptR2Key: files.transcriptR2Key,
            redacted: files.redacted,
            createdAt: files.createdAt,
          }

          const sortByViews =
            sortBy === "most-views" || sortBy === "least-views"

          const items = sortByViews
            ? await (() => {
                const viewCountExpr = sql<number>`(SELECT COUNT(*)::int FROM events WHERE events.file_id = ${files.id} AND events.type = 'view')`
                const orderFn = sortBy === "most-views" ? desc : asc
                return db
                  .select(listColumns)
                  .from(files)
                  .where(where)
                  .orderBy(orderFn(viewCountExpr), desc(files.createdAt))
                  .limit(pageSize)
                  .offset((page - 1) * pageSize)
              })()
            : await db
                .select(listColumns)
                .from(files)
                .where(where)
                .orderBy((sortBy === "newest" ? desc : asc)(files.createdAt))
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
          .select({
            id: files.id,
            releaseId: files.releaseId,
            title: files.title,
            agency: files.agency,
            releaseDate: files.releaseDate,
            incidentDate: files.incidentDate,
            incidentYear: files.incidentYear,
            incidentLocation: files.incidentLocation,
            type: files.type,
            r2Key: files.r2Key,
            fileSize: files.fileSize,
            mimeType: files.mimeType,
            documentUrl: files.documentUrl,
            thumbnailUrl: files.thumbnailUrl,
            videoId: files.videoId,
            description: files.description,
            transcriptR2Key: files.transcriptR2Key,
            redacted: files.redacted,
            createdAt: files.createdAt,
          })
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
    .input(
      z
        .object({
          search: z.string().optional(),
          agency: z.string().optional(),
          dateRange: z
            .enum(["2010-now", "2000s", "1960-2000", "pre-1960"])
            .optional(),
        })
        .optional()
    )
    .query(async ({ input }) =>
      withCache(
        cacheKey("files:mimeTypeCounts:v4", input),
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

  dateRangeCounts: rateLimitedProcedure("query").query(async () =>
    withCache("files:dateRangeCounts:v1", ONE_DAY, async () => {
      const bucket = sql<string>`
        CASE
          WHEN ${files.incidentYear} >= 2010 THEN '2010-now'
          WHEN ${files.incidentYear} >= 2000 THEN '2000s'
          WHEN ${files.incidentYear} >= 1960 THEN '1960-2000'
          WHEN ${files.incidentYear} IS NOT NULL THEN 'pre-1960'
        END
      `.as("date_bucket")

      const result = await db
        .select({
          bucket,
          count: count(),
        })
        .from(files)
        .where(sql`${files.incidentYear} IS NOT NULL`)
        .groupBy(bucket)

      return result
    })
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
})
