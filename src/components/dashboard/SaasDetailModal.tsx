import { useState, useRef, useEffect } from 'react';
import { SaasProviderWithSubscription, SaasIncident, useUpdateSlaOverride } from '@/hooks/use-saas-dependencies';
import { useSaasChecks } from '@/hooks/use-saas-checks';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { format } from 'date-fns';
import { Loader2, ExternalLink, Activity, Clock, ShieldCheck, Pencil, Check, X as XIcon, Copy, Globe } from 'lucide-react';
import { INCIDENT_SEVERITY } from '@/lib/status';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  operational: { label: 'Operational', color: 'text-[hsl(var(--success))]', bg: 'bg-success/10', dot: 'bg-success' },
  degraded: { label: 'Degraded', color: 'text-[hsl(var(--warning))]', bg: 'bg-warning/10', dot: 'bg-warning' },
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
  const updateSla = useUpdateSlaOverride();
  const [editingSla, setEditingSla] = useState(false);
  const [slaInput, setSlaInput] = useState('');
  const [localSla, setLocalSla] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const slaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSla(null);
    setEditingSla(false);
  }, [provider?.subscription_id]);

  useEffect(() => {
    if (editingSla && slaInputRef.current) {
      slaInputRef.current.focus();
      slaInputRef.current.select();
    }
  }, [editingSla]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!provider) return null;

  const currentSla = localSla ?? provider.sla_promised;
  const cfg = statusConfig[provider.status] ?? statusConfig.unknown;
  const pageCfg = statusConfig[provider.status_page_status] ?? statusConfig.unknown;

  const sparklineData = checks.slice(0, 30).reverse().map((c) => ({ v: c.response_time, t: format(new Date(c.checked_at), 'HH:mm') }));
  const responseTimes = checks.slice(0, 30).map(c => c.response_time).filter(Boolean);
  const minResponse = responseTimes.length ? Math.min(...responseTimes) : 0;
  const avgResponse = responseTimes.length ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;
  const p95Response = responseTimes.length ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)] ?? 0 : 0;

  const uptime = provider.uptime_percentage ?? 100;
  const slaDelta = uptime - currentSla;
  const slaBreach = slaDelta < 0;

  const handleSlaEdit = () => { setSlaInput(String(currentSla)); setEditingSla(true); };
  const handleSlaSave = async () => {
    const val = parseFloat(slaInput);
    if (isNaN(val) || val < 0 || val > 100) { toast.error('SLA must be between 0 and 100'); return; }
    try {
      await updateSla.mutateAsync({ subscriptionId: provider.subscription_id, sla: val });
      setLocalSla(val);
      toast.success('SLA updated');
      setEditingSla(false);
    } catch (e: any) { toast.error(e.message); }
  };
  const handleSlaCancel = () => setEditingSla(false);

  const incidents: SaasIncident[] = Array.isArray(provider.incidents) ? provider.incidents : [];
  const downChecks = checks.filter(c => c.status !== 'operational').slice(0, 5).map(c => ({
    id: c.id,
    date: format(new Date(c.checked_at), 'MMM dd, HH:mm'),
    reason: c.error_message || (c.status_code ? `HTTP ${c.status_code}` : c.status),
  }));

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 w-full max-w-xl z-50",
          "bg-gradient-to-b from-card to-background border-l border-border/50",
          "flex flex-col shadow-2xl",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-muted/50 border border-border/50 text-2xl">
                {provider.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-foreground truncate mb-1">{provider.name}</h2>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${cfg.bg}`}>
                    <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                  </div>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <XIcon className="w-5 h-5" />
            </Button>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <QuickStat icon={Activity} label="Response" value={avgResponse > 0 ? `${avgResponse}ms` : '—'} />
            <QuickStat icon={Clock} label="Uptime" value={`${uptime}%`} valueColor={uptime < 99.5 ? 'text-[hsl(var(--warning))]' : undefined} />
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                SLA promis
              </div>
              {editingSla ? (
                <div className="flex items-center gap-1">
                  <Input
                    ref={slaInputRef}
                    value={slaInput}
                    onChange={(e) => setSlaInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSlaSave(); if (e.key === 'Escape') handleSlaCancel(); }}
                    className="w-16 h-7 text-sm font-bold px-1"
                  />
                  <span className="text-sm font-bold">%</span>
                  <button onClick={handleSlaSave} disabled={updateSla.isPending} className="p-0.5 rounded hover:bg-muted text-[hsl(var(--success))]">
                    {updateSla.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={handleSlaCancel} className="p-0.5 rounded hover:bg-muted text-destructive">
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button onClick={handleSlaEdit} className="flex items-center gap-1.5 group">
                  <p className="text-lg font-bold text-foreground">{currentSla}%</p>
                  <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4 bg-muted/50 border border-border/50">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="incidents" className="text-xs">
              Incidents
              {incidents.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-destructive/20 text-destructive px-1.5 rounded-full font-bold">
                  {incidents.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6 py-4">
            <TabsContent value="overview" className="mt-0 space-y-6">
              {/* URL - copyable */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Endpoint</h3>
                <CopyableRow label="URL" value={provider.url} fieldKey="url" copiedField={copiedField} onCopy={handleCopy} />
              </div>

              <Separator />

              {/* SLA Delta */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">SLA Compliance</h3>
                <div className={`rounded-lg border p-4 ${slaBreach ? 'bg-destructive/5 border-destructive/20' : 'bg-success/5 border-success/20'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Delta</span>
                    <Badge variant={slaBreach ? 'destructive' : 'outline'} className={`font-mono ${!slaBreach ? 'border-emerald-500/30 text-emerald-400' : ''}`}>
                      {slaBreach ? '' : '+'}{slaDelta.toFixed(2)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {slaBreach ? `SLA breached — ${uptime}% vs ${currentSla}% promised` : `SLA respected — ${uptime}% vs ${currentSla}% promised`}
                  </p>
                </div>
              </div>

              {/* Status Page */}
              {provider.status_page_url && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status Page</h3>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${pageCfg.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pageCfg.dot}`} />
                          <span className={`text-xs font-medium ${pageCfg.color}`}>{pageCfg.label}</span>
                        </div>
                      </div>
                      <a href={provider.status_page_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
                        Open <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Response Time Chart */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Response Time</h3>
                  {responseTimes.length > 0 && (
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>Min <strong className="text-foreground">{minResponse}ms</strong></span>
                      <span>P95 <strong className="text-foreground">{p95Response}ms</strong></span>
                    </div>
                  )}
                </div>
                <div className="rounded-lg bg-muted/20 border border-border/50 p-4">
                  <div className="h-16">
                    {checksLoading ? (
                      <div className="flex items-center justify-center h-full"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                    ) : sparklineData.length === 0 ? (
                      <p className="text-xs text-muted-foreground flex items-center justify-center h-full">No data yet</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparklineData}>
                          <defs>
                            <linearGradient id="saasResponseGrad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={1} />
                            </linearGradient>
                          </defs>
                          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`${v}ms`, 'Response']} labelFormatter={(l) => l} />
                          <Line type="monotone" dataKey="v" stroke="url(#saasResponseGrad)" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: 'hsl(var(--foreground))' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Recent Down Checks */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Incidents</h3>
                {checksLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                ) : downChecks.length === 0 ? (
                  <div className="text-center py-4 rounded-lg bg-success/5 border border-success/20">
                    <p className="text-sm text-[hsl(var(--success))]">No recent incidents 🎉</p>
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
            </TabsContent>

            <TabsContent value="incidents" className="mt-0 space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Status Page Incidents ({incidents.length})
                </h3>
                {incidents.length === 0 ? (
                  <div className="text-center py-8 rounded-lg bg-muted/10 border border-border/50">
                    <p className="text-sm text-muted-foreground">No status page incidents</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incidents.map((inc, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/10 border border-border/50 hover:bg-muted/20 transition-colors">
                        <div className={`p-1.5 rounded-lg ${(INCIDENT_SEVERITY[inc.severity] ?? INCIDENT_SEVERITY.minor).bgClass}`}>
                          {(() => { const cfg = INCIDENT_SEVERITY[inc.severity] ?? INCIDENT_SEVERITY.minor; return <cfg.icon className={`w-3.5 h-3.5 ${cfg.colorClass}`} />; })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{inc.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{new Date(inc.date).toLocaleDateString()}</span>
                            <span>{inc.duration_minutes}min</span>
                          </div>
                        </div>
                        <Badge variant={inc.severity === 'critical' ? 'destructive' : 'outline'} className="text-[10px] shrink-0">
                          {inc.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Footer */}
        <div className="p-6 border-t border-border/50">
          <Button variant="outline" className="w-full" onClick={() => window.open(provider.url, '_blank')}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Open {provider.name}
          </Button>
        </div>
      </div>
    </>
  );
}

/* ─── Sub-components ─── */

function QuickStat({ icon: IconComp, label, value, valueColor }: { icon: typeof Activity; label: string; value: string; valueColor?: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <IconComp className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className={`text-lg font-bold truncate ${valueColor ?? 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function CopyableRow({ label, value, fieldKey, copiedField, onCopy }: {
  label: string; value: string; fieldKey: string; copiedField: string | null; onCopy: (text: string, field: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 group">
      <div className="min-w-0 flex-1 mr-3">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-mono text-foreground truncate">{value}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onCopy(value, fieldKey)}>
        {copiedField === fieldKey ? <Check className="w-4 h-4 text-[hsl(var(--success))]" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  );
}
