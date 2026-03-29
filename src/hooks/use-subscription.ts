import { useQuery } from '@tanstack/react-query'
import { useWorkspace } from './use-workspace'
import { supabase } from '@/integrations/supabase/client'
import { PLAN_LIMITS, type PlanId, type PlanLimits } from '@/lib/plans'

export interface Subscription {
  id: string
  workspace_id: string
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  plan_id: PlanId
  billing_cycle: 'monthly' | 'annual'
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  trial_end: string | null
}

export function useSubscription() {
  const { data: workspace } = useWorkspace()

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return null
      const { data, error } = await supabase
        .from('subscriptions' as any)
        .select('*')
        .eq('workspace_id', workspace.id)
        .maybeSingle()
      if (error) throw error
      return data as unknown as Subscription | null
    },
    enabled: !!workspace?.id,
  })

  const isActive =
    subscription?.status === 'active' || subscription?.status === 'trialing'

  const planId: PlanId = isActive
    ? ((subscription?.plan_id as PlanId) ?? 'free')
    : 'free'

  const limits: PlanLimits = PLAN_LIMITS[planId]

  return {
    subscription,
    planId,
    limits,
    isLoading,
    isActive,
    isPaid: planId !== 'free',
  }
}
