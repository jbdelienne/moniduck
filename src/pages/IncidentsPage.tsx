import { useState, useMemo } from 'react';
import { useAlerts, Alert } from '@/hooks/use-supabase';
import { useSaasDependencies } from '@/hooks/use-saas-dependencies';
import { Loader2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

type FilterTab = 'all' | 'saas' | 'services' | 'correlated';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function IncidentsPage() {
  const { data: alerts = [], isLoading } = useAlerts();
  const { data: dependencies = [] } = useSaasDependencies();
  const [filter, setFilter] = useState<FilterTab>('all');

  // Build unified incidents list from alerts
  const incidents = useMemo(() => {
    return alerts
      .filter(a => a.alert_type === 'downtime' || a.alert_type === 'sla_breach' || a.alert_type === 'degraded')
      .map(a => {
        const meta = a.metadata as Record<string, any> | null;
        const isResolved = !!a.resolved_at || a.is_dismissed;
        const isSaas = !!a.integration_type && a.integration_type !== 'http';
        const duration = meta?.downtime_minutes
          ? meta.downtime_minutes
          : !isResolved
            ? Math.round((Date.now() - new Date(a.created_at).getTime()) / 60000)
            : 0;

        return {
          ...a,
          isSaas,
          isResolved,
          duration,
          hasCorrelation: meta?.correlated === true,
        };
      });
  }, [alerts]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'saas': return incidents.filter(i => i.isSaas);
      case 'services': return incidents.filter(i => !i.isSaas);
      case 'correlated': return incidents.filter(i => i.hasCorrelation);
      default: return incidents;
    }
  }, [incidents, filter]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'saas', label: 'SaaS' },
    { key: 'services', label: 'Services' },
    { key: 'correlated', label: 'Correlated' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Incidents</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Timeline unifiée des incidents SaaS et services</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-success" />
          <p className="font-medium text-foreground">Aucun incident</p>
          <p className="text-sm text-muted-foreground mt-1">Tout fonctionne normalement</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(incident => {
            const meta = incident.metadata as Record<string, any> | null;

            return (
              <div
                key={incident.id}
                className={`bg-card border rounded-xl p-4 ${
                  !incident.isResolved ? 'border-destructive/30 ring-1 ring-destructive/10' : 'border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    incident.severity === 'critical'
                      ? 'bg-destructive/10'
                      : incident.severity === 'warning'
                        ? 'bg-warning/10'
                        : 'bg-muted'
                  }`}>
                    {incident.isSaas ? (
                      <span className="text-lg">
                        {dependencies.find(d => d.name.toLowerCase() === incident.integration_type?.toLowerCase())?.icon || '📦'}
                      </span>
                    ) : (
                      <AlertTriangle className={`w-4 h-4 ${
                        incident.severity === 'critical' ? 'text-destructive' : 'text-warning'
                      }`} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-foreground">{incident.title}</h3>
                      {!incident.isResolved && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-destructive text-destructive-foreground animate-pulse">
                          En cours
                        </span>
                      )}
                      {incident.isResolved && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-success/10 text-success">
                          Résolu
                        </span>
                      )}
                      {incident.hasCorrelation && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-info/10 text-info">
                          Corrélation détectée
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        incident.isSaas ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {incident.isSaas ? 'SaaS' : 'Service'}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">{incident.description}</p>

                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
                      </span>
                      {incident.duration > 0 && (
                        <span>Durée : {formatDuration(incident.duration)}</span>
                      )}
                    </div>
                  </div>

                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                    incident.severity === 'critical'
                      ? 'bg-destructive/10 text-destructive'
                      : incident.severity === 'warning'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-info/10 text-info'
                  }`}>
                    {incident.severity}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
