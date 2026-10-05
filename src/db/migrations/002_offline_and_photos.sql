-- SiteLog migration 002
-- Offline-safe submission and photo storage.

BEGIN;

-- The phone generates this id once, when the supervisor presses Send, and
-- reuses it on every retry. Without it, a report submitted in a dead zone and
-- retried twice could be stored twice.
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS client_uuid UUID;

-- Partial, so the rows that existed before this migration (all NULL) do not
-- collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_client_uuid
    ON daily_reports (client_uuid)
    WHERE client_uuid IS NOT NULL;

-- Photo metadata recorded at upload time. Useful for showing a thumbnail
-- without reading the file, and for spotting oversized uploads.
ALTER TABLE report_photos ADD COLUMN IF NOT EXISTS byte_size   BIGINT;
ALTER TABLE report_photos ADD COLUMN IF NOT EXISTS mime_type   TEXT;
ALTER TABLE report_photos ADD COLUMN IF NOT EXISTS uploaded_by BIGINT REFERENCES users (id);

COMMIT;
