
-- Add new columns to services
ALTER TABLE public.services 
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alert_notify_down boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_notify_up boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_email text;

-- Create incidents table
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id),
  status_code text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  duration_minutes integer,
  alert_sent_at timestamptz,
  resolution_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- RLS policies for incidents
CREATE POLICY "Workspace members can view incidents"
  ON public.incidents FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can insert incidents"
  ON public.incidents FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can update incidents"
  ON public.incidents FOR UPDATE
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can delete incidents"
  ON public.incidents FOR DELETE
  USING (is_workspace_admin(auth.uid(), workspace_id));

-- Enable realtime for incidents
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
