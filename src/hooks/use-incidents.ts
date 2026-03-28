import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCloudRegionStatuses } from '@/hooks/use-cloud-region-statuses';
import { useCloudRegionFavorites } from '@/hooks/use-cloud-regions';
import { useSaasDependencies, SaasIncident } from '@/hooks/use-saas-dependencies';
import { useMemo } from 'react';

export type IncidentSource = 'service' | 'alert' | 'cloud';
export type IncidentSeverity = 'critical' | 'warning' | 'info';
export type IncidentStatus = 'ongoing' | 'resolved';
export type SortKey = 'newest' | 'oldest' | 'severity' | 'ongoing_first';

export interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: IncidentSource;
  startedAt: string;
  resolvedAt: string | null;
  durationMinutes: number | null;
  // service-specific
  serviceName?: string;
  serviceUrl?: string;
  serviceIcon?: string;
  statusCode?: string | null;
  // alert-specific
  alertType?: string;
  integrationIcon?: string;
  hasCorrelation?: boolean;
  // cloud-specific
  provider?: string;
  regionCode?: string;
  affectedServices?: string[] | null;
}

const SEVERITY_ORDER: Record<IncidentSeverity, number> = { critical: 0, warning: 1, info: 2 };

function severityFromStatusCode(code: string | null | undefined): IncidentSeverity {
  if (!code) return 'critical';
  if (code.startsWith('5')) return 'critical';
  if (code.startsWith('4')) return 'warning';
  return 'info';
}

/** Compute monthly uptime from the incidents array already stored in saas_providers */
function uptimeFromIncidents(incidents: SaasIncident[]): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const minutesInMonth = (now.getTime() - monthStart.getTime()) / 60000;
  if (minutesInMonth <= 0) return 100;

  let downtimeMinutes = 0;
  for (const inc of incidents) {
    if (new Date(inc.date) >= monthStart) downtimeMinutes += inc.duration_minutes;
  }
  return ((minutesInMonth - downtimeMinutes) / minutesInMonth) * 100;
}

function normalizeSeverity(raw: string | null | undefined): IncidentSeverity {
  if (raw === 'critical') return 'critical';
  if (raw === 'warning') return 'warning';
  return 'info';
}

// ── Sub-hooks ─────────────────────────────────────────────────────────────────

function useServiceIncidents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['incidents-table', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*, services(name, url, icon)')
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}

function useStandaloneAlerts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['alerts-standalone', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .or('incident_id.is.null,alert_type.eq.sla_breach')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? []).filter(a => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useIncidents() {
  const { data: serviceIncidents = [], isLoading: incLoading }  = useServiceIncidents();
  const { data: standaloneAlerts = [], isLoading: alertsLoading } = useStandaloneAlerts();
  const { statuses, isLoading: statusesLoading }                = useCloudRegionStatuses();
  const { favorites }                                           = useCloudRegionFavorites();
  const { data: saasDeps = [], isLoading: saasLoading }         = useSaasDependencies();

  const favSet = useMemo(
    () => new Set(favorites.map(f => `${f.provider}:${f.region_code}`)),
    [favorites],
  );

  const incidents = useMemo<Incident[]>(() => {
    const seen = new Set<string>();
    const result: Incident[] = [];
    const push = (inc: Incident) => {
      if (!seen.has(inc.id)) { seen.add(inc.id); result.push(inc); }
    };

    // ── 1. Service downtime (incidents table) ─────────────────────────────
    for (const inc of serviceIncidents) {
      const svc = (inc as any).services as { name: string; url: string; icon: string } | null;
      push({
        id: `inc-${inc.id}`,
        title: svc ? `Outage: ${svc.name}` : 'Service outage',
        description: inc.error_message ?? null,
        severity: severityFromStatusCode(inc.status_code),
        status: inc.resolved_at ? 'resolved' : 'ongoing',
        source: 'service',
        startedAt: inc.started_at,
        resolvedAt: inc.resolved_at ?? null,
        durationMinutes: inc.duration_minutes ?? null,
        serviceName: svc?.name,
        serviceUrl: svc?.url,
        serviceIcon: svc?.icon,
        statusCode: inc.status_code,
      });
    }

    // ── 2. Standalone alerts (SaaS / non-service) ─────────────────────────
    for (const a of standaloneAlerts) {
      const meta = a.metadata as Record<string, any> | null;
      const isResolved = !!a.resolved_at || a.is_dismissed;
      push({
        id: `alert-${a.id}`,
        title: a.title,
        description: a.description ?? null,
        severity: normalizeSeverity(a.severity),
        status: isResolved ? 'resolved' : 'ongoing',
        source: 'alert',
        startedAt: a.created_at,
        resolvedAt: a.resolved_at ?? null,
        durationMinutes: meta?.downtime_minutes ?? (
          !isResolved ? Math.round((Date.now() - new Date(a.created_at).getTime()) / 60000) : null
        ),
        alertType: a.alert_type,
        hasCorrelation: meta?.correlated === true,
      });
    }

    // ── 3. SaaS: current status + SLA breach (from saas_providers) ────────
    for (const dep of saasDeps) {
      // Primary SLA source: their status page incidents (reliable — from Atlassian API).
      // Computed from incidents[] already stored in saas_providers, no migration needed.
      const uptimeStatusPage = dep.uptime_from_statuspage
        ?? (dep.incidents?.length ? uptimeFromIncidents(dep.incidents) : null);

      // Secondary: our pings — only trust if we have enough clean checks (≥ 10).
      // uptime_percentage resets to 100 after data cleanup, so ignore it until
      // enough fresh pings have accumulated.
      const pingChecksAvailable = (dep as any).ping_checks_count ?? null;
      const uptimePing = (pingChecksAvailable == null || pingChecksAvailable >= 10)
        ? (dep.uptime_from_ping ?? dep.uptime_percentage ?? null)
        : null;

      // SLA breach: use worst available source. If only one source available, use it.
      const availableUptimes = [uptimeStatusPage, uptimePing].filter((v): v is number => v != null);
      const worstUptime = availableUptimes.length ? Math.min(...availableUptimes) : null;

      const slaPromised = dep.sla_promised ?? dep.sla_promised_default ?? 99.9;
      const isSlaBreach = worstUptime != null && worstUptime < slaPromised;

      // Current incident = status is not operational (merged ping + status page)
      const hasActiveIncident = dep.status && !['operational', 'unknown'].includes(dep.status);

      if (isSlaBreach || hasActiveIncident) {
        const gap = slaPromised - worstUptime;
        const severity: IncidentSeverity = gap > 1 ? 'critical' : 'warning';

        let description = '';
        if (isSlaBreach && worstUptime != null) {
          const parts: string[] = [`Uptime ${worstUptime.toFixed(2)}% — SLA promised ${slaPromised}%`];
          if (uptimeStatusPage != null) parts.push(`Status page: ${uptimeStatusPage.toFixed(2)}%`);
          if (uptimePing != null)       parts.push(`Our pings: ${uptimePing.toFixed(2)}%`);
          description = parts.join(' · ');
        } else {
          description = dep.status === 'unconfirmed_outage'
            ? 'Our pings are failing but their status page reports operational'
            : `Current status: ${dep.status}`;
        }

        push({
          id: `saas-active-${dep.id}`,
          title: isSlaBreach ? `SLA breach: ${dep.name}` : `Incident: ${dep.name}`,
          description,
          severity,
          status: 'ongoing',
          source: 'alert',
          startedAt: dep.last_check ?? dep.created_at,
          resolvedAt: null,
          durationMinutes: null,
          integrationIcon: dep.icon,
          alertType: 'sla_breach',
        });
      }

      // Historical SaaS incidents (from their status page, last 30 days)
      for (const inc of dep.incidents ?? []) {
        push({
          id: `saas-inc-${dep.id}-${inc.date}`,
          title: inc.title,
          description: `${dep.name} — reported ${inc.severity} incident`,
          severity: inc.severity === 'critical' ? 'critical' : inc.severity === 'major' ? 'warning' : 'info',
          status: 'resolved',
          source: 'alert',
          startedAt: inc.date,
          resolvedAt: inc.date,
          durationMinutes: inc.duration_minutes ?? null,
          integrationIcon: dep.icon,
          alertType: 'saas_incident',
        });
      }
    }

    // ── 4. Cloud region incidents (favorited regions only) ─────────────────
    for (const [key, status] of statuses.entries()) {
      if (!favSet.has(key)) continue;
      if (status.status !== 'degraded' && status.status !== 'outage') continue;
      if (!status.incident_title) continue;

      push({
        id: `cloud-${key}`,
        title: status.incident_title,
        description: status.incident_description ?? null,
        severity: status.status === 'outage' ? 'critical' : 'warning',
        status: 'ongoing',
        source: 'cloud',
        startedAt: status.last_incident_at ?? status.updated_at,
        resolvedAt: null,
        durationMinutes: status.last_incident_at
          ? Math.round((Date.now() - new Date(status.last_incident_at).getTime()) / 60000)
          : null,
        provider: status.provider,
        regionCode: status.region_code,
        affectedServices: status.affected_services,
      });
    }

    return result;
  }, [serviceIncidents, standaloneAlerts, statuses, favSet, saasDeps]);

  return {
    incidents,
    isLoading: incLoading || alertsLoading || statusesLoading || saasLoading,
  };
}

// Ongoing always first, then apply the chosen sort key within each group
export function sortIncidents(incidents: Incident[], key: SortKey): Incident[] {
  return [...incidents].sort((a, b) => {
    const ongoingDiff = (a.status === 'ongoing' ? 0 : 1) - (b.status === 'ongoing' ? 0 : 1);
    if (ongoingDiff !== 0) return ongoingDiff;

    switch (key) {
      case 'oldest':
        return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
      case 'severity': {
        const diff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        return diff !== 0 ? diff : new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      }
      default:
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    }
  });
}
