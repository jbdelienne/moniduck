-- Fresh start: wipe corrupted ping history and reset computed fields.
-- The app is pre-production so historical check data is unreliable.

-- 1. Wipe corrupt ping history (saas_checks had bad logic → wrong uptime%)
TRUNCATE TABLE saas_checks;

-- 2. Wipe service incidents & alerts (pre-prod noise, not real incidents)
TRUNCATE TABLE incidents CASCADE;
TRUNCATE TABLE alerts CASCADE;

-- 3. Reset computed fields on saas_providers.
--    Keep: name, url, icon, status_page_url, sla_promised_default, incidents[]
--    (incidents[] comes from their Atlassian API — this is reliable)
--    Reset: uptime_percentage (was calculated from corrupt pings)
UPDATE saas_providers SET
  status               = 'unknown',
  ping_status          = 'unknown',
  status_page_status   = 'unknown',
  uptime_percentage    = 100,
  uptime_from_ping     = 100,
  consecutive_ping_failures = 0,
  avg_response_time    = 0,
  last_check           = NULL;
-- Note: incidents[] and uptime_from_statuspage are intentionally kept —
-- they come from the status page API and are the only reliable data we have.

-- 4. Drop dependency_status (consolidated into saas_providers)
DROP TABLE IF EXISTS dependency_status;

-- 5. Add new columns (idempotent)
ALTER TABLE saas_providers
  ADD COLUMN IF NOT EXISTS ping_status               text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS uptime_from_ping          float8 NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS uptime_from_statuspage    float8 NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS consecutive_ping_failures int NOT NULL DEFAULT 0;
