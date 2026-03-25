import { useServices } from '@/hooks/use-supabase';
import { useSaasDependencies, SaasProviderWithSubscription } from '@/hooks/use-saas-dependencies';
import { useAlerts } from '@/hooks/use-supabase';
import { Loader2, CheckCircle, AlertTriangle, XCircle, Minus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

function getHealthScore(services: any[], dependencies: SaasProviderWithSubscription[]): number {
  const allItems = [
    ...services.map(s => s.status === 'up' ? 1 : s.status === 'degraded' ? 0.5 : 0),
    ...dependencies.map(d => d.status === 'operational' ? 1 : d.status === 'degraded' ? 0.5 : 0),
  ];
  if (allItems.length === 0) return 100;
  return Math.round((allItems.reduce((a, b) => a + b, 0) / allItems.length) * 100);
}

function getHealthColor(score: number) {
  if (score >= 90) return 'text-success';
  if (score >= 70) return 'text-warning';
  return 'text-destructive';
}

function getHealthLabel(score: number) {
  if (score >= 95) return 'Ta stack est en bonne santé';
  if (score >= 80) return 'Quelques dégradations détectées';
  if (score >= 50) return 'Attention, plusieurs services impactés';
  return 'Situation critique';
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
  up: 'Opérationnel',
  operational: 'Opérationnel',
  degraded: 'Dégradé',
  down: 'Panne',
  outage: 'Panne',
  unknown: 'Inconnu',
};

export default function DashboardOverview() {
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: dependencies = [], isLoading: depsLoading } = useSaasDependencies();
  const { data: alerts = [] } = useAlerts();
  const navigate = useNavigate();

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
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Vue d'ensemble</h1>
        <p className="text-sm text-muted-foreground mt-0.5 font-mono text-xs">$ status --global<span className="cursor-blink"></span></p>
      </div>

      {/* Health Score */}
      <div className="terminal-card p-8 text-center">
        <p className={`text-6xl font-bold tracking-tight font-mono ${healthColor}`}>
          {healthScore}%
        </p>
        <p className="text-muted-foreground mt-2 text-sm">{getHealthLabel(healthScore)}</p>
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground font-mono">
          <span className="text-primary/70">{dependencies.length}</span> dépendances
          <span className="text-muted-foreground/30">│</span>
          <span className="text-primary/70">{httpServices.length}</span> services
          <span className="text-muted-foreground/30">│</span>
          <span className={activeIncidents.length > 0 ? 'text-destructive' : 'text-primary/70'}>{activeIncidents.length}</span> incident{activeIncidents.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Active Incidents */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Incidents actifs</h2>
        {activeIncidents.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Tout est opérationnel — aucun incident en cours</p>
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

      {/* Quick Status Grid */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Statut rapide</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* SaaS dependencies */}
          {dependencies.map(dep => (
            <button
              key={dep.id}
              onClick={() => navigate(`/stack/${dep.name.toLowerCase().replace(/\s+/g, '-')}`)}
              className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{dep.icon}</span>
                <span className="text-sm font-medium text-foreground truncate">{dep.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${statusDotClass[dep.status] || statusDotClass.unknown}`} />
                <span className="text-xs text-muted-foreground">{statusLabel[dep.status] || 'Inconnu'}</span>
              </div>
            </button>
          ))}

          {/* HTTP Services */}
          {httpServices.map(svc => (
            <button
              key={svc.id}
              onClick={() => navigate(`/services/${svc.id}`)}
              className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{svc.icon}</span>
                <span className="text-sm font-medium text-foreground truncate">{svc.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${statusDotClass[svc.status] || statusDotClass.unknown}`} />
                <span className="text-xs text-muted-foreground">{statusLabel[svc.status] || 'Inconnu'}</span>
              </div>
            </button>
          ))}

          {dependencies.length === 0 && httpServices.length === 0 && (
            <div className="col-span-full bg-card border border-border rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground">Aucun service monitoré.</p>
              <button onClick={() => navigate('/stack')} className="text-sm text-primary hover:underline mt-1">
                Ajouter des dépendances →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
