-- SiteLog migration 003
-- Indexes supporting the management dashboard.
--
-- These exist because the dashboard groups across every report ever filed.
-- That is fine with fifty rows and slow with fifty thousand, which is where
-- this will be in a year.

BEGIN;

-- "Manpower by trade" groups on trade across a date range.
CREATE INDEX IF NOT EXISTS idx_manpower_trade ON manpower_entries (trade);

-- "Equipment utilisation" groups on equipment name the same way.
CREATE INDEX IF NOT EXISTS idx_equipment_name ON equipment_entries (equipment_name);

-- The outstanding-reports view scans active sites of active projects.
CREATE INDEX IF NOT EXISTS idx_sites_active_project
    ON sites (project_id)
    WHERE is_active;

-- Incident counts filter by category over a date range.
CREATE INDEX IF NOT EXISTS idx_incidents_category ON incidents (category);

COMMIT;
