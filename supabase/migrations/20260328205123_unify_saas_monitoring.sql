-- Unify SaaS monitoring: merge dependency_status into saas_providers, drop redundant table

-- 1. Add new columns to saas_providers
ALTER TABLE saas_providers
  ADD COLUMN IF NOT EXISTS ping_status          text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS uptime_from_ping     float8 NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS uptime_from_statuspage float8 NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS consecutive_ping_failures int NOT NULL DEFAULT 0;

-- 2. Backfill ping_status from existing status column (which was the ping result)
UPDATE saas_providers SET ping_status = status WHERE ping_status = 'unknown';

-- 3. Backfill uptime_from_ping from existing uptime_percentage
UPDATE saas_providers SET uptime_from_ping = uptime_percentage WHERE uptime_from_ping = 100 AND uptime_percentage < 100;

-- 4. Drop dependency_status (data consolidated into saas_providers)
DROP TABLE IF EXISTS dependency_status;
