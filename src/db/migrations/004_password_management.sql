-- SiteLog migration 004
-- Letting people change their own password, safely.

BEGIN;

-- When the password last changed. Any session token issued before this
-- moment is refused, so replacing a password that was shared over WhatsApp
-- actually ends the sessions it opened.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Set on accounts an administrator created. Someone other than the owner
-- knows that password, so it must be replaced before the account is used.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
