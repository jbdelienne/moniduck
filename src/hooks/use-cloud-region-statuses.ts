import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface RegionStatus {
  provider: string;
  region_code: string;
  status: 'operational' | 'degraded' | 'outage' | 'unknown';
  incident_title: string | null;
  incident_description: string | null;
  affected_services: string[] | null;
  uptime_30d: number | null;
  last_incident_at: string | null;
  last_checked_at: string;
  updated_at: string;
}

export function useCloudRegionStatuses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cloud-region-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cloud_region_status')
        .select('*');
      if (error) throw error;

      const map = new Map<string, RegionStatus>();
      for (const row of data ?? []) {
        map.set(`${row.provider}:${row.region_code}`, row as RegionStatus);
      }
      return map;
    },
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 2 * 60 * 1000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('cloud-region-status-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cloud_region_status' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cloud-region-statuses'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return {
    statuses: query.data ?? new Map<string, RegionStatus>(),
    isLoading: query.isLoading,
  };
}
