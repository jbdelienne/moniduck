import { useParams, useNavigate } from 'react-router-dom';
import { useServices, useChecks, Service } from '@/hooks/use-supabase';
import { useSaasDependencies } from '@/hooks/use-saas-dependencies';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { format } from 'date-fns';

const statusLabel: Record<string, string> = {
  up: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'Unknown',
};

const statusDot: Record<string, string> = {
  up: 'bg-success',
  degraded: 'bg-warning',
  down: 'bg-destructive',
  unknown: 'bg-muted-foreground',
};

type Period = '24h' | '7d' | '30d';

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: services = [], isLoading } = useServices();
  const { data: checks = [] } = useChecks(id, 200);
  const { data: dependencies = [] } = useSaasDependencies();
  const [period, setPeriod] = useState<Period>('24h');

  const service = services.find(s => s.id === id);

  // Filter checks by period
  const filteredChecks = useMemo(() => {
    const now = Date.now();
    const cutoff = period === '24h' ? 86400000 : period === '7d' ? 604800000 : 2592000000;
    return checks
      .filter(c => now - new Date(c.checked_at).getTime() < cutoff)
      .reverse();
  }, [checks, period]);

  const chartData = filteredChecks.map(c => ({
    time: format(new Date(c.checked_at), period === '24h' ? 'HH:mm' : 'dd/MM'),
    latency: c.response_time,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="animate-fade-in">
        <Button variant="ghost" onClick={() => navigate('/services')} className="gap-2 mb-4">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Button>
        <p className="text-muted-foreground">Service non trouvé.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Button variant="ghost" onClick={() => navigate('/services')} className="gap-2 mb-4 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Mes Services
      </Button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-3xl">{service.icon}</span>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{service.name}</h1>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${statusDot[service.status] || statusDot.unknown}`} />
              <span className="text-sm text-muted-foreground">{statusLabel[service.status] || 'Inconnu'}</span>
            </div>
          </div>
          <a href={service.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-0.5">
            {service.url.replace(/^https?:\/\//, '')} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Latency Chart */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Latence</h2>
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg border border-border/50 p-0.5">
            {(['24h', '7d', '30d'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  period === p ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[250px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                />
                <Line type="monotone" dataKey="latency" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Pas de données pour cette période
            </div>
          )}
        </div>
      </div>

      {/* Dependencies */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Dépendances SaaS liées</h2>
        {dependencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune dépendance configurée. Ajoute des dépendances dans Ma Stack.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dependencies.map(dep => (
              <button
                key={dep.id}
                onClick={() => navigate(`/stack/${dep.name.toLowerCase().replace(/\s+/g, '-')}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:border-primary/30 text-sm transition-colors"
              >
                <span>{dep.icon}</span>
                <span className="text-foreground">{dep.name}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  dep.status === 'operational' ? 'bg-success' : dep.status === 'degraded' ? 'bg-warning' : dep.status === 'outage' ? 'bg-destructive' : 'bg-muted-foreground'
                }`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
