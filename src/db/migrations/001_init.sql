-- SiteLog initial schema
-- Tihama Limited — daily site reporting system
-- Migration 001

BEGIN;

-- ---------------------------------------------------------------- users ----
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    full_name       TEXT        NOT NULL,
    email           TEXT        NOT NULL UNIQUE,
    password_hash   TEXT        NOT NULL,
    role            TEXT        NOT NULL
                    CHECK (role IN ('site_supervisor', 'project_manager', 'administrator')),
    phone           TEXT,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);

-- ------------------------------------------------------------- projects ----
CREATE TABLE IF NOT EXISTS projects (
    id                BIGSERIAL PRIMARY KEY,
    code              TEXT        NOT NULL UNIQUE,
    name              TEXT        NOT NULL,
    client            TEXT,
    start_date        DATE,
    planned_end_date  DATE,
    status            TEXT        NOT NULL DEFAULT 'active'
                      CHECK (status IN ('planned', 'active', 'on_hold', 'completed')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);

-- ---------------------------------------------------------------- sites ----
CREATE TABLE IF NOT EXISTS sites (
    id          BIGSERIAL PRIMARY KEY,
    project_id  BIGINT      NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    location    TEXT,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sites_project ON sites (project_id);

-- Which supervisor is responsible for which site.
CREATE TABLE IF NOT EXISTS site_assignments (
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    site_id     BIGINT NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_site ON site_assignments (site_id);

-- -------------------------------------------------------- daily reports ----
CREATE TABLE IF NOT EXISTS daily_reports (
    id             BIGSERIAL PRIMARY KEY,
    site_id        BIGINT      NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
    report_date    DATE        NOT NULL,
    submitted_by   BIGINT      NOT NULL REFERENCES users (id),
    weather        TEXT,
    progress_notes TEXT,
    delays_notes   TEXT,
    status         TEXT        NOT NULL DEFAULT 'submitted'
                   CHECK (status IN ('draft', 'submitted')),
    submitted_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- one report per site per day
    UNIQUE (site_id, report_date)
);

-- The dashboard's busiest query: reports for a date range, newest first.
CREATE INDEX IF NOT EXISTS idx_reports_date      ON daily_reports (report_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_site_date ON daily_reports (site_id, report_date DESC);

-- ------------------------------------------------------ report line items --
CREATE TABLE IF NOT EXISTS manpower_entries (
    id           BIGSERIAL PRIMARY KEY,
    report_id    BIGINT NOT NULL REFERENCES daily_reports (id) ON DELETE CASCADE,
    trade        TEXT   NOT NULL,
    headcount    INTEGER NOT NULL CHECK (headcount >= 0),
    hours_worked NUMERIC(5, 2) CHECK (hours_worked >= 0)
);

CREATE INDEX IF NOT EXISTS idx_manpower_report ON manpower_entries (report_id);

CREATE TABLE IF NOT EXISTS equipment_entries (
    id             BIGSERIAL PRIMARY KEY,
    report_id      BIGINT NOT NULL REFERENCES daily_reports (id) ON DELETE CASCADE,
    equipment_name TEXT   NOT NULL,
    hours_run      NUMERIC(5, 2) CHECK (hours_run >= 0),
    status         TEXT   NOT NULL DEFAULT 'operational'
                   CHECK (status IN ('operational', 'idle', 'breakdown'))
);

CREATE INDEX IF NOT EXISTS idx_equipment_report ON equipment_entries (report_id);

CREATE TABLE IF NOT EXISTS material_entries (
    id                BIGSERIAL PRIMARY KEY,
    report_id         BIGINT NOT NULL REFERENCES daily_reports (id) ON DELETE CASCADE,
    material_name     TEXT   NOT NULL,
    unit              TEXT,
    quantity_received NUMERIC(12, 2) CHECK (quantity_received >= 0),
    quantity_used     NUMERIC(12, 2) CHECK (quantity_used >= 0)
);

CREATE INDEX IF NOT EXISTS idx_materials_report ON material_entries (report_id);

CREATE TABLE IF NOT EXISTS incidents (
    id          BIGSERIAL PRIMARY KEY,
    report_id   BIGINT NOT NULL REFERENCES daily_reports (id) ON DELETE CASCADE,
    category    TEXT   NOT NULL
                CHECK (category IN ('safety', 'equipment', 'delay', 'security', 'other')),
    severity    TEXT   NOT NULL DEFAULT 'low'
                CHECK (severity IN ('low', 'medium', 'high')),
    description TEXT   NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_report ON incidents (report_id);

CREATE TABLE IF NOT EXISTS report_photos (
    id          BIGSERIAL PRIMARY KEY,
    report_id   BIGINT      NOT NULL REFERENCES daily_reports (id) ON DELETE CASCADE,
    file_path   TEXT        NOT NULL,
    caption     TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_report ON report_photos (report_id);

COMMIT;
