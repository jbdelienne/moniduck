import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SaasCheck {
  id: string;
  saas_provider_id: string;
  response_time: number;
  status: string;
  status_code: number | null;
  error_message: string | null;
  checked_at: string;
}

export function useSaasChecks(providerId: string | undefined, limit = 50) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['saas_checks', providerId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saas_checks')
        .select('*')
        .eq('saas_provider_id', providerId!)
        .order('checked_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as unknown as SaasCheck[]) ?? [];
    },
    enabled: !!user && !!providerId,
  });
}
