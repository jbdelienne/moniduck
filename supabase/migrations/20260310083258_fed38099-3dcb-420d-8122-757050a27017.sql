
-- Fix permissive INSERT policy on saas_providers to require added_by = auth.uid()
DROP POLICY "Authenticated users can insert saas_providers" ON public.saas_providers;
CREATE POLICY "Authenticated users can insert saas_providers"
  ON public.saas_providers FOR INSERT
  TO authenticated
  WITH CHECK (added_by = auth.uid());
