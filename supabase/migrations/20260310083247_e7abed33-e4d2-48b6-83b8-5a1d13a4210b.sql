
-- ============================================
-- 1. SAAS_PROVIDERS — shared global table
-- ============================================
CREATE TABLE public.saas_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  status_page_url text,
  icon text NOT NULL DEFAULT '📦',
  sla_promised_default numeric NOT NULL DEFAULT 99.9,
  status text NOT NULL DEFAULT 'unknown',
  status_page_status text DEFAULT 'unknown',
  avg_response_time integer DEFAULT 0,
  uptime_percentage numeric DEFAULT 100,
  last_check timestamp with time zone,
  incidents jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  added_by uuid NOT NULL,
  UNIQUE(url)
);

ALTER TABLE public.saas_providers ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "Authenticated users can view saas_providers"
  ON public.saas_providers FOR SELECT
  TO authenticated
  USING (true);

-- Anyone authenticated can insert
CREATE POLICY "Authenticated users can insert saas_providers"
  ON public.saas_providers FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No user delete (admin only via service_role)
-- No user update (edge function uses service_role)

-- ============================================
-- 2. SAAS_CHECKS — shared ping results
-- ============================================
CREATE TABLE public.saas_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saas_provider_id uuid NOT NULL REFERENCES public.saas_providers(id) ON DELETE CASCADE,
  response_time integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  status_code integer,
  checked_at timestamp with time zone NOT NULL DEFAULT now(),
  error_message text
);

ALTER TABLE public.saas_checks ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read checks
CREATE POLICY "Authenticated users can view saas_checks"
  ON public.saas_checks FOR SELECT
  TO authenticated
  USING (true);

-- Only service_role inserts checks (via edge function), no user policy needed

-- ============================================
-- 3. USER_SAAS_SUBSCRIPTIONS — per-workspace
-- ============================================
CREATE TABLE public.user_saas_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  saas_provider_id uuid NOT NULL REFERENCES public.saas_providers(id) ON DELETE CASCADE,
  sla_promised_override numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, saas_provider_id)
);

ALTER TABLE public.user_saas_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view subscriptions"
  ON public.user_saas_subscriptions FOR SELECT
  TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can insert subscriptions"
  ON public.user_saas_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can delete subscriptions"
  ON public.user_saas_subscriptions FOR DELETE
  TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can update subscriptions"
  ON public.user_saas_subscriptions FOR UPDATE
  TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
