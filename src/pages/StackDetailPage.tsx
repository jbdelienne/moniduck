import { useParams, useNavigate } from 'react-router-dom';
import { useSaasDependencies, SaasIncident } from '@/hooks/use-saas-dependencies';
import { useSaasUptimeByPeriod, useSaasUptimeChart, type SaasUptimePeriod } from '@/hooks/use-saas-uptime';
import { useServices } from '@/hooks/use-supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, ExternalLink, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
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

const PERIOD_OPTIONS: { value: SaasUptimePeriod; label: string }[] = [
  { value: '24h', label: 'Last day' },
  { value: '7d', label: 'Last week' },
  { value: '30d', label: 'Last month' },
  { value: '12m', label: 'Last year' },
];

const BREAKDOWN_LABEL: Record<SaasUptimePeriod, string> = {
  '24h': 'Hourly breakdown',
  '7d': 'Daily breakdown',
  '30d': 'Daily breakdown',
  '12m': 'Monthly breakdown',
};

export default function StackDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: dependencies = [], isLoading } = useSaasDependencies();
  const { data: services = [] } = useServices();

  const [period, setPeriod] = useState<SaasUptimePeriod>('30d');

  const dep = dependencies.find(d => d.name.toLowerCase().replace(/\s+/g, '-') === slug);

  const providerIds = useMemo(() => dep ? [dep.id] : [], [dep]);
  const { data: uptimeMap = {} } = useSaasUptimeByPeriod(providerIds, period);
  const { data: chartData = [], isLoading: chartLoading } = useSaasUptimeChart(dep?.id, period);

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

  const validUptimes = chartData.filter(p => p.uptime !== null).map(p => p.uptime as number);
  const minUptime = validUptimes.length > 0 ? Math.min(...validUptimes) : 99;
  const yDomain: [number, number] = [Math.max(0, Math.floor(minUptime) - 1), 100];

  // For the breakdown panel: limit rows to keep it readable
  const displayedPoints = period === '30d' ? chartData.slice(-10) : chartData;

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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-foreground">Uptime</h2>
              <Select value={period} onValueChange={v => setPeriod(v as SaasUptimePeriod)}>
                <SelectTrigger className="h-7 text-xs w-32 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className={`text-lg font-bold data-mono ${slaBreach ? 'text-destructive' : 'text-success'}`}>
              {uptime.toFixed(2)}%
            </span>
          </div>
          <div className="h-[200px]">
            {chartLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis domain={yDomain} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(v: number) => [`${v?.toFixed(2) ?? '—'}%`, 'Uptime']}
                  />
                  <Area type="monotone" dataKey="uptime" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" strokeWidth={2} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Breakdown panel */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">{BREAKDOWN_LABEL[period]}</h2>
          <div className="space-y-2 overflow-y-auto max-h-[200px]">
            {displayedPoints.map(p => (
              <div key={p.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{p.label}</span>
                {p.uptime === null ? (
                  <span className="text-muted-foreground text-xs">—</span>
                ) : (
                  <span className={p.uptime < dep.sla_promised ? 'text-destructive font-medium' : 'text-foreground'}>
                    {p.uptime.toFixed(2)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Incidents Timeline */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Incident History</h2>
        {incidents.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <CheckCircle className="w-6 h-6 text-success mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No incidents recorded</p>
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
