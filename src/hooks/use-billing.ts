import { useMutation } from '@tanstack/react-query'
import { useWorkspace } from './use-workspace'
import { supabase } from '@/integrations/supabase/client'
import type { PlanId } from '@/lib/plans'

export function useBilling() {
  const { data: workspace } = useWorkspace()

  const checkout = useMutation({
    mutationFn: async ({
      plan_id,
      billing_cycle,
    }: {
      plan_id: Exclude<PlanId, 'free'>
      billing_cycle: 'monthly' | 'annual'
    }) => {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          plan_id,
          billing_cycle,
          workspace_id: workspace?.id,
        },
      })
      if (error) throw error
      return data as { url: string }
    },
    onSuccess: ({ url }) => {
      window.location.href = url
    },
  })

  const openPortal = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { workspace_id: workspace?.id },
      })
      if (error) throw error
      return data as { url: string }
    },
    onSuccess: ({ url }) => {
      window.location.href = url
    },
  })

  return { checkout, openPortal }
}
