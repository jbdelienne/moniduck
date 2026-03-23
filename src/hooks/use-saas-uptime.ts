import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SaasUptimePeriod = '24h' | '7d' | '30d' | '12m';

const periodToMs: Record<SaasUptimePeriod, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '12m': 365 * 24 * 60 * 60 * 1000,
};

export const periodLabels: Record<SaasUptimePeriod, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
  '12m': '12 months',
};

export function useSaasUptime(providerIds: string[], period: SaasUptimePeriod) {
  const { user } = useAuth();
  const since = new Date(Date.now() - periodToMs[period]).toISOString();

  return useQuery({
    queryKey: ['saas_uptime', providerIds.sort().join(','), period],
    queryFn: async () => {
      if (providerIds.length === 0) return {} as Record<string, number>;

      // Fetch all checks for the period for all providers
      // For 12m we might have a lot of data, so we batch if needed
      const results: Record<string, number> = {};

      for (const pid of providerIds) {
        let allChecks: { status: string }[] = [];
        let offset = 0;
        const batchSize = 1000;

        // Paginate to get all checks within the period
        while (true) {
          const { data, error } = await supabase
            .from('saas_checks')
            .select('status')
            .eq('saas_provider_id', pid)
            .gte('checked_at', since)
            .order('checked_at', { ascending: false })
            .range(offset, offset + batchSize - 1);

          if (error) throw error;
          if (!data || data.length === 0) break;

          allChecks = allChecks.concat(data);
          if (data.length < batchSize) break;
          offset += batchSize;
        }

        if (allChecks.length === 0) {
          results[pid] = 100;
        } else {
          const upCount = allChecks.filter(c => c.status === 'operational').length;
          results[pid] = Math.round((upCount / allChecks.length) * 10000) / 100;
        }
      }

      return results;
    },
    enabled: !!user && providerIds.length > 0,
    staleTime: 60_000, // 1 minute cache
  });
}
