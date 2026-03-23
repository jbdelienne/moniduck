import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { subDays, subYears } from 'date-fns';

export type SaasUptimePeriod = '24h' | '7d' | '30d' | '12m';

function getPeriodStart(period: SaasUptimePeriod): Date {
  const now = new Date();
  switch (period) {
    case '24h': return subDays(now, 1);
    case '7d': return subDays(now, 7);
    case '30d': return subDays(now, 30);
    case '12m': return subYears(now, 1);
  }
}

export function useSaasUptimeByPeriod(providerIds: string[], period: SaasUptimePeriod) {
  const { user } = useAuth();
  const start = getPeriodStart(period);

  return useQuery({
    queryKey: ['saas-uptime', providerIds, period],
    queryFn: async () => {
      if (providerIds.length === 0) return {};

      const allChecks: { saas_provider_id: string; status: string }[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('saas_checks')
          .select('saas_provider_id, status')
          .in('saas_provider_id', providerIds)
          .gte('checked_at', start.toISOString())
          .order('checked_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        allChecks.push(...(data || []));
        hasMore = (data?.length ?? 0) === pageSize;
        from += pageSize;
      }

      const result: Record<string, number> = {};
      const counts: Record<string, { total: number; up: number }> = {};

      for (const check of allChecks) {
        if (!counts[check.saas_provider_id]) counts[check.saas_provider_id] = { total: 0, up: 0 };
        counts[check.saas_provider_id].total++;
        if (check.status === 'operational') counts[check.saas_provider_id].up++;
      }

      for (const id of providerIds) {
        const c = counts[id];
        result[id] = c ? Math.round((c.up / c.total) * 10000) / 100 : 100;
      }

      return result;
    },
    enabled: !!user && providerIds.length > 0,
  });
}
