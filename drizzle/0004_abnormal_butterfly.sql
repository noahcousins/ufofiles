CREATE INDEX "files_search_idx" ON "files" USING gin ((
      setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
      setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("incident_location", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("text_content", '')), 'C')
    ));