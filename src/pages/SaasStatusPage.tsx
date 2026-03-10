import { useState } from 'react';
import {
  useSaasDependencies,
  useAddSaasDependency,
  useDeleteSaasDependency,
  useForceCheckSaas,
  useAllSaasProviders,
  KNOWN_SAAS,
  SaasProviderWithSubscription,
  SaasIncident,
} from '@/hooks/use-saas-dependencies';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, RefreshCw, Loader2, ExternalLink, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import SaasDetailModal from '@/components/dashboard/SaasDetailModal';

const statusConfig: Record<string, { label: string; dotClass: string }> = {
  operational: { label: 'Operational', dotClass: 'status-dot-up' },
  degraded: { label: 'Degraded', dotClass: 'status-dot-degraded' },
  outage: { label: 'Outage', dotClass: 'status-dot-down' },
  unknown: { label: 'Unknown', dotClass: 'status-dot-unknown' },
};

export default function SaasStatusPage() {
  const { data: dependencies = [], isLoading } = useSaasDependencies();
  const addDep = useAddSaasDependency();
  const deleteDep = useDeleteSaasDependency();
  const forceCheck = useForceCheckSaas();
  const { data: allProviders = [] } = useAllSaasProviders();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SaasProviderWithSubscription | null>(null);
  const [incidentTarget, setIncidentTarget] = useState<SaasProviderWithSubscription | null>(null);
  const [detailTarget, setDetailTarget] = useState<SaasProviderWithSubscription | null>(null);

  // Add modal state
  const [searchQuery, setSearchQuery] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customStatusPage, setCustomStatusPage] = useState('');
  const [customIcon, setCustomIcon] = useState('📦');
  const [customSla, setCustomSla] = useState('99.9');

  const subscribedProviderIds = new Set(dependencies.map(d => d.id));

  // Filter known SaaS not yet subscribed
  const filteredKnown = Object.entries(KNOWN_SAAS).filter(([_, saas]) => {
    const existingProvider = allProviders.find(p => p.url === saas.url);
    if (existingProvider && subscribedProviderIds.has(existingProvider.id)) return false;
    if (searchQuery && !saas.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Existing providers not yet subscribed
  const existingNotSubscribed = allProviders.filter(p => {
    if (subscribedProviderIds.has(p.id)) return false;
    // Exclude those already in KNOWN_SAAS list
    const isKnown = Object.values(KNOWN_SAAS).some(k => k.url === p.url);
    if (isKnown) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleAddKnown = async (key: string) => {
    const saas = KNOWN_SAAS[key];
    try {
      await addDep.mutateAsync({
        name: saas.name,
        url: saas.url,
        status_page_url: saas.statusPageUrl,
        icon: saas.icon,
        sla_promised: saas.defaultSla,
      });
      toast.success(`${saas.name} added`);
      setAddModalOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAddExisting = async (provider: any) => {
    try {
      await addDep.mutateAsync({
        name: provider.name,
        url: provider.url,
        status_page_url: provider.status_page_url,
        icon: provider.icon,
        sla_promised: provider.sla_promised_default,
      });
      toast.success(`${provider.name} added`);
      setAddModalOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAddCustom = async () => {
    if (!customName.trim() || !customUrl.trim()) {
      toast.error('Name and URL are required');
      return;
    }
    try {
      await addDep.mutateAsync({
        name: customName.trim(),
        url: customUrl.trim(),
        status_page_url: customStatusPage.trim() || undefined,
        icon: customIcon || '📦',
        sla_promised: parseFloat(customSla) || 99.9,
      });
      toast.success(`${customName} added`);
      setAddModalOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const resetForm = () => {
    setSearchQuery('');
    setCustomMode(false);
    setCustomName('');
    setCustomUrl('');
    setCustomStatusPage('');
    setCustomIcon('📦');
    setCustomSla('99.9');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDep.mutateAsync(deleteTarget.subscription_id);
    toast.success(`${deleteTarget.name} removed`);
    setDeleteTarget(null);
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SaaS Dependencies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor your third-party SaaS providers with HTTP pings and status page data.
          </p>
        </div>
        <Button onClick={() => setAddModalOpen(true)} className="gap-2 gradient-primary text-primary-foreground hover:opacity-90">
          <Plus className="w-4 h-4" />
          Add SaaS
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : dependencies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground mb-4">No SaaS dependencies monitored yet.</p>
          <Button onClick={() => setAddModalOpen(true)} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> Add your first SaaS
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10"></TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Ping Status</TableHead>
                <TableHead>Status Page</TableHead>
                <TableHead className="text-right">Resp. Time</TableHead>
                <TableHead className="text-right">SLA promis</TableHead>
                <TableHead className="text-right">Uptime 24h</TableHead>
                <TableHead className="text-right">Delta</TableHead>
                <TableHead>Incidents</TableHead>
                <TableHead>Dernier check</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dependencies.map((dep) => {
                const pingStatus = statusConfig[dep.status] ?? statusConfig.unknown;
                const pageStatus = statusConfig[dep.status_page_status] ?? statusConfig.unknown;
                const delta = (dep.uptime_percentage ?? 100) - dep.sla_promised;
                const slaBreach = delta < 0;
                const incidents = dep.incidents || [];
                const recentIncidents = incidents.slice(0, 3);

                return (
                  <TableRow key={dep.id}>
                    <TableCell>
                      <span className="text-lg">{dep.icon}</span>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {dep.name}
                        {dep.status_page_url && (
                          <a href={dep.status_page_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-normal truncate max-w-[200px]">{dep.url}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={pingStatus.dotClass} />
                        <span className="text-xs">{pingStatus.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {dep.status_page_url ? (
                        <div className="flex items-center gap-2">
                          <div className={pageStatus.dotClass} />
                          <span className="text-xs">{pageStatus.label}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {(dep.avg_response_time ?? 0) > 0 ? `${dep.avg_response_time}ms` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{dep.sla_promised}%</TableCell>
                    <TableCell className={`text-right font-mono text-sm ${slaBreach ? 'text-destructive font-semibold' : ''}`}>
                      {dep.uptime_percentage ?? 100}%
                    </TableCell>
                    <TableCell className="text-right">
                      {slaBreach ? (
                        <Badge variant="destructive" className="text-xs font-mono">
                          {delta.toFixed(2)}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs font-mono border-emerald-500/30 text-emerald-400">
                          +{delta.toFixed(2)}%
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {recentIncidents.length > 0 ? (
                        <button
                          onClick={() => setIncidentTarget(dep)}
                          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                        >
                          {recentIncidents.length} incident{recentIncidents.length > 1 ? 's' : ''}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dep.last_check
                        ? formatDistanceToNow(new Date(dep.last_check), { addSuffix: true })
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          title="Force check"
                          onClick={() => {
                            forceCheck.mutate(dep.id, {
                              onSuccess: () => toast.success('Check triggered'),
                              onError: (err) => toast.error(err.message),
                            });
                          }}
                          disabled={forceCheck.isPending}
                        >
                          {forceCheck.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          title="Unsubscribe"
                          onClick={() => setDeleteTarget(dep)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add SaaS Modal */}
      <Dialog open={addModalOpen} onOpenChange={(v) => { if (!v) { setAddModalOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add SaaS dependency</DialogTitle>
          </DialogHeader>

          {!customMode ? (
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search or add custom..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Known SaaS list */}
              <div className="max-h-[300px] overflow-y-auto space-y-0.5">
                {filteredKnown.map(([key, saas]) => (
                  <button
                    key={key}
                    onClick={() => handleAddKnown(key)}
                    disabled={addDep.isPending}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-muted transition-colors text-left"
                  >
                    <span className="text-lg">{saas.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{saas.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{saas.url}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">SLA {saas.defaultSla}%</Badge>
                    <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}

                {/* Existing custom providers from other users */}
                {existingNotSubscribed.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => handleAddExisting(provider)}
                    disabled={addDep.isPending}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-muted transition-colors text-left"
                  >
                    <span className="text-lg">{provider.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{provider.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{provider.url}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">Community</Badge>
                    <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}

                {filteredKnown.length === 0 && existingNotSubscribed.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No matching SaaS found.
                  </p>
                )}
              </div>

              {/* Custom button */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setCustomMode(true)}
              >
                <Plus className="w-4 h-4" />
                Add a custom SaaS
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Name *</label>
                <Input
                  placeholder="e.g. My Internal API"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">URL to ping *</label>
                <Input
                  placeholder="https://api.example.com"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Status page URL (optional)</label>
                <Input
                  placeholder="https://status.example.com"
                  value={customStatusPage}
                  onChange={(e) => setCustomStatusPage(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Supports Statuspage.io-compatible pages</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Icon</label>
                  <Input
                    value={customIcon}
                    onChange={(e) => setCustomIcon(e.target.value)}
                    className="text-center text-lg"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">SLA promis (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={customSla}
                    onChange={(e) => setCustomSla(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setCustomMode(false)}>
                  Back
                </Button>
                <Button
                  className="flex-1 gradient-primary text-primary-foreground"
                  onClick={handleAddCustom}
                  disabled={addDep.isPending}
                >
                  {addDep.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Add SaaS
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Incidents Modal */}
      <Dialog open={!!incidentTarget} onOpenChange={(v) => !v && setIncidentTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{incidentTarget?.name} — Incidents</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {(incidentTarget?.incidents || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No incidents recorded.</p>
            ) : (
              (incidentTarget?.incidents || []).map((inc: SaasIncident, i: number) => (
                <div key={i} className="border border-border rounded-sm p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{inc.title}</span>
                    <Badge
                      variant={inc.severity === 'critical' ? 'destructive' : 'outline'}
                      className="text-[10px]"
                    >
                      {inc.severity}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{new Date(inc.date).toLocaleDateString()}</span>
                    <span>{inc.duration_minutes}min</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsubscribe from {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this SaaS from your workspace monitoring. The provider will remain available for other users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Unsubscribe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
