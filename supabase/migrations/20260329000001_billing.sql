-- Billing & Subscriptions

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stripe_subscription_id text        UNIQUE,
  stripe_customer_id     text,
  plan_id                text        NOT NULL DEFAULT 'free',
  billing_cycle          text        NOT NULL DEFAULT 'monthly',
  status                 text        NOT NULL DEFAULT 'active',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean     DEFAULT false,
  trial_end              timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Workspace members can read their subscription
CREATE POLICY "workspace members can view subscription"
  ON public.subscriptions FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Only service_role (webhooks) can write
CREATE POLICY "service role manages subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
