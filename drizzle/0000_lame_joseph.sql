CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" integer NOT NULL,
	"type" varchar(32) DEFAULT 'view' NOT NULL,
	"ip" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"release_id" integer NOT NULL,
	"title" text NOT NULL,
	"agency" text DEFAULT '' NOT NULL,
	"release_date" text,
	"incident_date" text,
	"incident_year" integer,
	"incident_location" text,
	"type" text NOT NULL,
	"r2_key" text,
	"file_size" bigint,
	"mime_type" text,
	"document_url" text,
	"thumbnail_url" text,
	"video_id" text,
	"description" text,
	"redacted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"release_date" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "releases_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_file_id_idx" ON "events" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_file_id_created_at_idx" ON "events" USING btree ("file_id","created_at");