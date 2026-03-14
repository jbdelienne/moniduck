
CREATE TABLE public.cloud_region_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL,
  region_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, region_code)
);

ALTER TABLE public.cloud_region_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view favorites"
  ON public.cloud_region_favorites FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can insert favorites"
  ON public.cloud_region_favorites FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can delete favorites"
  ON public.cloud_region_favorites FOR DELETE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
