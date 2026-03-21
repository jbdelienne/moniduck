-- ============================================================
-- MOCK DATA: Latency threshold alerting demo
-- ============================================================
-- This migration creates a demo service with:
--   • 40 checks simulating a gradual latency spike
--   • A latency_threshold_ms of 2000ms
--   • A pre-existing unresolved latency alert
--
-- To use: run this after 20260321000001_latency_threshold.sql
-- The demo service belongs to the first user found in auth.users.
-- ============================================================

DO $$
DECLARE
  v_user_id   UUID;
  v_workspace UUID;
  v_service   UUID;
  i           INT;
  v_rt        INT;
  v_checked   TIMESTAMPTZ;
BEGIN
  -- Grab the first real user
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user found — skipping mock data insert';
    RETURN;
  END IF;

  -- Grab their workspace (if any)
  SELECT id INTO v_workspace FROM workspaces
    WHERE id IN (SELECT workspace_id FROM profiles WHERE id = v_user_id)
    LIMIT 1;

  -- Create the demo service
  INSERT INTO services (
    user_id, workspace_id, name, url, icon,
    status, check_interval, visibility,
    latency_threshold_ms, consecutive_slow_checks,
    avg_response_time, uptime_percentage,
    last_check, alert_checks_threshold
  ) VALUES (
    v_user_id, v_workspace,
    '🐢 Slow API (demo)', 'https://httpbin.org/delay/2', '🐢',
    'up', 2, 'public',
    2000, 3,
    2400, 100,
    NOW(), 2
  )
  RETURNING id INTO v_service;

  -- Insert 40 fake checks: first 20 normal, last 20 slow
  FOR i IN 1..40 LOOP
    v_checked := NOW() - ((41 - i) * INTERVAL '2 minutes');

    IF i <= 20 THEN
      -- Normal range: 300–900ms
      v_rt := 300 + (random() * 600)::INT;
    ELSE
      -- Slow range: 2100–3500ms (above threshold)
      v_rt := 2100 + (random() * 1400)::INT;
    END IF;

    INSERT INTO checks (service_id, user_id, status, response_time, status_code, checked_at)
    VALUES (v_service, v_user_id, 'up', v_rt, 200, v_checked);
  END LOOP;

  -- Create an open latency alert matching the current slow state
  INSERT INTO alerts (
    user_id, workspace_id, service_id,
    alert_type, severity, title, description,
    integration_type, metadata, is_read, is_dismissed
  ) VALUES (
    v_user_id, v_workspace, v_service,
    'latency', 'warning',
    '🐢 Slow API (demo): High response time',
    'Response time 2847ms exceeds threshold of 2000ms for 3 consecutive checks',
    'service',
    jsonb_build_object(
      'service_id',     v_service,
      'url',            'https://httpbin.org/delay/2',
      'response_time_ms', 2847,
      'threshold_ms',   2000,
      'slow_since',     NOW() - INTERVAL '6 minutes'
    ),
    false, false
  );

  RAISE NOTICE 'Mock latency demo data inserted for service %', v_service;
END $$;
