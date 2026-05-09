CREATE TABLE "release_downloads" (
	"id" serial PRIMARY KEY NOT NULL,
	"release_id" integer NOT NULL,
	"label" text NOT NULL,
	"slug" text NOT NULL,
	"r2_key" text NOT NULL,
	"file_size" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "release_downloads" ADD CONSTRAINT "release_downloads_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;