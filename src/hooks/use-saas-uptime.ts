import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  subDays, subYears, subHours, subMonths,
  startOfDay, endOfDay, startOfMonth, endOfMonth,
  format,
} from 'date-fns';

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

export type UptimeChartPoint = { label: string; uptime: number | null };

export function useSaasUptimeChart(providerId: string | undefined, period: SaasUptimePeriod) {
  const { user } = useAuth();
  const start = getPeriodStart(period);

  return useQuery({
    queryKey: ['saas-uptime-chart', providerId, period],
    queryFn: async () => {
      const allChecks: { status: string; checked_at: string }[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('saas_checks')
          .select('status, checked_at')
          .eq('saas_provider_id', providerId)
          .gte('checked_at', start.toISOString())
          .order('checked_at', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        allChecks.push(...(data || []));
        hasMore = (data?.length ?? 0) === pageSize;
        from += pageSize;
      }

      const now = new Date();
      const buckets: { label: string; start: Date; end: Date }[] = [];

      if (period === '24h') {
        for (let i = 23; i >= 0; i--) {
          const s = subHours(now, i + 1);
          const e = subHours(now, i);
          buckets.push({ label: format(e, 'HH:00'), start: s, end: e });
        }
      } else if (period === '7d') {
        for (let i = 6; i >= 0; i--) {
          const d = subDays(now, i);
          buckets.push({ label: format(d, 'EEE'), start: startOfDay(d), end: endOfDay(d) });
        }
      } else if (period === '30d') {
        for (let i = 29; i >= 0; i--) {
          const d = subDays(now, i);
          buckets.push({ label: format(d, 'MMM d'), start: startOfDay(d), end: endOfDay(d) });
        }
      } else {
        for (let i = 11; i >= 0; i--) {
          const d = subMonths(now, i);
          buckets.push({ label: format(d, 'MMM yyyy'), start: startOfMonth(d), end: endOfMonth(d) });
        }
      }

      return buckets.map<UptimeChartPoint>(bucket => {
        const inBucket = allChecks.filter(c => {
          const t = new Date(c.checked_at).getTime();
          return t >= bucket.start.getTime() && t < bucket.end.getTime();
        });
        if (inBucket.length === 0) return { label: bucket.label, uptime: null };
        const up = inBucket.filter(c => c.status === 'operational').length;
        return { label: bucket.label, uptime: Math.round((up / inBucket.length) * 10000) / 100 };
      });
    },
    enabled: !!user && !!providerId,
  });
}
