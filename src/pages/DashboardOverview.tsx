import { useServices } from '@/hooks/use-supabase';
import { useSaasDependencies, SaasProviderWithSubscription, SaasIncident } from '@/hooks/use-saas-dependencies';
import { useAlerts } from '@/hooks/use-supabase';
import { Loader2, CheckCircle, AlertTriangle, XCircle, Minus, Clock, Wifi, Plus, ChevronDown, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDashboards } from '@/hooks/use-dashboards';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

function getHealthScore(services: any[], dependencies: SaasProviderWithSubscription[]): number {
  const serviceScores = services
    .filter(s => s.status !== 'unknown')
    .map(s => s.status === 'up' ? 1 : s.status === 'degraded' ? 0.5 : 0);
  const depScores = dependencies
    .filter(d => d.status !== 'unknown')
    .map(d => d.status === 'operational' ? 1 : d.status === 'degraded' ? 0.5 : 0);
  const allItems = [...serviceScores, ...depScores];
  if (allItems.length === 0) return 100;
  return Math.round((allItems.reduce((a, b) => a + b, 0) / allItems.length) * 100);
}

function getHealthColor(score: number) {
  if (score >= 90) return 'text-success';
  if (score >= 70) return 'text-warning';
  return 'text-destructive';
}

function getHealthLabel(score: number) {
  if (score >= 95) return 'Your stack is healthy';
  if (score >= 80) return 'Some degradations detected';
  if (score >= 50) return 'Warning — multiple services impacted';
  return 'Critical situation';
}

const statusDotClass: Record<string, string> = {
  up: 'bg-success',
  operational: 'bg-success',
  degraded: 'bg-warning',
  down: 'bg-destructive',
  outage: 'bg-destructive',
  unknown: 'bg-muted-foreground',
};

const statusLabel: Record<string, string> = {
  up: 'Operational',
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
  outage: 'Outage',
  unknown: 'Unknown',
};

export default function DashboardOverview() {
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: dependencies = [], isLoading: depsLoading } = useSaasDependencies();
  const { data: alerts = [] } = useAlerts();
  const { data: dashboards = [] } = useDashboards();
  const navigate = useNavigate();

  // Build unified recent incidents list
  const recentIncidents = useMemo(() => {
    const items: Array<{
      id: string;
      source: 'saas' | 'service';
      icon: string;
      name: string;
      title: string;
      date: string;
      severity: string;
      status: string;
      ping?: number | null;
      navigateTo: string;
    }> = [];

    // SaaS incidents from dependencies
    for (const dep of dependencies) {
      const incidents: SaasIncident[] = dep.incidents || [];
      for (const inc of incidents) {
        items.push({
          id: `saas-${dep.id}-${inc.date}`,
          source: 'saas',
          icon: dep.icon,
          name: dep.name,
          title: inc.title,
          date: inc.date,
          severity: inc.severity,
          status: dep.status,
          ping: dep.avg_response_time,
          navigateTo: `/stack/${dep.name.toLowerCase().replace(/\s+/g, '-')}`,
        });
      }
    }

    // Service-level incidents from alerts
    for (const alert of alerts.filter(a => !a.is_dismissed)) {
      const svc = services.find(s => s.id === alert.service_id);
      items.push({
        id: alert.id,
        source: 'service',
        icon: svc?.icon || '🌐',
        name: svc?.name || alert.integration_type || 'Service',
        title: alert.title,
        date: alert.created_at,
        severity: alert.severity,
        status: alert.resolved_at ? 'resolved' : 'active',
        ping: svc?.avg_response_time,
        navigateTo: svc ? `/services/${svc.id}` : '/incidents',
      });
    }

    // Sort by date descending
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items.slice(0, 10);
  }, [dependencies, alerts, services]);

  const isLoading = servicesLoading || depsLoading;

  // Only HTTP services (not cloud-imported)
  const httpServices = services.filter(s => !s.tags?.some(t => ['aws', 'ec2', 's3', 'lambda', 'rds', 'gcp', 'azure'].includes(t)));

  const healthScore = getHealthScore(httpServices, dependencies);
  const healthColor = getHealthColor(healthScore);

  // Active incidents = alerts that are not dismissed and not resolved
  const activeIncidents = alerts.filter(a => !a.is_dismissed && !a.resolved_at);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5 font-mono text-xs">$ status --global<span className="cursor-blink"></span></p>
        </div>
        <Button size="sm" onClick={() => navigate('/views?create=true')} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Create a new view
        </Button>
      </div>

      {/* Health Score */}
      <div className="terminal-card p-8 text-center">
        <p className={`text-6xl font-bold tracking-tight font-mono ${healthColor}`}>
          {healthScore}%
        </p>
        <p className="text-muted-foreground mt-2 text-sm">{getHealthLabel(healthScore)}</p>
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground font-mono">
          <span className="text-primary/70">{dependencies.length}</span> dependencies
          <span className="text-muted-foreground/30">│</span>
          <span className="text-primary/70">{httpServices.length}</span> services
          <span className="text-muted-foreground/30">│</span>
          <span className={activeIncidents.length > 0 ? 'text-destructive' : 'text-primary/70'}>{activeIncidents.length}</span> incident{activeIncidents.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Active Incidents */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 font-display">Active Incidents</h2>
        {activeIncidents.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">All systems operational — no active incidents</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeIncidents.slice(0, 5).map(incident => (
              <div
                key={incident.id}
                className="bg-card border border-destructive/20 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-destructive/40 transition-colors"
                onClick={() => navigate('/incidents')}
              >
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{incident.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  incident.severity === 'critical' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'
                }`}>
                  {incident.severity}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Incidents */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 font-display">Recent Incidents</h2>
        {recentIncidents.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No recent incidents — all clear 🎉</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentIncidents.map(inc => (
              <button
                key={inc.id}
                onClick={() => navigate(inc.navigateTo)}
                className="w-full terminal-card p-4 text-left hover:border-primary/30 transition-colors flex items-center gap-3"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  inc.severity === 'critical' ? 'bg-destructive/10' :
                  inc.severity === 'major' ? 'bg-warning/10' : 'bg-muted'
                }`}>
                  <span className="text-lg">{inc.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{inc.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      inc.source === 'saas' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent-foreground'
                    }`}>
                      {inc.source === 'saas' ? 'SaaS' : 'Service'}
                    </span>
                    {inc.status === 'resolved' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success font-mono">Resolved</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{inc.title}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {inc.ping != null && inc.ping > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                      <Wifi className="w-3 h-3" />
                      <span>{inc.ping}ms</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{formatDistanceToNow(new Date(inc.date), { addSuffix: true })}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    inc.severity === 'critical' ? 'bg-destructive/10 text-destructive' :
                    inc.severity === 'major' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
                  }`}>
                    {inc.severity}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
