import { useMemo, useState } from 'react';
import { Service, useChecks, useAlerts, useUpdateService } from '@/hooks/use-supabase';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { format, differenceInDays, formatDistanceToNow } from 'date-fns';
import { Loader2, ExternalLink, ShieldCheck, Clock, Activity, AlertTriangle, XCircle, Info, ChevronDown, Pencil, Check, X as XIcon, Copy, Server } from 'lucide-react';
import { UptimePeriod, useUptimeForServices } from '@/hooks/use-uptime';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ServiceAlertSettings from './ServiceAlertSettings';
import IconPicker from './IconPicker';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  up: { label: 'Operational', color: 'text-[hsl(var(--success))]', bg: 'bg-success/10' },
  down: { label: 'Down', color: 'text-destructive', bg: 'bg-destructive/10' },
  degraded: { label: 'Degraded', color: 'text-[hsl(var(--warning))]', bg: 'bg-warning/10' },
  unknown: { label: 'Pending', color: 'text-muted-foreground', bg: 'bg-muted/30' },
};

const statusDotColor: Record<string, string> = {
  up: 'bg-success',
  down: 'bg-destructive',
  degraded: 'bg-warning',
  unknown: 'bg-muted-foreground',
};

const severityIcons: Record<string, typeof AlertTriangle> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const severityBadge: Record<string, string> = {
  critical: 'bg-destructive/15 text-destructive border-destructive/20',
  warning: 'bg-warning/15 text-[hsl(var(--warning))] border-warning/20',
  info: 'bg-info/15 text-[hsl(var(--info))] border-info/20',
};

const intervalLabels: Record<string, string> = {
  '1': 'Every minute',
  '2': 'Every 2 minutes',
  '5': 'Every 5 minutes',
};

interface ServiceDetailModalProps {
  service: Service | null;
  open: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export default function ServiceDetailModal({ service, open, onClose, onDelete }: ServiceDetailModalProps) {
  const { data: checks = [], isLoading: checksLoading } = useChecks(service?.id, 50);
  const { data: allAlerts = [], isLoading: alertsLoading } = useAlerts();
  const updateService = useUpdateService();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editInterval, setEditInterval] = useState('2');
  const [editVisibility, setEditVisibility] = useState('public');
  const [editKeyword, setEditKeyword] = useState('');

  const startEditing = () => {
    if (!service) return;
    setEditName(service.name);
    setEditIcon(service.icon);
    setEditUrl(service.url);
    setEditInterval(String(service.check_interval));
    setEditVisibility((service as any).visibility ?? 'public');
    setEditKeyword((service as any).content_keyword ?? '');
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const saveEditing = async () => {
    if (!service) return;
    try {
      await updateService.mutateAsync({
        id: service.id,
        name: editName,
        icon: editIcon,
        url: editUrl,
        check_interval: Number(editInterval),
        visibility: editVisibility,
        content_keyword: editKeyword || null,
      });
      toast.success('Service updated');
      setEditing(false);
    } catch {
      toast.error('Failed to update service');
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const serviceIds = useMemo(() => service ? [service.id] : [], [service?.id]);
  const { data: uptime24h } = useUptimeForServices(serviceIds, '24h');
  const { data: uptime7d } = useUptimeForServices(serviceIds, '7d');
  const { data: uptime30d } = useUptimeForServices(serviceIds, '30d');

  const serviceAlerts = useMemo(() => {
    if (!service) return [];
    return allAlerts.filter((a) => {
      const meta = a.metadata as any;
      return meta?.service_id === service.id;
    });
  }, [allAlerts, service]);

  if (!service) return null;

  const cfg = statusConfig[service.status] ?? statusConfig.unknown;

  const sslExpiry = (service as any).ssl_expiry_date
    ? new Date((service as any).ssl_expiry_date)
    : null;
  const sslDaysLeft = sslExpiry ? differenceInDays(sslExpiry, new Date()) : null;

  const sparklineData = checks
    .slice(0, 30)
    .reverse()
    .map((c) => ({ v: c.response_time, t: format(new Date(c.checked_at), 'HH:mm') }));

  const responseTimes = checks.slice(0, 30).map(c => c.response_time).filter(Boolean);
  const minResponse = responseTimes.length ? Math.min(...responseTimes) : 0;
  const avgResponse = responseTimes.length ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;
  const p95Response = responseTimes.length
    ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)] ?? 0
    : 0;

  const u24 = uptime24h?.[service.id] ?? null;
  const u7 = uptime7d?.[service.id] ?? null;
  const u30 = uptime30d?.[service.id] ?? (service.uptime_percentage ?? null);

  const uptimeBars: { label: string; value: number | null; color: string }[] = [
    { label: '24h', value: u24, color: getUptimeColor(u24) },
    { label: '7d', value: u7, color: getUptimeColor(u7) },
    { label: '30d', value: u30, color: getUptimeColor(u30) },
  ];

  const incidents = checks
    .filter(c => c.status !== 'up')
    .slice(0, 5)
    .map(c => {
      const ca = c as any;
      return {
        id: c.id,
        date: format(new Date(c.checked_at), 'MMM dd, HH:mm'),
        reason: ca.error_message || (ca.status_code ? `HTTP ${ca.status_code}` : c.status),
      };
    });

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => { setEditing(false); onClose(); }}
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
                {service.icon}
              </div>
              <div className="min-w-0 flex-1">
                {editing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <IconPicker value={editIcon} onChange={setEditIcon} />
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-lg font-bold" placeholder="Service name" />
                    </div>
                    <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="text-sm" placeholder="https://..." type="url" />
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={editInterval} onValueChange={setEditInterval}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Every minute</SelectItem>
                          <SelectItem value="2">Every 2 min</SelectItem>
                          <SelectItem value="5">Every 5 min</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={editVisibility} onValueChange={setEditVisibility}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">🌐 Public</SelectItem>
                          <SelectItem value="private">🔒 Private</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input value={editKeyword} onChange={(e) => setEditKeyword(e.target.value)} className="text-sm" placeholder="Content keyword (optional)" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEditing} disabled={updateService.isPending}>
                        {updateService.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEditing}>
                        <XIcon className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-foreground truncate">{service.name}</h2>
                      <button onClick={startEditing} className="p-1 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${cfg.bg}`}>
                        <span className={`w-2 h-2 rounded-full ${statusDotColor[service.status] ?? statusDotColor.unknown} animate-pulse`} />
                        <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{intervalLabels[String(service.check_interval)] ?? `Every ${service.check_interval}m`}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { setEditing(false); onClose(); }} className="shrink-0">
              <XIcon className="w-5 h-5" />
            </Button>
          </div>

          {/* Quick stats row */}
          {!editing && (
            <div className="grid grid-cols-3 gap-3 mt-6">
              <QuickStat icon={Activity} label="Response" value={`${avgResponse}ms`} />
              <QuickStat icon={Clock} label="Uptime 30d" value={u30 !== null ? `${u30}%` : '—'} valueColor={u30 !== null && u30 < 99.5 ? 'text-[hsl(var(--warning))]' : undefined} />
              <QuickStat icon={ShieldCheck} label="SSL expiry" value={sslDaysLeft !== null ? `${sslDaysLeft}d` : '—'} valueColor={sslDaysLeft !== null ? (sslDaysLeft <= 7 ? 'text-destructive' : sslDaysLeft <= 30 ? 'text-[hsl(var(--warning))]' : undefined) : undefined} />
            </div>
          )}
        </div>

        {/* Content */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4 bg-muted/50 border border-border/50">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs">
              Alerts
              {serviceAlerts.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-destructive/20 text-destructive px-1.5 rounded-full font-bold">
                  {serviceAlerts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6 py-4">
            <TabsContent value="overview" className="mt-0 space-y-6">
              {/* URL - copyable */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Endpoint
                </h3>
                <CopyableRow label="URL" value={service.url} fieldKey="url" copiedField={copiedField} onCopy={handleCopy} />
              </div>

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
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : sparklineData.length === 0 ? (
                      <p className="text-xs text-muted-foreground flex items-center justify-center h-full">No data yet</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparklineData}>
                          <defs>
                            <linearGradient id="responseGrad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={1} />
                            </linearGradient>
                          </defs>
                          <Tooltip
                            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                            formatter={(v: number) => [`${v}ms`, 'Response']}
                            labelFormatter={(l) => l}
                          />
                          <Line type="monotone" dataKey="v" stroke="url(#responseGrad)" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: 'hsl(var(--foreground))' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Uptime Bars */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Uptime</h3>
                <div className="space-y-3">
                  {uptimeBars.map((bar) => (
                    <div key={bar.label} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-muted-foreground w-7 text-right shrink-0">{bar.label}</span>
                      <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ease-out ${bar.color}`} style={{ width: bar.value !== null ? `${bar.value}%` : '0%' }} />
                      </div>
                      <span className={`text-sm font-bold w-16 text-right shrink-0 ${bar.value !== null && bar.value < 99.5 ? 'text-[hsl(var(--warning))]' : 'text-foreground'}`}>
                        {bar.value !== null ? `${bar.value}%` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Incidents */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Incidents</h3>
                {checksLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                ) : incidents.length === 0 ? (
                  <div className="text-center py-4 rounded-lg bg-success/5 border border-success/20">
                    <p className="text-sm text-[hsl(var(--success))]">No recent incidents 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {incidents.map((inc) => (
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

            <TabsContent value="alerts" className="mt-0 space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Alert History ({serviceAlerts.length})
                </h3>
                {alertsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                ) : serviceAlerts.length === 0 ? (
                  <div className="text-center py-8 rounded-lg bg-muted/10 border border-border/50">
                    <p className="text-sm text-muted-foreground">No alerts for this service</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {serviceAlerts.slice(0, 20).map((alert) => {
                      const Icon = severityIcons[alert.severity] ?? Info;
                      const badgeCls = severityBadge[alert.severity] ?? severityBadge.info;
                      return (
                        <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/10 border border-border/50 hover:bg-muted/20 transition-colors">
                          <div className={`p-1.5 rounded-lg ${badgeCls.split(' ').filter(c => c.startsWith('bg-')).join(' ')}`}>
                            <Icon className={`w-3.5 h-3.5 ${badgeCls.split(' ').filter(c => c.startsWith('text-')).join(' ')}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{alert.description}</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                              {(() => {
                                const dist = formatDistanceToNow(new Date(alert.created_at), { addSuffix: true });
                                return dist.includes('less than') ? 'just now' : dist;
                              })()}
                            </p>
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${badgeCls}`}>
                            {alert.severity}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="mt-0 space-y-6">
              <ServiceAlertSettings
                serviceId={service.id}
                alertEmailEnabled={(service as any).alert_email_enabled ?? true}
                alertEmail={(service as any).alert_email ?? null}
                alertChecksThreshold={(service as any).alert_checks_threshold ?? 2}
                maintenanceUntil={(service as any).maintenance_until ?? null}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Footer */}
        <div className="p-6 border-t border-border/50">
          <div className="flex items-center gap-3">
            <Button variant="outline" className="flex-1" onClick={() => window.open(service.url, '_blank')}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open URL
            </Button>
            {onDelete && (
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(service.id)}>
                Delete
              </Button>
            )}
          </div>
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

function getUptimeColor(value: number | null): string {
  if (value === null) return 'bg-muted-foreground/30';
  if (value >= 99.9) return 'bg-success';
  if (value >= 99) return 'bg-success/80';
  if (value >= 95) return 'bg-warning';
  return 'bg-destructive';
}
