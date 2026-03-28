import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Star, ExternalLink, RefreshCw, Plus, MapPin } from 'lucide-react';
import {
  CLOUD_REGIONS, PROVIDER_ICONS, PROVIDER_LABELS,
  useCloudRegionFavorites, CloudRegion,
} from '@/hooks/use-cloud-regions';
import { useCloudRegionStatuses } from '@/hooks/use-cloud-region-statuses';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { AddRegionModal } from '@/components/cloud/AddRegionModal';

const statusConfig: Record<string, { label: string; dotClass: string; color: string }> = {
  operational: { label: 'Operational', dotClass: 'status-dot-up', color: 'text-green-400' },
  degraded: { label: 'Degraded', dotClass: 'status-dot-degraded', color: 'text-yellow-400' },
  outage: { label: 'Outage', dotClass: 'status-dot-down', color: 'text-red-400' },
  unknown: { label: 'Unknown', dotClass: 'status-dot-unknown', color: 'text-muted-foreground' },
};

type ProviderFilter = 'all' | 'aws' | 'gcp' | 'azure';

export default function CloudProvidersPage() {
  const { favorites, toggleFavorite } = useCloudRegionFavorites();
  const { statuses, isLoading: statusesLoading } = useCloudRegionStatuses();
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const isFavorite = (provider: string, code: string) =>
    favorites.some(f => f.provider === provider && f.region_code === code);

  const getRegionStatus = (provider: string, code: string) => {
    return statuses.get(`${provider}:${code}`);
  };

  const allAddedRegions = useMemo(() =>
    CLOUD_REGIONS.filter(r => isFavorite(r.provider, r.code))
      .sort((a, b) => a.provider.localeCompare(b.provider) || a.code.localeCompare(b.code)),
  [favorites]);

  const addedRegions = useMemo(() => {
    if (providerFilter === 'all') return allAddedRegions;
    return allAddedRegions.filter(r => r.provider === providerFilter);
  }, [providerFilter, allAddedRegions]);

  const handleToggleFavorite = (region: CloudRegion) => {
    toggleFavorite.mutate(
      { provider: region.provider, regionCode: region.code },
      {
        onSuccess: () => {
          const wasFav = isFavorite(region.provider, region.code);
          toast.success(wasFav ? `${region.code} removed from favorites` : `${region.code} added to favorites`);
        },
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-cloud-regions');
      if (error) throw error;
      toast.success(`Statuses updated (${data?.upserted || 0} regions)`);
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  // Stats based on all added (favorited) regions
  const allAddedStatuses = allAddedRegions.map(r => statuses.get(`${r.provider}:${r.code}`));
  const degradedCount = allAddedStatuses.filter(s => s?.status === 'degraded').length;
  const outageCount = allAddedStatuses.filter(s => s?.status === 'outage').length;
  const operationalCount = allAddedStatuses.filter(s => s?.status === 'operational').length;
  const totalRegions = allAddedRegions.length;

  return (
    <TooltipProvider>
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cloud Providers</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor the cloud regions that matter to you.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setAddModalOpen(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add a region
            </Button>
          </div>
        </div>

        <AddRegionModal open={addModalOpen} onOpenChange={setAddModalOpen} />

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div
            className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setProviderFilter('all')}
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Monitored</p>
            <p className="text-2xl font-bold text-foreground">{totalRegions}</p>
            {totalRegions > 0 && operationalCount > 0 && (
              <p className="text-xs text-green-400 mt-1">{operationalCount} operational</p>
            )}
          </div>
          <div
            className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-orange-500/50 transition-colors"
            onClick={() => setProviderFilter(providerFilter === 'aws' ? 'all' : 'aws')}
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">🟠 AWS</p>
            <p className="text-2xl font-bold text-foreground">
              {allAddedRegions.filter(r => r.provider === 'aws').length}
            </p>
          </div>
          <div
            className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-blue-500/50 transition-colors"
            onClick={() => setProviderFilter(providerFilter === 'gcp' ? 'all' : 'gcp')}
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">🔵 Google Cloud</p>
            <p className="text-2xl font-bold text-foreground">
              {allAddedRegions.filter(r => r.provider === 'gcp').length}
            </p>
          </div>
          <div
            className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-green-500/50 transition-colors"
            onClick={() => setProviderFilter(providerFilter === 'azure' ? 'all' : 'azure')}
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">🟢 Azure</p>
            <p className="text-2xl font-bold text-foreground">
              {allAddedRegions.filter(r => r.provider === 'azure').length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">⚠️ Issues</p>
            <p className="text-2xl font-bold text-foreground">{degradedCount + outageCount}</p>
            {outageCount > 0 && (
              <p className="text-xs text-red-400 mt-1">{outageCount} outage(s)</p>
            )}
            {degradedCount > 0 && (
              <p className="text-xs text-yellow-400 mt-1">{degradedCount} degraded</p>
            )}
            {degradedCount + outageCount === 0 && totalRegions > 0 && (
              <p className="text-xs text-green-400 mt-1">All systems go</p>
            )}
          </div>
        </div>

        {/* Provider filter bar */}
        {allAddedRegions.length > 0 && (
          <div className="flex items-center gap-1 mb-4">
            {(['all', 'aws', 'gcp', 'azure'] as ProviderFilter[]).map(f => (
              <Button
                key={f}
                variant={providerFilter === f ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => setProviderFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'aws' ? '🟠 AWS' : f === 'gcp' ? '🔵 GCP' : '🟢 Azure'}
              </Button>
            ))}
          </div>
        )}

        {/* Table */}
        {addedRegions.length > 0 && (
        <div className="table-container">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uptime 30d</TableHead>
                <TableHead>Last Check</TableHead>
                <TableHead className="text-right">Status Page</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addedRegions.map((region) => {
                const fav = isFavorite(region.provider, region.code);
                const regionStatus = getRegionStatus(region.provider, region.code);
                const st = statusConfig[regionStatus?.status || 'unknown'];
                const uptime = regionStatus?.uptime_30d;
                const lastChecked = regionStatus?.last_checked_at;
                const incidentTitle = regionStatus?.incident_title;

                return (
                  <TableRow key={`${region.provider}-${region.code}`}>
                    <TableCell>
                      <button
                        onClick={() => handleToggleFavorite(region)}
                        className="p-1 rounded hover:bg-accent transition-colors"
                        title={fav ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Star
                          className={`w-4 h-4 transition-colors ${
                            fav
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-muted-foreground hover:text-yellow-400'
                          }`}
                        />
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="text-lg">{PROVIDER_ICONS[region.provider]}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          region.provider === 'aws'
                            ? 'border-orange-500/30 text-orange-400'
                            : region.provider === 'gcp'
                            ? 'border-blue-500/30 text-blue-400'
                            : 'border-green-500/30 text-green-400'
                        }`}
                      >
                        {PROVIDER_LABELS[region.provider]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-foreground font-mono text-sm">
                      {region.code}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {region.location}
                    </TableCell>
                    <TableCell>
                      {incidentTitle ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 cursor-help">
                              <div className={st.dotClass} />
                              <span className={`text-xs ${st.color}`}>{st.label}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="font-medium text-sm">{incidentTitle}</p>
                            {regionStatus?.affected_services?.length ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                Services: {regionStatus.affected_services.join(', ')}
                              </p>
                            ) : null}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className={st.dotClass} />
                          <span className={`text-xs ${st.color}`}>{st.label}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {uptime != null ? (
                        <span className={`text-xs font-mono ${
                          uptime >= 99.9 ? 'text-green-400' :
                          uptime >= 99 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {uptime.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lastChecked ? (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(lastChecked), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={region.statusUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5 inline" />
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        )}

        {/* Empty state */}
        {allAddedRegions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <MapPin className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium mb-1">No regions added yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add the cloud regions you want to monitor.
            </p>
            <Button size="sm" className="gap-2" onClick={() => setAddModalOpen(true)}>
              <Plus className="w-4 h-4" />
              Add a region
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
