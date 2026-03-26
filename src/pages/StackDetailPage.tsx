import { useParams, useNavigate } from 'react-router-dom';
import { useSaasDependencies, SaasIncident } from '@/hooks/use-saas-dependencies';

import { useSaasUptimeByPeriod, type SaasUptimePeriod } from '@/hooks/use-saas-uptime';
import { useServices } from '@/hooks/use-supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, ExternalLink, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

const statusBadgeClass: Record<string, string> = {
  operational: 'bg-success/10 text-success border-success/20',
  degraded: 'bg-warning/10 text-warning border-warning/20',
  outage: 'bg-destructive/10 text-destructive border-destructive/20',
  unknown: 'bg-muted text-muted-foreground border-border',
};

const statusLabel: Record<string, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  outage: 'Outage',
  unknown: 'Unknown',
};

export default function StackDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: dependencies = [], isLoading } = useSaasDependencies();
  const { data: services = [] } = useServices();

  const dep = dependencies.find(d => d.name.toLowerCase().replace(/\s+/g, '-') === slug);

  const providerIds = useMemo(() => dep ? [dep.id] : [], [dep]);
  const { data: uptimeMap = {} } = useSaasUptimeByPeriod(providerIds, '30d');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dep) {
    return (
      <div className="animate-fade-in">
        <Button variant="ghost" onClick={() => navigate('/stack')} className="gap-2 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <p className="text-muted-foreground">Dependency not found.</p>
      </div>
    );
  }

  const uptime = uptimeMap[dep.id] ?? dep.uptime_percentage ?? 100;
  const delta = uptime - dep.sla_promised;
  const slaBreach = delta < 0;
  const incidents: SaasIncident[] = dep.incidents || [];
  const status = statusBadgeClass[dep.status] || statusBadgeClass.unknown;

  // Monthly SLA breakdown (mock from incidents)
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return { month: format(d, 'MMM yyyy'), uptime: 100 - (Math.random() * 0.5) };
  }).reverse();

  return (
    <div className="animate-fade-in">
      <Button variant="ghost" onClick={() => navigate('/stack')} className="gap-2 mb-4 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> My Stack
      </Button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-4xl">{dep.icon}</span>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{dep.name}</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${status}`}>
              {statusLabel[dep.status] || 'Unknown'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span>Promised SLA: {dep.sla_promised}%</span>
            <span>—</span>
            <span>
              Actual: <span className={slaBreach ? 'text-destructive font-medium' : 'text-success font-medium'}>{uptime.toFixed(2)}% {slaBreach ? `(−${Math.abs(delta).toFixed(2)}%)` : `(+${delta.toFixed(2)}%)`}</span>
            </span>
            {dep.status_page_url && (
              <a href={dep.status_page_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline inline-flex items-center gap-1 hover:text-foreground transition-colors">
                Status page <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Uptime Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Uptime — Last 6 months</h2>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={months}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis domain={[99, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area type="monotone" dataKey="uptime" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SLA Breakdown */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Monthly SLA</h2>
          <div className="space-y-2">
            {months.map(m => (
              <div key={m.month} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{m.month}</span>
                <span className={m.uptime < dep.sla_promised ? 'text-destructive font-medium' : 'text-foreground'}>
                  {m.uptime.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Incidents Timeline */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Historique des incidents</h2>
        {incidents.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <CheckCircle className="w-6 h-6 text-success mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucun incident enregistré</p>
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  inc.severity === 'critical' ? 'bg-destructive/10' : inc.severity === 'major' ? 'bg-warning/10' : 'bg-muted'
                }`}>
                  <AlertTriangle className={`w-4 h-4 ${
                    inc.severity === 'critical' ? 'text-destructive' : inc.severity === 'major' ? 'text-warning' : 'text-muted-foreground'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{inc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(inc.date).toLocaleDateString()} — {inc.duration_minutes}min
                  </p>
                </div>
                <Badge variant={inc.severity === 'critical' ? 'destructive' : 'outline'} className="text-[10px]">
                  {inc.severity}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
