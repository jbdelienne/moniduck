import { useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Service, useChecks, useAlerts, useUpdateService } from '@/hooks/use-supabase';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { format, differenceInDays, formatDistanceToNow } from 'date-fns';
import { Loader2, ExternalLink, ShieldCheck, Clock, Activity, AlertTriangle, XCircle, Info, ChevronDown, Pencil, Check, X } from 'lucide-react';
import { UptimePeriod, useUptimeForServices } from '@/hooks/use-uptime';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ServiceAlertSettings from './ServiceAlertSettings';
import IconPicker from './IconPicker';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  up: { label: 'Operational', color: 'text-success', bg: 'bg-success/10' },
  down: { label: 'Down', color: 'text-destructive', bg: 'bg-destructive/10' },
  degraded: { label: 'Degraded', color: 'text-warning', bg: 'bg-warning/10' },
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
  warning: 'bg-warning/15 text-warning border-warning/20',
  info: 'bg-info/15 text-info border-info/20',
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(false); onClose(); } }}>
      <DialogContent className="sm:max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden p-0 gap-0 bg-card border-border rounded-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <IconPicker value={editIcon} onChange={setEditIcon} />
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-lg font-bold"
                      placeholder="Service name"
                    />
                  </div>
                  <Input
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="text-sm"
                    placeholder="https://..."
                    type="url"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={editInterval} onValueChange={setEditInterval}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Every minute</SelectItem>
                        <SelectItem value="2">Every 2 minutes</SelectItem>
                        <SelectItem value="5">Every 5 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={editVisibility} onValueChange={setEditVisibility}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">🌐 Public</SelectItem>
                        <SelectItem value="private">🔒 Private</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    value={editKeyword}
                    onChange={(e) => setEditKeyword(e.target.value)}
                    className="text-sm"
                    placeholder="Content keyword (optional)"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEditing} disabled={updateService.isPending} className="gradient-primary text-primary-foreground">
                      {updateService.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-2xl">{service.icon}</span>
                    <h2 className="text-lg font-bold text-foreground truncate">{service.name}</h2>
                    <button
                      onClick={startEditing}
                      className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit service"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={service.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {service.url}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <span className="text-xs text-muted-foreground/60">•</span>
                    <span className="text-xs text-muted-foreground">{intervalLabels[String(service.check_interval)] ?? `Every ${service.check_interval}m`}</span>
                  </div>
                </>
              )}
            </div>
            {!editing && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${cfg.bg}`}>
                <span className={`w-2 h-2 rounded-full ${statusDotColor[service.status] ?? statusDotColor.unknown} animate-pulse`} />
                <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="px-6 pb-5">
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              icon={<Activity className="w-4 h-4 text-primary" />}
              label="Response"
              value={`${avgResponse}ms`}
            />
            <MetricCard
              icon={<Clock className="w-4 h-4 text-success" />}
              label="Uptime 30d"
              value={u30 !== null ? `${u30}%` : '—'}
              valueColor={u30 !== null && u30 < 99.5 ? 'text-warning' : undefined}
            />
            <MetricCard
              icon={<ShieldCheck className="w-4 h-4 text-info" />}
              label="SSL expiry"
              value={sslDaysLeft !== null ? `${sslDaysLeft}d` : '—'}
              valueColor={sslDaysLeft !== null ? (sslDaysLeft <= 7 ? 'text-destructive' : sslDaysLeft <= 30 ? 'text-warning' : undefined) : undefined}
            />
          </div>
        </div>

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
                      <linearGradient id="responseGrad" x1="0" y1="0" x2="1" y2="0">
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
                      stroke="url(#responseGrad)"
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

        {/* Uptime Bars */}
        <div className="px-6 pb-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Uptime</h3>
          <div className="space-y-3">
            {uptimeBars.map((bar) => (
              <div key={bar.label} className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground w-7 text-right shrink-0">{bar.label}</span>
                <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${bar.color}`}
                    style={{ width: bar.value !== null ? `${bar.value}%` : '0%' }}
                  />
                </div>
                <span className={`text-sm font-bold w-16 text-right shrink-0 ${bar.value !== null && bar.value < 99.5 ? 'text-warning' : 'text-foreground'}`}>
                  {bar.value !== null ? `${bar.value}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Incidents en cours */}
        <div className="px-6 pb-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Incidents en cours</h3>
          {checksLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-4 rounded-xl bg-success/5 border border-success/20">
              <p className="text-sm text-success">No recent incidents 🎉</p>
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

        {/* Alert Settings - Collapsible */}
        <div className="px-6 pb-5">
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full group">
              <h3 className="text-sm font-semibold text-foreground">Alert Settings</h3>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <ServiceAlertSettings
                serviceId={service.id}
                alertEmailEnabled={(service as any).alert_email_enabled ?? true}
                alertEmail={(service as any).alert_email ?? null}
                alertChecksThreshold={(service as any).alert_checks_threshold ?? 2}
                maintenanceUntil={(service as any).maintenance_until ?? null}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Previous Alerts - Collapsible */}
        <div className="px-6 pb-6">
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full group">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Previous alerts</h3>
                {serviceAlerts.length > 0 && (
                  <Badge variant="outline" className="text-xs font-medium">
                    {serviceAlerts.length}
                  </Badge>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              {alertsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : serviceAlerts.length === 0 ? (
                <div className="text-center py-4 rounded-xl bg-muted/10 border border-border">
                  <p className="text-sm text-muted-foreground">No alerts for this service</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {serviceAlerts.slice(0, 10).map((alert) => {
                    const Icon = severityIcons[alert.severity] ?? Info;
                    const badgeCls = severityBadge[alert.severity] ?? severityBadge.info;
                    return (
                      <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/10 border border-border hover:bg-muted/20 transition-colors">
                        <div className={`p-1.5 rounded-lg ${badgeCls.split(' ').filter(c => c.startsWith('bg-')).join(' ')}`}>
                          <Icon className={`w-3.5 h-3.5 ${badgeCls.split(' ').filter(c => c.startsWith('text-')).join(' ')}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{alert.description}</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">
                            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
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
            </CollapsibleContent>
          </Collapsible>
        </div>
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

function getUptimeColor(value: number | null): string {
  if (value === null) return 'bg-muted-foreground/30';
  if (value >= 99.9) return 'bg-success';
  if (value >= 99) return 'bg-success/80';
  if (value >= 95) return 'bg-warning';
  return 'bg-destructive';
}
