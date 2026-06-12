import { relations, sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"

export const releases = pgTable("releases", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  title: text("title").notNull(),
  releaseDate: text("release_date"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const files = pgTable(
  "files",
  {
    id: serial("id").primaryKey(),
    releaseId: integer("release_id")
      .notNull()
      .references(() => releases.id),
    title: text("title").notNull(),
    agency: text("agency").notNull().default(""),
    releaseDate: text("release_date"),
    incidentDate: text("incident_date"),
    incidentYear: integer("incident_year"),
    incidentLocation: text("incident_location"),
    type: text("type").notNull(), // @todo: enum this
    r2Key: text("r2_key"),
    fileSize: bigint("file_size", { mode: "number" }),
    mimeType: text("mime_type"),
    documentUrl: text("document_url"),
    thumbnailUrl: text("thumbnail_url"),
    videoId: text("video_id"),
    description: text("description"),
    textContent: text("text_content"),
    transcriptR2Key: text("transcript_r2_key"),
    extractionStatus: text("extraction_status").notNull().default("pending"),
    extractionMethod: text("extraction_method"),
    extractionError: text("extraction_error"),
    redacted: boolean("redacted").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("files_search_idx").using(
      "gin",
      sql`(
      setweight(to_tsvector('english', coalesce(${table.title}, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(${table.description}, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(${table.incidentLocation}, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(${table.textContent}, '')), 'C')
    )`
    ),
  ]
)

export const releaseDownloads = pgTable("release_downloads", {
  id: serial("id").primaryKey(),
  releaseId: integer("release_id")
    .notNull()
    .references(() => releases.id),
  label: text("label").notNull(),
  slug: text("slug").notNull(),
  r2Key: text("r2_key").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const fileTags = pgTable(
  "file_tags",
  {
    fileId: integer("file_id")
      .notNull()
      .references(() => files.id),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id),
  },
  (t) => [
    index("file_tags_file_id_idx").on(t.fileId),
    index("file_tags_tag_id_idx").on(t.tagId),
  ]
)

export const videoMoments = pgTable(
  "video_moments",
  {
    id: serial("id").primaryKey(),
    fileId: integer("file_id")
      .notNull()
      .references(() => files.id),
    startSeconds: integer("start_seconds").notNull(),
    endSeconds: integer("end_seconds"),
    description: text("description").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("video_moments_file_id_idx").on(t.fileId)]
)

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    fileId: integer("file_id")
      .notNull()
      .references(() => files.id),
    type: varchar("type", { length: 32 }).notNull().default("view"),
    ip: varchar("ip", { length: 45 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("events_file_id_idx").on(t.fileId),
    index("events_created_at_idx").on(t.createdAt),
    index("events_file_id_created_at_idx").on(t.fileId, t.createdAt),
  ]
)

export const releaseDownloadsRelations = relations(
  releaseDownloads,
  ({ one }) => ({
    release: one(releases, {
      fields: [releaseDownloads.releaseId],
      references: [releases.id],
    }),
  })
)

export const releasesRelations = relations(releases, ({ many }) => ({
  files: many(files),
  releaseDownloads: many(releaseDownloads),
}))

export const filesRelations = relations(files, ({ one, many }) => ({
  release: one(releases, {
    fields: [files.releaseId],
    references: [releases.id],
  }),
  events: many(events),
  fileTags: many(fileTags),
  videoMoments: many(videoMoments),
}))

export const videoMomentsRelations = relations(videoMoments, ({ one }) => ({
  file: one(files, {
    fields: [videoMoments.fileId],
    references: [files.id],
  }),
}))

export const eventsRelations = relations(events, ({ one }) => ({
  file: one(files, {
    fields: [events.fileId],
    references: [files.id],
  }),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  fileTags: many(fileTags),
}))

export const fileTagsRelations = relations(fileTags, ({ one }) => ({
  file: one(files, {
    fields: [fileTags.fileId],
    references: [files.id],
  }),
  tag: one(tags, {
    fields: [fileTags.tagId],
    references: [tags.id],
  }),
}))

// ── Identity (better-auth) ────────────────────────────────────────────────
// A `user` row with `isAnonymous = true` is a Guest (ADR-0003): a credential-
// less identity created silently on a visitor's first mark. Upgrading links a
// real account (magic-link or Google) and merges the Guest's marks in. Tables
// below mirror what the better-auth Drizzle adapter expects — do not rename
// columns without updating the adapter config in `lib/auth.ts`.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Set by the anonymous plugin. A Guest has this true; an upgraded Member
  // has it false (or null for accounts that were never anonymous).
  isAnonymous: boolean("is_anonymous"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("session_user_id_idx").on(t.userId)]
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)]
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
)

// ── Marking ───────────────────────────────────────────────────────────────

// A Bookmark marks a whole File. The unique (userId, fileId) index is what
// makes the upgrade merge collapse duplicate Bookmarks on the same File.
export const bookmarks = pgTable(
  "bookmarks",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileId: integer("file_id")
      .notNull()
      .references(() => files.id),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("bookmarks_user_file_idx").on(t.userId, t.fileId),
    index("bookmarks_user_idx").on(t.userId),
  ]
)

// A Clip marks a time range within a video File. The unique index covers the
// exact bounds — merge collapses Clips only when their bounds are identical
// (ADR-0003), never near-matches.
export const clips = pgTable(
  "clips",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileId: integer("file_id")
      .notNull()
      .references(() => files.id),
    startSeconds: integer("start_seconds").notNull(),
    endSeconds: integer("end_seconds").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("clips_user_bounds_idx").on(
      t.userId,
      t.fileId,
      t.startSeconds,
      t.endSeconds
    ),
    index("clips_user_idx").on(t.userId),
  ]
)

export const collections = pgTable(
  "collections",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("collections_user_idx").on(t.userId)]
)

// A Collection references marks rather than containing them. The reference is
// polymorphic: a row points at either a Bookmark or a Clip. There is no FK on
// `markId` because the target table varies — mark deletes clean these up in
// the router, and the upgrade merge re-points them when a mark collapses.
export const collectionMarks = pgTable(
  "collection_marks",
  {
    collectionId: integer("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    markType: text("mark_type").notNull(), // "bookmark" | "clip"
    markId: integer("mark_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.markType, t.markId] }),
    index("collection_marks_collection_idx").on(t.collectionId),
  ]
)

export const userRelations = relations(user, ({ many }) => ({
  bookmarks: many(bookmarks),
  clips: many(clips),
  collections: many(collections),
}))

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(user, { fields: [bookmarks.userId], references: [user.id] }),
  file: one(files, { fields: [bookmarks.fileId], references: [files.id] }),
}))

export const clipsRelations = relations(clips, ({ one }) => ({
  user: one(user, { fields: [clips.userId], references: [user.id] }),
  file: one(files, { fields: [clips.fileId], references: [files.id] }),
}))

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  user: one(user, { fields: [collections.userId], references: [user.id] }),
  marks: many(collectionMarks),
}))

export const collectionMarksRelations = relations(
  collectionMarks,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionMarks.collectionId],
      references: [collections.id],
    }),
  })
)
