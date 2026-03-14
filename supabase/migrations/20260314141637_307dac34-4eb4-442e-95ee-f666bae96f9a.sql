
ALTER TABLE public.saved_reports
  ADD COLUMN report_type text NOT NULL DEFAULT 'services',
  ADD COLUMN saas_provider_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];
