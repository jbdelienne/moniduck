import { useState, useMemo } from 'react';
import { useServices } from '@/hooks/use-supabase';
import { Loader2, Cloud, ChevronDown, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import { formatDistanceToNow } from 'date-fns';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';
import { useLatestSyncMetrics } from '@/hooks/use-all-sync-data';
import { useCostByResource } from '@/hooks/use-cost-by-resource';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ResourceSlidePanel, { type CloudResourceDetail } from '@/components/cloud/ResourceSlidePanel';

const CLOUD_TAGS = ['aws', 'ec2', 's3', 'lambda', 'rds', 'alb', 'cloudfront', 'gcp', 'azure'];

type CostPeriod = 'day' | 'month' | 'year';
const costPeriodLabels: Record<CostPeriod, string> = {
  day: '/jour',
  month: '/mois',
  year: '/an',
};

const AWS_SERVICE_TYPE_MAP: Record<string, string> = {
  'Amazon Elastic Compute Cloud - Compute': 'EC2',
  'Amazon Elastic Compute Cloud': 'EC2',
  'EC2 - Other': 'EC2',
  'Amazon Simple Storage Service': 'S3',
  'AWS Lambda': 'LAMBDA',
  'Amazon Relational Database Service': 'RDS',
  'Elastic Load Balancing': 'ALB',
  'Amazon CloudFront': 'CLOUDFRONT',
};

function getResourceBaseType(type: string): string {
  return type.split(' ')[0].toUpperCase();
}

// Predefined resource type tags for filtering
const RESOURCE_TYPE_TAGS = [
  { key: 'all', label: 'Tout', color: 'bg-primary/10 text-primary border-primary/20' },
  { key: 'EC2', label: 'EC2', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { key: 'RDS', label: 'RDS', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  { key: 'LAMBDA', label: 'Lambda', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { key: 'S3', label: 'S3', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { key: 'ALB', label: 'ALB', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  { key: 'CLOUDFRONT', label: 'CloudFront', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
] as const;

interface CloudResource {
  id: string;
  name: string;
  arnOrId: string;
  type: string;
  provider: string;
  status: string;
  syncedAt: string;
  instanceType?: string;
  publicIp?: string;
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
}

export default function CloudResourcesPage() {
  const { data: services = [], isLoading } = useServices();
  const { t } = useTranslation();
  const [costPeriod, setCostPeriod] = useState<CostPeriod>('month');
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string>('all');
  const [selectedResource, setSelectedResource] = useState<CloudResource | null>(null);

  const cloudServices = useMemo(
    () => services.filter(s => s.tags?.some(tag => CLOUD_TAGS.includes(tag))),
    [services],
  );

  const { data: syncMetrics = [] } = useLatestSyncMetrics();
  const { costByResourceId } = useCostByResource();
  const costByType = useMemo(() => {
    const map: Record<string, number> = {};
    const costMetric = syncMetrics.find(m => m.metric_key === 'aws_cost_by_service');
    if (costMetric?.metadata) {
      const svcs = (costMetric.metadata as Record<string, unknown>).services as Array<{ service: string; cost: number }> | undefined;
      if (svcs) {
        for (const s of svcs) {
          const mappedType = AWS_SERVICE_TYPE_MAP[s.service];
          if (mappedType) {
            map[mappedType] = (map[mappedType] || 0) + s.cost;
          }
        }
      }
    }
    return map;
  }, [syncMetrics]);

  const cloudResources = useMemo(() => {
    const resources: CloudResource[] = [];
    const seenInstanceIds = new Set<string>();

    const extractInstanceId = (url: string): string | null => {
      const m = url.match(/instanceId=(i-[a-f0-9]+)/);
      return m ? m[1] : null;
    };

    for (const s of cloudServices) {
      const tags = s.tags || [];
      const type = tags.find(t => ['ec2', 's3', 'lambda', 'rds', 'alb', 'cloudfront'].includes(t))?.toUpperCase() || 'Unknown';
      const provider = tags.includes('aws') ? 'AWS' : tags.includes('gcp') ? 'GCP' : tags.includes('azure') ? 'Azure' : 'Cloud';
      const instanceId = extractInstanceId(s.url);
      if (instanceId) seenInstanceIds.add(instanceId);

      const arnOrId = instanceId || s.name.replace(/^(EC2|Lambda|RDS|S3|ALB|CLOUDFRONT)\s+/, '');

      let displayName = s.name.replace(/^(EC2|S3|Lambda|RDS|ALB|CLOUDFRONT)\s+/, '');
      if (instanceId) {
        const ec2Detail = syncMetrics.find(m => m.metric_key === 'ec2_instances_detail');
        if (ec2Detail?.metadata) {
          const instances = (ec2Detail.metadata as Record<string, unknown>).instances as Array<{ id: string; name?: string; type?: string; publicIp?: string; state?: string; stateTransitionReason?: string }> | undefined;
          const inst = instances?.find(i => i.id === instanceId);
          if (inst?.name) displayName = inst.name;
          if (inst) {
            resources.push({
              id: s.id, name: displayName, arnOrId, type, provider, status: s.status,
              syncedAt: s.last_check || s.updated_at,
              instanceType: inst.type, publicIp: inst.publicIp,
              stoppedSince: inst.state === 'stopped' ? inst.stateTransitionReason : undefined,
            });
            continue;
          }
        }
      }

      resources.push({ id: s.id, name: displayName, arnOrId, type, provider, status: s.status, syncedAt: s.last_check || s.updated_at });
    }

    // Add from sync metrics
    for (const m of syncMetrics) {
      if (m.metric_key === 'ec2_instances_detail' && m.metadata) {
        const instances = (m.metadata as Record<string, unknown>).instances as Array<{ id: string; type: string; state: string; name?: string; publicIp?: string; stateTransitionReason?: string }> | undefined;
        if (instances) {
          for (const inst of instances) {
            if (seenInstanceIds.has(inst.id)) continue;
            seenInstanceIds.add(inst.id);
            resources.push({
              id: `sync-ec2-${inst.id}`, name: inst.name || inst.id, arnOrId: inst.id,
              type: `EC2 (${inst.type})`, provider: 'AWS',
              status: inst.state === 'running' ? 'up' : inst.state === 'stopped' ? 'down' : 'unknown',
              syncedAt: m.synced_at, instanceType: inst.type, publicIp: inst.publicIp,
              stoppedSince: inst.state === 'stopped' ? inst.stateTransitionReason : undefined,
            });
          }
        }
      }
      if (m.metric_key === 'lambda_total_functions' && m.metadata) {
        const functions = (m.metadata as Record<string, unknown>).functions as Array<{ name: string; runtime: string }> | undefined;
        if (functions) {
          for (const fn of functions) {
            const lambdaName = `Lambda ${fn.name}`;
            if (cloudServices.some(s => s.name === lambdaName)) continue;
            resources.push({
              id: `sync-lambda-${fn.name}`, name: fn.name, arnOrId: fn.name,
              type: `Lambda (${fn.runtime})`, provider: 'AWS', status: 'up',
              syncedAt: m.synced_at, runtime: fn.runtime,
            });
          }
        }
      }
      if (m.metric_key === 'rds_total_instances' && m.metadata) {
        const instances = (m.metadata as Record<string, unknown>).instances as Array<{ id: string; engine: string; status: string; allocatedStorage?: number; publiclyAccessible?: boolean }> | undefined;
        if (instances) {
          for (const inst of instances) {
            const rdsName = `RDS ${inst.id}`;
            if (cloudServices.some(s => s.name === rdsName)) continue;
            resources.push({
              id: `sync-rds-${inst.id}`, name: inst.id, arnOrId: inst.id,
              type: `RDS (${inst.engine})`, provider: 'AWS',
              status: inst.status === 'available' ? 'up' : 'degraded',
              syncedAt: m.synced_at, engine: inst.engine,
              storageTotal: inst.allocatedStorage, publiclyAccessible: inst.publiclyAccessible,
            });
          }
        }
      }
      if (m.metric_key === 's3_total_buckets' && m.metadata) {
        const buckets = (m.metadata as Record<string, unknown>).buckets as string[] | undefined;
        if (buckets) {
          for (const bucket of buckets) {
            if (cloudServices.some(s => s.name === bucket || s.name === `S3 ${bucket}`)) continue;
            resources.push({
              id: `sync-s3-${bucket}`, name: bucket, arnOrId: bucket,
              type: 'S3', provider: 'AWS', status: 'up', syncedAt: m.synced_at,
            });
          }
        }
      }
    }

    return resources;
  }, [cloudServices, syncMetrics]);

  // Count by type for tag badges
  const countByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of cloudResources) {
      const base = getResourceBaseType(r.type);
      counts[base] = (counts[base] || 0) + 1;
    }
    return counts;
  }, [cloudResources]);

  // Filter by active tag + search
  const filteredResources = useMemo(() => {
    let list = cloudResources;
    if (activeTag !== 'all') {
      list = list.filter(r => getResourceBaseType(r.type) === activeTag);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.arnOrId.toLowerCase().includes(q) || r.type.toLowerCase().includes(q));
    }
    return list;
  }, [cloudResources, activeTag, search]);

  // Cost helpers
  type CostResult = { amount: number | null; isExact: boolean };

  const getResourceCost = (resource: CloudResource): CostResult => {
    const exactCost = costByResourceId.get(resource.arnOrId);
    if (exactCost !== undefined) {
      let amount: number;
      switch (costPeriod) {
        case 'day': amount = exactCost / 30; break;
        case 'month': amount = exactCost; break;
        case 'year': amount = exactCost * 12; break;
      }
      return { amount, isExact: true };
    }
    const baseType = getResourceBaseType(resource.type);
    const total30d = costByType[baseType];
    if (total30d === undefined) return { amount: null, isExact: false };
    const count = countByType[baseType] || 1;
    const perResourceMonthly = total30d / count;
    let amount: number;
    switch (costPeriod) {
      case 'day': amount = perResourceMonthly / 30; break;
      case 'month': amount = perResourceMonthly; break;
      case 'year': amount = perResourceMonthly * 12; break;
    }
    return { amount, isExact: false };
  };

  const formatCostDisplay = (cost: CostResult): { text: string; className: string; tooltip?: string } => {
    if (cost.amount === null) return { text: '—', className: 'text-muted-foreground' };
    const formatted = cost.amount < 0.01 ? '< $0.01' : `$${cost.amount.toFixed(2)}`;
    if (cost.isExact) return { text: formatted, className: 'text-foreground' };
    return {
      text: `~${formatted}`,
      className: 'text-muted-foreground',
      tooltip: 'Estimated cost. Enable Resource-level data in AWS Cost Explorer for exact figures.',
    };
  };

  const statusConfig: Record<string, { label: string; dotClass: string }> = {
    up: { label: t('services.operational'), dotClass: 'status-dot-up' },
    down: { label: t('services.down'), dotClass: 'status-dot-down' },
    degraded: { label: t('services.degraded'), dotClass: 'status-dot-degraded' },
    unknown: { label: t('services.pending'), dotClass: 'status-dot-unknown' },
  };

  const StatusCell = ({ status }: { status: string }) => {
    const cfg = statusConfig[status] ?? statusConfig.unknown;
    return (
      <div className="flex items-center gap-2">
        <div className={cfg.dotClass} />
        <span className="text-xs">{cfg.label}</span>
      </div>
    );
  };

  const CostCell = ({ cost }: { cost: CostResult }) => {
    const display = formatCostDisplay(cost);
    if (!display.tooltip) {
      return <TableCell className={`text-right font-mono text-sm ${display.className}`}>{display.text}</TableCell>;
    }
    return (
      <TableCell className="text-right font-mono text-sm">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`cursor-help ${display.className}`}>{display.text}</span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[220px] text-xs">
              {display.tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
    );
  };

  // Get the type tag config for a resource
  const getTypeTag = (resource: CloudResource) => {
    const base = getResourceBaseType(resource.type);
    return RESOURCE_TYPE_TAGS.find(t => t.key === base);
  };

  // Render type-specific detail in a single column
  const renderDetail = (r: CloudResource) => {
    const base = getResourceBaseType(r.type);
    switch (base) {
      case 'EC2':
        return (
          <span className="text-xs text-muted-foreground font-mono">
            {r.instanceType || '—'}
            {r.publicIp && <span className="ml-2 text-muted-foreground/70">• {r.publicIp}</span>}
          </span>
        );
      case 'LAMBDA':
        return (
          <span className="text-xs text-muted-foreground font-mono">
            {r.runtime || '—'}
            {r.errorRate !== undefined && <span className={`ml-2 ${r.errorRate > 5 ? 'text-destructive' : ''}`}>{r.errorRate.toFixed(1)}% err</span>}
          </span>
        );
      case 'RDS':
        return (
          <span className="text-xs text-muted-foreground font-mono">
            {r.engine || '—'}
            {r.storageTotal && <span className="ml-2">{r.storageTotal} GB</span>}
            {r.publiclyAccessible && <span className="ml-2 text-destructive">⚠ public</span>}
          </span>
        );
      case 'S3':
        return (
          <span className="text-xs text-muted-foreground font-mono">
            {r.totalSize !== undefined ? `${(r.totalSize / (1024 ** 3)).toFixed(2)} GB` : '—'}
            {r.publicAccess && <span className="ml-2 text-destructive">⚠ public</span>}
          </span>
        );
      case 'ALB':
      case 'CLOUDFRONT':
        return (
          <span className="text-xs text-muted-foreground font-mono">
            {r.requests24h !== undefined ? `${r.requests24h.toLocaleString()} req` : '—'}
            {r.avgLatency !== undefined && <span className="ml-2">{r.avgLatency > 1000 ? `${(r.avgLatency / 1000).toFixed(1)}s` : `${r.avgLatency}ms`}</span>}
          </span>
        );
      default:
        return <span className="text-xs text-muted-foreground">—</span>;
    }
  };

  // Only show tags that have resources
  const visibleTags = RESOURCE_TYPE_TAGS.filter(
    tag => tag.key === 'all' || (countByType[tag.key] ?? 0) > 0
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cloud Resources</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ressources importées depuis vos cloud providers</p>
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Rechercher par nom ou ID…" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : cloudResources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Cloud className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground mb-2">Aucune ressource cloud importée</p>
          <p className="text-xs text-muted-foreground/70">Connectez un cloud provider depuis l'onglet Intégrations pour voir vos ressources ici.</p>
        </div>
      ) : (
        <>
          {/* Tag filters */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {visibleTags.map(tag => {
              const count = tag.key === 'all' ? cloudResources.length : (countByType[tag.key] ?? 0);
              const isActive = activeTag === tag.key;
              return (
                <button
                  key={tag.key}
                  onClick={() => setActiveTag(tag.key)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all
                    ${isActive
                      ? tag.color + ' ring-1 ring-primary/30'
                      : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'
                    }
                  `}
                >
                  {tag.label}
                  <span className={`text-[10px] font-bold ${isActive ? 'opacity-80' : 'opacity-50'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Unified table */}
          <div className="border border-border rounded-md overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead>Détails</TableHead>
                  <TableHead>Synced</TableHead>
                  <TableHead className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="inline-flex items-center gap-1 hover:text-foreground transition-colors font-medium text-xs">
                          Coût est. ({costPeriodLabels[costPeriod]})
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border z-50">
                        {(Object.keys(costPeriodLabels) as CostPeriod[]).map((p) => (
                          <DropdownMenuItem key={p} onClick={() => setCostPeriod(p)} className={costPeriod === p ? 'bg-accent' : ''}>
                            {costPeriodLabels[p]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      Aucune ressource trouvée
                    </TableCell>
                  </TableRow>
                ) : filteredResources.map((r) => {
                  const cost = getResourceCost(r);
                  const typeTag = getTypeTag(r);
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedResource(r)}>
                      <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                      <TableCell>
                        {typeTag ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${typeTag.color}`}>
                            {typeTag.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{r.type}</span>
                        )}
                      </TableCell>
                      <TableCell><StatusCell status={r.status} /></TableCell>
                      <TableCell>{renderDetail(r)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.syncedAt ? formatDistanceToNow(new Date(r.syncedAt), { addSuffix: true }) : '—'}
                      </TableCell>
                      <CostCell cost={cost} />
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <ResourceSlidePanel
        resource={selectedResource ? {
          ...selectedResource,
          tags: services.find(s => s.id === selectedResource.id)?.tags ?? undefined,
          url: services.find(s => s.id === selectedResource.id)?.url,
          monthlyCost: getResourceCost(selectedResource)?.amount ?? undefined,
        } : null}
        open={!!selectedResource}
        onClose={() => setSelectedResource(null)}
      />
    </div>
  );
}
