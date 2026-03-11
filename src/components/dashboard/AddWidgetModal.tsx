import { useState, useMemo } from 'react';
import { useServices } from '@/hooks/use-supabase';
import { useIntegrations } from '@/hooks/use-supabase';
import { useSyncData } from '@/hooks/use-integrations';
import { useSaasSubscriptions } from '@/hooks/use-saas-dependencies';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Cloud, Loader2, ChevronLeft, Hash, LineChart, BadgeCheck, List,
  AlertTriangle, Server, Activity, BarChart3, Shield,
  DollarSign, TrendingUp, Globe, Blocks, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export interface NewWidgetDef {
  widget_type: string;
  title: string;
  config: Record<string, unknown>;
  width: number;
  height: number;
}

/* ─── Types ─── */

type SourceType = 'services' | 'cloud' | 'saas';

interface ResourceItem {
  id: string;
  name: string;
  icon: string;
  subtitle?: string;
}

interface DataOption {
  id: string;
  label: string;
  icon: typeof Activity;
  widgetType: string;
  metricKey: string;
  width: number;
  height: number;
}

/* ─── Data options per source type ─── */

const SERVICE_DATA_OPTIONS: DataOption[] = [
  { id: 'uptime', label: 'Uptime %', icon: Activity, widgetType: 'big_number', metricKey: 'service_uptime', width: 3, height: 2 },
  { id: 'uptime_chart', label: 'Uptime (chart)', icon: LineChart, widgetType: 'uptime_chart', metricKey: 'service_uptime', width: 6, height: 3 },
  { id: 'response_time', label: 'Response time', icon: BarChart3, widgetType: 'big_number', metricKey: 'service_response_time', width: 3, height: 2 },
  { id: 'response_time_chart', label: 'Response time (chart)', icon: LineChart, widgetType: 'response_time_chart', metricKey: 'service_response_time', width: 6, height: 3 },
  { id: 'ssl_expiry', label: 'SSL expiry', icon: Shield, widgetType: 'big_number', metricKey: 'service_ssl_expiry', width: 3, height: 2 },
  { id: 'status', label: 'Status badge', icon: BadgeCheck, widgetType: 'status_badge', metricKey: 'service_status', width: 3, height: 2 },
  { id: 'incidents', label: 'Incidents count', icon: AlertTriangle, widgetType: 'alert_count', metricKey: 'service_incidents_count', width: 3, height: 3 },
];

const CLOUD_DATA_OPTIONS: DataOption[] = [
  { id: 'monthly_cost', label: 'Monthly cost', icon: DollarSign, widgetType: 'big_number', metricKey: 'aws_monthly_cost', width: 3, height: 2 },
  { id: 'cost_trend', label: 'Cost variation', icon: TrendingUp, widgetType: 'big_number', metricKey: 'aws_cost_trend', width: 3, height: 2 },
  { id: 'resource_issues', label: 'Resources with issues', icon: AlertTriangle, widgetType: 'big_number', metricKey: 'cloud_resources_issues', width: 3, height: 2 },
  { id: 'resource_list', label: 'Resource status list', icon: List, widgetType: 'status_list', metricKey: 'cloud_resources_issues', width: 4, height: 3 },
];

const SAAS_DATA_OPTIONS: DataOption[] = [
  { id: 'status', label: 'Status', icon: BadgeCheck, widgetType: 'status_badge', metricKey: 'saas_status', width: 3, height: 2 },
  { id: 'uptime', label: 'Uptime %', icon: Activity, widgetType: 'big_number', metricKey: 'saas_uptime', width: 3, height: 2 },
  { id: 'response_time', label: 'Response time', icon: BarChart3, widgetType: 'big_number', metricKey: 'saas_response_time', width: 3, height: 2 },
  { id: 'incidents', label: 'Recent incidents', icon: AlertTriangle, widgetType: 'alert_count', metricKey: 'saas_incidents', width: 3, height: 3 },
];

/* ─── Component ─── */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (widget: NewWidgetDef) => void;
  isLoading?: boolean;
}

export default function AddWidgetModal({ open, onOpenChange, onAdd, isLoading }: Props) {
  const { data: services = [] } = useServices();
  const { data: integrations = [] } = useIntegrations();
  const { data: saasProviders = [] } = useSaasSubscriptions();

  const [source, setSource] = useState<SourceType | null>(null);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [dataOptionId, setDataOptionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const step = !source ? 1 : !resourceId ? 2 : 3;

  /* Build resource list based on source */
  const resources: ResourceItem[] = useMemo(() => {
    if (source === 'services') {
      return services.map(s => ({
        id: s.id,
        name: s.name,
        icon: s.icon || '🌐',
        subtitle: s.url,
      }));
    }
    if (source === 'cloud') {
      const awsIntegration = integrations.find(i => i.integration_type === 'aws' && i.is_connected);
      if (awsIntegration) {
        return [{
          id: awsIntegration.id,
          name: 'AWS',
          icon: '☁️',
          subtitle: (awsIntegration.config as Record<string, unknown>)?.account_id as string || 'Connected',
        }];
      }
      return [];
    }
    if (source === 'saas') {
      return saasProviders.map(p => ({
        id: p.id,
        name: p.name,
        icon: p.icon || '🔗',
        subtitle: p.url,
      }));
    }
    return [];
  }, [source, services, integrations, saasProviders]);

  const filteredResources = useMemo(() => {
    if (!searchQuery) return resources;
    const q = searchQuery.toLowerCase();
    return resources.filter(r => r.name.toLowerCase().includes(q) || r.subtitle?.toLowerCase().includes(q));
  }, [resources, searchQuery]);

  const dataOptions = useMemo(() => {
    if (source === 'services') return SERVICE_DATA_OPTIONS;
    if (source === 'cloud') return CLOUD_DATA_OPTIONS;
    if (source === 'saas') return SAAS_DATA_OPTIONS;
    return [];
  }, [source]);

  const selectedResource = resources.find(r => r.id === resourceId);
  const selectedData = dataOptions.find(d => d.id === dataOptionId);

  const reset = () => { setSource(null); setResourceId(null); setDataOptionId(null); setSearchQuery(''); };

  const goBack = () => {
    if (step === 3) { setDataOptionId(null); setResourceId(null); }
    else if (step === 2) { setResourceId(null); setSource(null); setSearchQuery(''); }
  };

  const handleAdd = () => {
    if (!source || !resourceId || !selectedData || !selectedResource) return;
    const config: Record<string, unknown> = {
      metric_key: selectedData.metricKey,
      resource_id: resourceId,
      source_type: source,
    };
    if (source === 'cloud') config.source = 'aws';

    onAdd({
      widget_type: selectedData.widgetType,
      title: `${selectedResource.name} — ${selectedData.label}`,
      config,
      width: selectedData.width,
      height: selectedData.height,
    });
    reset();
  };

  const stepLabels = ['Resource type', 'Resource', 'Data'];

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            Add Widget
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-1.5 mb-1">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1">
              <div className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                s <= step ? "bg-primary" : "bg-muted"
              )} />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">
          Step {step}/3 — {stepLabels[step - 1]}
        </p>

        <div className="flex-1 overflow-hidden">
          {/* STEP 1: Resource Type */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">What type of resource?</p>
              <div className="grid grid-cols-3 gap-2">
                <SourceButton
                  icon={<Server className="w-6 h-6" />}
                  label="Services"
                  sublabel={`${services.length} monitored`}
                  selected={source === 'services'}
                  onClick={() => setSource('services')}
                />
                <SourceButton
                  icon={<Cloud className="w-6 h-6" />}
                  label="Cloud"
                  sublabel="AWS, GCP…"
                  selected={source === 'cloud'}
                  onClick={() => setSource('cloud')}
                />
                <SourceButton
                  icon={<Blocks className="w-6 h-6" />}
                  label="SaaS"
                  sublabel={`${saasProviders.length} tracked`}
                  selected={source === 'saas'}
                  onClick={() => setSource('saas')}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Pick Resource */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Pick a {source === 'services' ? 'service' : source === 'cloud' ? 'cloud provider' : 'SaaS'}
              </p>

              {resources.length > 4 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              )}

              <div className="max-h-[340px] overflow-y-auto space-y-1.5 pr-1">
                {filteredResources.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {resources.length === 0
                      ? `No ${source === 'services' ? 'services' : source === 'cloud' ? 'cloud providers' : 'SaaS'} connected yet.`
                      : 'No results.'
                    }
                  </p>
                )}
                {filteredResources.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setResourceId(r.id); setSearchQuery(''); }}
                    className={cn(
                      "flex items-center gap-3 w-full p-3 rounded-md border text-sm transition-all hover:border-primary/40 text-left",
                      resourceId === r.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    )}
                  >
                    <span className="text-lg shrink-0">{r.icon}</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-foreground text-xs block truncate">{r.name}</span>
                      {r.subtitle && (
                        <span className="text-[11px] text-muted-foreground block truncate">{r.subtitle}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Choose Data */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground">What data do you want to display?</p>
                {selectedResource && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    For <span className="font-medium text-foreground">{selectedResource.icon} {selectedResource.name}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {dataOptions.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDataOptionId(d.id)}
                    className={cn(
                      "flex items-center gap-3 w-full p-3.5 rounded-md border text-sm transition-all hover:border-primary/40 text-left",
                      dataOptionId === d.id
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-card text-muted-foreground"
                    )}
                  >
                    <d.icon className="w-4.5 h-4.5 shrink-0" />
                    <span className="font-medium text-xs">{d.label}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider">
                      {d.widgetType === 'big_number' ? 'Number' :
                       d.widgetType.includes('chart') ? 'Chart' :
                       d.widgetType === 'status_badge' ? 'Badge' :
                       d.widgetType === 'status_list' ? 'List' :
                       d.widgetType === 'alert_count' ? 'Count' : ''}
                    </span>
                  </button>
                ))}
              </div>

              {/* Preview */}
              {selectedData && selectedResource && (
                <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Preview</p>
                  <WidgetPreview data={selectedData} resource={selectedResource} />
                </div>
              )}

              <Button
                onClick={handleAdd}
                disabled={!dataOptionId || isLoading}
                className="w-full gradient-primary text-primary-foreground hover:opacity-90"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Add to dashboard
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-components ─── */

function SourceButton({ icon, label, sublabel, selected, onClick }: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-md border text-sm transition-all hover:border-primary/40",
        selected
          ? "border-primary bg-primary/5 text-foreground"
          : "border-border bg-card text-muted-foreground"
      )}
    >
      {icon}
      <span className="font-medium text-xs">{label}</span>
      <span className="text-[10px] text-muted-foreground">{sublabel}</span>
    </button>
  );
}

/* ─── Preview ─── */

function WidgetPreview({ data, resource }: { data: DataOption; resource: ResourceItem }) {
  if (data.widgetType === 'big_number') {
    const mockValues: Record<string, { value: string; unit: string }> = {
      service_uptime: { value: '99.98', unit: '%' },
      service_response_time: { value: '142', unit: 'ms' },
      service_ssl_expiry: { value: '47', unit: 'days' },
      service_incidents_count: { value: '3', unit: '' },
      aws_monthly_cost: { value: '$2,340', unit: '/mo' },
      aws_cost_trend: { value: '+12', unit: '%' },
      cloud_resources_issues: { value: '4', unit: '' },
      saas_uptime: { value: '99.95', unit: '%' },
      saas_response_time: { value: '89', unit: 'ms' },
    };
    const mock = mockValues[data.metricKey] ?? { value: '—', unit: '' };
    return (
      <div className="text-center py-3">
        <p className="text-3xl font-bold text-foreground tracking-tight">
          {mock.value}<span className="text-lg text-muted-foreground ml-1">{mock.unit}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">{resource.name}</p>
      </div>
    );
  }

  if (data.widgetType === 'status_badge') {
    return (
      <div className="flex items-center gap-3 py-3 justify-center">
        <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
        <span className="font-semibold text-foreground text-sm">{resource.name}</span>
        <span className="text-xs px-2 py-0.5 rounded-sm bg-success/10 text-success font-medium">Operational</span>
      </div>
    );
  }

  if (data.widgetType === 'status_list') {
    const items = ['EC2 prod-web', 'RDS main-db', 'S3 assets'];
    return (
      <div className="space-y-1.5 py-1">
        {items.map((name, i) => (
          <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>{i < 2 ? '🟢' : '🟡'}</span>
              <span>{name}</span>
            </div>
            <span className="font-mono">{['OK', 'OK', '⚠️'][i]}</span>
          </div>
        ))}
      </div>
    );
  }

  if (data.widgetType.includes('chart')) {
    return (
      <div className="py-2">
        <p className="text-xs text-muted-foreground mb-2">{resource.name}</p>
        <svg viewBox="0 0 200 50" className="w-full h-12" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            points="0,40 20,35 40,38 60,25 80,30 100,20 120,22 140,15 160,18 180,10 200,12"
          />
          <polyline
            fill="url(#preview-gradient)"
            stroke="none"
            points="0,50 0,40 20,35 40,38 60,25 80,30 100,20 120,22 140,15 160,18 180,10 200,12 200,50"
          />
          <defs>
            <linearGradient id="preview-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  if (data.widgetType === 'alert_count') {
    return (
      <div className="flex flex-col gap-1.5 py-2">
        <div className="flex items-center justify-between text-xs px-2">
          <span className="text-destructive font-medium">🔴 Critical</span>
          <span className="font-bold text-destructive">2</span>
        </div>
        <div className="flex items-center justify-between text-xs px-2">
          <span className="text-warning font-medium">🟡 Warning</span>
          <span className="font-bold text-warning">5</span>
        </div>
      </div>
    );
  }

  return null;
}
