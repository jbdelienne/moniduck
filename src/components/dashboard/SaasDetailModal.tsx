import { useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { SaasProviderWithSubscription, SaasIncident } from '@/hooks/use-saas-dependencies';
import { useSaasChecks } from '@/hooks/use-saas-checks';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { format } from 'date-fns';
import { Loader2, ExternalLink, Activity, Clock, ShieldCheck, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  operational: { label: 'Operational', color: 'text-success', bg: 'bg-success/10', dot: 'bg-success' },
  degraded: { label: 'Degraded', color: 'text-warning', bg: 'bg-warning/10', dot: 'bg-warning' },
  outage: { label: 'Outage', color: 'text-destructive', bg: 'bg-destructive/10', dot: 'bg-destructive' },
  unknown: { label: 'Unknown', color: 'text-muted-foreground', bg: 'bg-muted/30', dot: 'bg-muted-foreground' },
};

interface SaasDetailModalProps {
  provider: SaasProviderWithSubscription | null;
  open: boolean;
  onClose: () => void;
}

export default function SaasDetailModal({ provider, open, onClose }: SaasDetailModalProps) {
  const { data: checks = [], isLoading: checksLoading } = useSaasChecks(provider?.id, 50);

  if (!provider) return null;

  const cfg = statusConfig[provider.status] ?? statusConfig.unknown;
  const pageCfg = statusConfig[provider.status_page_status] ?? statusConfig.unknown;

  // Response time sparkline data (last 30 checks)
  const sparklineData = checks
    .slice(0, 30)
    .reverse()
    .map((c) => ({ v: c.response_time, t: format(new Date(c.checked_at), 'HH:mm') }));

  // Response time stats
  const responseTimes = checks.slice(0, 30).map(c => c.response_time).filter(Boolean);
  const minResponse = responseTimes.length ? Math.min(...responseTimes) : 0;
  const avgResponse = responseTimes.length ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;
  const p95Response = responseTimes.length
    ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)] ?? 0
    : 0;

  const uptime = provider.uptime_percentage ?? 100;
  const slaDelta = uptime - provider.sla_promised;
  const slaBreach = slaDelta < 0;

  const incidents: SaasIncident[] = Array.isArray(provider.incidents) ? provider.incidents : [];

  // Downtime checks
  const downChecks = checks
    .filter(c => c.status !== 'operational')
    .slice(0, 5)
    .map(c => ({
      id: c.id,
      date: format(new Date(c.checked_at), 'MMM dd, HH:mm'),
      reason: c.error_message || (c.status_code ? `HTTP ${c.status_code}` : c.status),
    }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 bg-card border-border rounded-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-2xl">{provider.icon}</span>
                <h2 className="text-lg font-bold text-foreground truncate">{provider.name}</h2>
              </div>
              <a
                href={provider.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {provider.url}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${cfg.bg}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
              <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="px-6 pb-5">
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              icon={<Activity className="w-4 h-4 text-primary" />}
              label="Response"
              value={avgResponse > 0 ? `${avgResponse}ms` : '—'}
            />
            <MetricCard
              icon={<Clock className="w-4 h-4 text-success" />}
              label="Uptime"
              value={`${uptime}%`}
              valueColor={uptime < 99.5 ? 'text-warning' : undefined}
            />
            <MetricCard
              icon={<ShieldCheck className="w-4 h-4 text-info" />}
              label="SLA promis"
              value={`${provider.sla_promised}%`}
            />
          </div>
        </div>

        {/* SLA Delta */}
        <div className="px-6 pb-5">
          <div className={`rounded-xl border p-4 ${slaBreach ? 'bg-destructive/5 border-destructive/20' : 'bg-success/5 border-success/20'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">SLA Delta</span>
              <Badge
                variant={slaBreach ? 'destructive' : 'outline'}
                className={`font-mono ${!slaBreach ? 'border-success/30 text-success' : ''}`}
              >
                {slaBreach ? '' : '+'}{slaDelta.toFixed(2)}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {slaBreach
                ? `SLA breached — uptime ${uptime}% vs promised ${provider.sla_promised}%`
                : `SLA respected — ${uptime}% uptime vs ${provider.sla_promised}% promised`}
            </p>
          </div>
        </div>

        {/* Status Page */}
        {provider.status_page_url && (
          <div className="px-6 pb-5">
            <div className="rounded-xl bg-muted/15 border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Status Page</span>
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${pageCfg.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${pageCfg.dot}`} />
                    <span className={`text-xs font-medium ${pageCfg.color}`}>{pageCfg.label}</span>
                  </div>
                </div>
                <a
                  href={provider.status_page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  Open <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Response Time Chart */}
        <div className="px-6 pb-5">
          <div className="rounded-xl bg-muted/20 border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Response Time</h3>
              {responseTimes.length > 0 && (
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>Min <strong className="text-foreground">{minResponse}ms</strong></span>
                  <span>Avg <strong className="text-foreground">{avgResponse}ms</strong></span>
                  <span>P95 <strong className="text-foreground">{p95Response}ms</strong></span>
                </div>
              )}
            </div>
            <div className="h-16">
              {checksLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : sparklineData.length === 0 ? (
                <p className="text-xs text-muted-foreground flex items-center justify-center h-full">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <defs>
                      <linearGradient id="saasResponseGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v: number) => [`${v}ms`, 'Response']}
                      labelFormatter={(l) => l}
                    />
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke="url(#saasResponseGrad)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3, fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Recent Down Checks */}
        <div className="px-6 pb-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Incidents en cours</h3>
          {checksLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : downChecks.length === 0 ? (
            <div className="text-center py-4 rounded-xl bg-success/5 border border-success/20">
              <p className="text-sm text-success">No recent incidents 🎉</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {downChecks.map((inc) => (
                <div key={inc.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/10 transition-colors text-sm">
                  <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                  <span className="text-muted-foreground font-medium shrink-0">{inc.date}</span>
                  <span className="text-destructive truncate flex-1">{inc.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Page Incidents - Collapsible */}
        {incidents.length > 0 && (
          <div className="px-6 pb-6">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Status Page Incidents</h3>
                  <Badge variant="outline" className="text-xs font-medium">
                    {incidents.length}
                  </Badge>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="space-y-2">
                  {incidents.map((inc, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/10 border border-border hover:bg-muted/20 transition-colors">
                      <div className={`p-1.5 rounded-lg ${inc.severity === 'critical' ? 'bg-destructive/15' : inc.severity === 'major' ? 'bg-warning/15' : 'bg-info/15'}`}>
                        <span className="text-xs">{inc.severity === 'critical' ? '🔴' : inc.severity === 'major' ? '🟠' : '🟡'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{inc.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{new Date(inc.date).toLocaleDateString()}</span>
                          <span>{inc.duration_minutes}min</span>
                        </div>
                      </div>
                      <Badge
                        variant={inc.severity === 'critical' ? 'destructive' : 'outline'}
                        className="text-[10px] shrink-0"
                      >
                        {inc.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ icon, label, value, valueColor }: { icon: React.ReactNode; label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded-xl bg-muted/15 border border-border p-3 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className={`text-lg font-bold ${valueColor ?? 'text-foreground'}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
