import { useState } from 'react';
import {
  X, Copy, Check, ExternalLink, Server, HardDrive,
  Cloud, Tag, Clock, DollarSign, Globe, Database, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

/* ─── Types ─── */

export interface CloudResourceDetail {
  id: string;
  name: string;
  arnOrId: string;
  type: string;
  provider: string;
  status: string;
  syncedAt: string;
  instanceType?: string;
  publicIp?: string;
  privateIp?: string;
  stoppedSince?: string;
  storageUsed?: number;
  storageTotal?: number;
  publiclyAccessible?: boolean;
  engine?: string;
  runtime?: string;
  errorRate?: number;
  invocations24h?: number;
  publicAccess?: boolean;
  totalSize?: number;
  requests24h?: number;
  errorRate5xx?: number;
  avgLatency?: number;
  tags?: string[];
  url?: string;
  monthlyCost?: number;
}

interface ResourceSlidePanelProps {
  resource: CloudResourceDetail | null;
  open: boolean;
  onClose: () => void;
}

/* ─── Helpers ─── */

const TYPE_ICONS: Record<string, typeof Server> = {
  ec2: Server,
  s3: HardDrive,
  lambda: Layers,
  rds: Database,
  alb: Globe,
  cloudfront: Globe,
};

function getTypeIcon(type: string) {
  const key = type.toLowerCase();
  for (const [k, v] of Object.entries(TYPE_ICONS)) {
    if (key.includes(k)) return v;
  }
  return Cloud;
}

function getTypeLabel(type: string): string {
  const key = type.toLowerCase();
  if (key.includes('ec2')) return 'EC2 Instance';
  if (key.includes('lambda')) return 'Lambda Function';
  if (key.includes('rds')) return 'RDS Instance';
  if (key.includes('s3')) return 'S3 Bucket';
  if (key.includes('alb')) return 'Load Balancer';
  if (key.includes('cloudfront')) return 'CloudFront';
  return type;
}

/* ─── Component ─── */

export default function ResourceSlidePanel({ resource, open, onClose }: ResourceSlidePanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!resource) return null;

  const Icon = getTypeIcon(resource.type);

  // Build copyable fields depending on resource type
  const identifiers: { label: string; value: string; key: string }[] = [
    { label: 'Resource ID', value: resource.arnOrId, key: 'arn' },
  ];
  if (resource.instanceType) identifiers.push({ label: 'Instance Type', value: resource.instanceType, key: 'instanceType' });
  if (resource.publicIp) identifiers.push({ label: 'Public IP', value: resource.publicIp, key: 'publicIp' });
  if (resource.engine) identifiers.push({ label: 'Engine', value: resource.engine, key: 'engine' });
  if (resource.runtime) identifiers.push({ label: 'Runtime', value: resource.runtime, key: 'runtime' });

  // Metrics section
  const metrics: { label: string; value: string; icon: typeof Server }[] = [];
  if (resource.monthlyCost !== undefined) metrics.push({ label: 'Monthly Cost', value: `$${resource.monthlyCost.toFixed(2)}`, icon: DollarSign });
  if (resource.invocations24h !== undefined) metrics.push({ label: 'Invocations (24h)', value: resource.invocations24h.toLocaleString(), icon: Layers });
  if (resource.errorRate !== undefined) metrics.push({ label: 'Error Rate', value: `${resource.errorRate.toFixed(1)}%`, icon: Layers });
  if (resource.storageUsed !== undefined && resource.storageTotal !== undefined) {
    metrics.push({ label: 'Storage', value: `${resource.storageUsed} / ${resource.storageTotal} GB`, icon: HardDrive });
  }
  if (resource.totalSize !== undefined) metrics.push({ label: 'Total Size', value: `${resource.totalSize} GB`, icon: HardDrive });
  if (resource.requests24h !== undefined) metrics.push({ label: 'Requests (24h)', value: resource.requests24h.toLocaleString(), icon: Globe });
  if (resource.avgLatency !== undefined) {
    const lat = resource.avgLatency > 1000 ? `${(resource.avgLatency / 1000).toFixed(1)}s` : `${resource.avgLatency}ms`;
    metrics.push({ label: 'Avg Latency', value: lat, icon: Clock });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 w-full max-w-xl z-50",
          "bg-card border-l border-border",
          "flex flex-col shadow-2xl",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 border border-primary/20">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground mb-1">{resource.name}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] font-mono uppercase tracking-wider">
                    {getTypeLabel(resource.type)}
                  </Badge>
                  <StatusDot status={resource.status} />
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <QuickStat icon={Cloud} label="Provider" value={resource.provider.toUpperCase()} />
            <QuickStat icon={Clock} label="Last Sync" value={
              resource.syncedAt
                ? formatDistanceToNow(new Date(resource.syncedAt), { addSuffix: true })
                : '—'
            } />
            <QuickStat icon={DollarSign} label="Cost" value={
              resource.monthlyCost !== undefined ? `$${resource.monthlyCost.toFixed(2)}/mo` : '—'
            } />
          </div>
        </div>

        {/* Content */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4 bg-muted/50 border border-border">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="metrics" className="text-xs">Metrics</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6 py-4">
            <TabsContent value="overview" className="mt-0 space-y-6">
              {/* Identifiers with copy */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Identifiers
                </h3>
                <div className="space-y-2">
                  {identifiers.map((item) => (
                    <CopyableRow
                      key={item.key}
                      label={item.label}
                      value={item.value}
                      fieldKey={item.key}
                      copiedField={copiedField}
                      onCopy={handleCopy}
                    />
                  ))}
                </div>
              </div>

              {/* Tags */}
              {resource.tags && resource.tags.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5" />
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {resource.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] font-mono">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Flags */}
              {(resource.publiclyAccessible || resource.publicAccess) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Security
                    </h3>
                    {resource.publiclyAccessible && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                        <Globe className="w-4 h-4 shrink-0" />
                        Publicly accessible
                      </div>
                    )}
                    {resource.publicAccess && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                        <Globe className="w-4 h-4 shrink-0" />
                        Public access enabled
                      </div>
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="metrics" className="mt-0 space-y-6">
              {metrics.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Current Metrics
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {metrics.map((m) => (
                      <div key={m.label} className="p-3 rounded-md bg-muted/30 border border-border">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
                          <m.icon className="w-3 h-3" />
                          {m.label}
                        </div>
                        <p className="text-sm font-bold text-foreground font-mono">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No metrics available</p>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Footer */}
        {resource.url && (
          <div className="p-6 border-t border-border">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(resource.url, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View in AWS Console
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Sub-components ─── */

function QuickStat({ icon: IconComp, label, value }: { icon: typeof Server; label: string; value: string }) {
  return (
    <div className="p-3 rounded-md bg-muted/30 border border-border">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
        <IconComp className="w-3 h-3" />
        {label}
      </div>
      <p className="text-sm font-bold text-foreground truncate">{value}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const isUp = status === 'up' || status === 'running';
  return (
    <span className="flex items-center gap-1.5 text-[10px]">
      <span className={cn("w-2 h-2 rounded-full", isUp ? "bg-success" : "bg-warning")} />
      <span className={isUp ? "text-success" : "text-warning"}>
        {isUp ? 'Running' : status}
      </span>
    </span>
  );
}

function CopyableRow({ label, value, fieldKey, copiedField, onCopy }: {
  label: string;
  value: string;
  fieldKey: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border group">
      <div className="min-w-0 flex-1 mr-3">
        <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
        <p className="text-xs font-mono text-foreground truncate">{value}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onCopy(value, fieldKey)}
      >
        {copiedField === fieldKey ? (
          <Check className="w-3.5 h-3.5 text-success" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </Button>
    </div>
  );
}
