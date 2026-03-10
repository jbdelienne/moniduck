CREATE OR REPLACE FUNCTION public.accept_pending_invitation(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pending_invite RECORD;
  user_email text;
  result jsonb := '{"accepted": false}'::jsonb;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = _user_id;
  IF user_email IS NULL THEN RETURN result; END IF;

  -- Find pending invitation for this email
  SELECT * INTO pending_invite
  FROM public.workspace_invitations
  WHERE invited_email = lower(user_email) AND status = 'pending' AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF pending_invite IS NULL THEN RETURN result; END IF;

  -- Check if already a member of that workspace
  IF EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = pending_invite.workspace_id) THEN
    -- Already a member, just mark invitation as accepted
    UPDATE public.workspace_invitations SET status = 'accepted' WHERE id = pending_invite.id;
    RETURN '{"accepted": true, "already_member": true}'::jsonb;
  END IF;

  -- Add user to the workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (pending_invite.workspace_id, _user_id, pending_invite.role);

  -- Update profile to point to new workspace
  UPDATE public.profiles SET workspace_id = pending_invite.workspace_id WHERE user_id = _user_id;

  -- Mark invitation as accepted
  UPDATE public.workspace_invitations SET status = 'accepted' WHERE id = pending_invite.id;

  RETURN jsonb_build_object('accepted', true, 'workspace_id', pending_invite.workspace_id, 'role', pending_invite.role);
END;
$$;