import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSaasDependencies } from './use-saas-dependencies';

export interface CorrelatedEvent {
  id: string;
  httpIncident: {
    id: string;
    serviceName: string;
    serviceIcon: string;
    serviceId: string;
    startedAt: Date;
    resolvedAt: Date | null;
    durationMinutes: number | null;
    errorMessage: string | null;
  };
  saasIncident: {
    providerName: string;
    providerIcon: string;
    title: string;
    date: Date;
    durationMinutes: number;
    severity: 'minor' | 'major' | 'critical';
  };
  /** Minutes the SaaS went down BEFORE the HTTP incident. Negative = after. */
  leadTimeMinutes: number;
  confidence: 'high' | 'medium' | 'low';
}

// SaaS issue started up to 15min before HTTP incident → likely cause
const WINDOW_BEFORE = 15;
// SaaS issue started up to 5min after → concurrent / coincident
const WINDOW_AFTER = 5;

function parseDate(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getConfidence(leadMinutes: number): 'high' | 'medium' | 'low' {
  const abs = Math.abs(leadMinutes);
  if (abs <= 3) return 'high';
  if (abs <= 8) return 'medium';
  return 'low';
}

export function useCorrelation() {
  const { user } = useAuth();

  const { data: rawIncidents = [], isLoading: incLoading } = useQuery({
    queryKey: ['incidents_for_correlation', user?.id],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data, error } = await supabase
        .from('incidents')
        .select('id, service_id, started_at, resolved_at, duration_minutes, error_message')
        .gte('started_at', since.toISOString())
        .order('started_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: 120000,
  });

  const { data: services = [], isLoading: svcLoading } = useQuery({
    queryKey: ['services_for_correlation', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, icon');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: saasProviders = [], isLoading: saasLoading } = useSaasDependencies();

  const correlations = useMemo((): CorrelatedEvent[] => {
    if (!rawIncidents.length || !saasProviders.length) return [];

    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const results: CorrelatedEvent[] = [];

    for (const incident of rawIncidents) {
      const httpStart = parseDate(incident.started_at);
      if (!httpStart) continue;

      const svc = serviceMap.get(incident.service_id);

      for (const provider of saasProviders) {
        if (!provider.incidents?.length) continue;

        for (const saasInc of provider.incidents) {
          const saasDate = parseDate(saasInc.date);
          if (!saasDate) continue;

          const leadMinutes = (httpStart.getTime() - saasDate.getTime()) / 60000;

          if (leadMinutes >= -WINDOW_AFTER && leadMinutes <= WINDOW_BEFORE) {
            const key = `${incident.id}-${provider.id}-${saasInc.date}-${saasInc.title}`;
            if (results.some((r) => r.id === key)) continue;

            results.push({
              id: key,
              httpIncident: {
                id: incident.id,
                serviceName: svc?.name ?? 'Unknown service',
                serviceIcon: svc?.icon ?? '🌐',
                serviceId: incident.service_id,
                startedAt: httpStart,
                resolvedAt: incident.resolved_at ? parseDate(incident.resolved_at) : null,
                durationMinutes: incident.duration_minutes,
                errorMessage: incident.error_message,
              },
              saasIncident: {
                providerName: provider.name,
                providerIcon: provider.icon,
                title: saasInc.title,
                date: saasDate,
                durationMinutes: saasInc.duration_minutes,
                severity: saasInc.severity,
              },
              leadTimeMinutes: Math.round(leadMinutes),
              confidence: getConfidence(leadMinutes),
            });
          }
        }
      }
    }

    return results.sort(
      (a, b) => b.httpIncident.startedAt.getTime() - a.httpIncident.startedAt.getTime(),
    );
  }, [rawIncidents, services, saasProviders]);

  return {
    correlations,
    isLoading: incLoading || svcLoading || saasLoading,
  };
}
