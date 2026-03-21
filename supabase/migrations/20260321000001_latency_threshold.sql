-- Add latency threshold alerting columns to services table
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS latency_threshold_ms INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consecutive_slow_checks INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN services.latency_threshold_ms IS 'Alert when response_time exceeds this value (ms) for consecutive checks. NULL = disabled.';
COMMENT ON COLUMN services.consecutive_slow_checks IS 'Counter of consecutive checks that exceeded latency_threshold_ms.';
