import { relations } from "drizzle-orm"
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
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

export const files = pgTable("files", {
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
  redacted: boolean("redacted").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

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

export const releasesRelations = relations(releases, ({ many }) => ({
  files: many(files),
}))

export const filesRelations = relations(files, ({ one, many }) => ({
  release: one(releases, {
    fields: [files.releaseId],
    references: [releases.id],
  }),
  events: many(events),
}))

export const eventsRelations = relations(events, ({ one }) => ({
  file: one(files, {
    fields: [events.fileId],
    references: [files.id],
  }),
}))
