
CREATE TABLE public.cloud_region_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  region_code text NOT NULL,
  status text NOT NULL DEFAULT 'unknown',
  incident_title text,
  incident_description text,
  affected_services text[],
  uptime_30d numeric(5,2),
  last_incident_at timestamptz,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, region_code)
);

ALTER TABLE public.cloud_region_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cloud region status"
  ON public.cloud_region_status FOR SELECT
  TO authenticated
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.cloud_region_status;
