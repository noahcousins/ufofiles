ALTER TABLE "files" ADD COLUMN "extraction_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "extraction_method" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "extraction_error" text;