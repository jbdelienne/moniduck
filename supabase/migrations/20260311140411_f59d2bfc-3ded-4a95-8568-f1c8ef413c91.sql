
-- Drop the existing INSERT policy
DROP POLICY "Admins can insert members" ON public.workspace_members;

-- Create policy: only workspace admins can add members
CREATE POLICY "Admins can insert members"
ON public.workspace_members
FOR INSERT
TO public
WITH CHECK (
  is_workspace_admin(auth.uid(), workspace_id)
);

-- Create policy: users can insert themselves as 'member' role only (for invitation acceptance)
CREATE POLICY "Users can join as member via invitation"
ON public.workspace_members
FOR INSERT
TO public
WITH CHECK (
  user_id = auth.uid()
  AND role = 'member'
  AND EXISTS (
    SELECT 1 FROM public.workspace_invitations wi
    WHERE wi.workspace_id = workspace_members.workspace_id
      AND wi.invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND wi.status = 'pending'
  )
);
