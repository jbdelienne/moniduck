import { useState, useMemo } from 'react';
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
import { useSaasUptimeByPeriod, type SaasUptimePeriod } from '@/hooks/use-saas-uptime';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, RefreshCw, Loader2, ExternalLink, Search, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import SearchBar from '@/components/SearchBar';
import { Checkbox } from '@/components/ui/checkbox';

const statusConfig: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  operational: { label: 'Operational', dotClass: 'bg-success', badgeClass: 'bg-success/10 text-success border-success/20' },
  degraded: { label: 'Degraded', dotClass: 'bg-warning', badgeClass: 'bg-warning/10 text-warning border-warning/20' },
  outage: { label: 'Outage', dotClass: 'bg-destructive', badgeClass: 'bg-destructive/10 text-destructive border-destructive/20' },
  unknown: { label: 'Unknown', dotClass: 'bg-muted-foreground', badgeClass: 'bg-muted text-muted-foreground border-border' },
};

export default function StackPage() {
  const { data: dependencies = [], isLoading } = useSaasDependencies();
  const addDep = useAddSaasDependency();
  const deleteDep = useDeleteSaasDependency();
  const forceCheck = useForceCheckSaas();
  const { data: allProviders = [] } = useAllSaasProviders();
  const navigate = useNavigate();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SaasProviderWithSubscription | null>(null);
  const [uptimePeriod] = useState<SaasUptimePeriod>('30d');
  const [search, setSearch] = useState('');

  const providerIds = useMemo(() => dependencies.map(d => d.id), [dependencies]);
  const { data: uptimeByPeriod = {} } = useSaasUptimeByPeriod(providerIds, uptimePeriod);

  const filtered = useMemo(() => {
    if (!search.trim()) return dependencies;
    const q = search.toLowerCase();
    return dependencies.filter(d => d.name.toLowerCase().includes(q));
  }, [dependencies, search]);

  // Catalog modal state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedSaas, setSelectedSaas] = useState<string[]>([]);

  const subscribedProviderIds = new Set(dependencies.map(d => d.id));
  const subscribedUrls = new Set(dependencies.map(d => d.url));

  const filteredKnown = Object.entries(KNOWN_SAAS).filter(([_, saas]) => {
    if (subscribedUrls.has(saas.url)) return false;
    if (catalogSearch && !saas.name.toLowerCase().includes(catalogSearch.toLowerCase())) return false;
    return true;
  });

  const toggleSelect = (key: string) => {
    setSelectedSaas(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleAddSelected = async () => {
    for (const key of selectedSaas) {
      const saas = KNOWN_SAAS[key];
      if (!saas) continue;
      try {
        await addDep.mutateAsync({
          name: saas.name,
          url: saas.url,
          status_page_url: saas.statusPageUrl,
          icon: saas.icon,
          sla_promised: saas.defaultSla,
        });
      } catch (e: any) {
        toast.error(`${saas.name}: ${e.message}`);
      }
    }
    toast.success(`${selectedSaas.length} dependenc${selectedSaas.length > 1 ? 'ies' : 'y'} added`);
    setSelectedSaas([]);
    setCatalogSearch('');
    setAddModalOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDep.mutateAsync(deleteTarget.subscription_id);
    toast.success(`${deleteTarget.name} supprimé`);
    setDeleteTarget(null);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">My SaaS Stack</h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">$ stack --list --watch<span className="cursor-blink"></span></p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search..." />
          <Button onClick={() => setAddModalOpen(true)} className="gap-2 gradient-primary text-primary-foreground hover:opacity-90">
            <Plus className="w-4 h-4" />
            Add dependency
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-foreground mb-1">Aucune dépendance monitorée</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Commence par ajouter les outils SaaS dont ta stack dépend.
          </p>
          <Button onClick={() => setAddModalOpen(true)} className="gap-2 gradient-primary text-primary-foreground hover:opacity-90">
            <Plus className="w-4 h-4" /> Ajouter une dépendance
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(dep => {
            const status = statusConfig[dep.status] ?? statusConfig.unknown;
            const uptime = uptimeByPeriod[dep.id] ?? dep.uptime_percentage ?? 100;
            const delta = uptime - dep.sla_promised;
            const slaBreach = delta < 0;
            const incidents = dep.incidents || [];
            const quarterIncidents = incidents.filter(inc => {
              const d = new Date(inc.date);
              const now = new Date();
              return d >= new Date(now.getFullYear(), now.getMonth() - 3, 1);
            });

            return (
              <div
                key={dep.id}
                onClick={() => navigate(`/stack/${dep.name.toLowerCase().replace(/\s+/g, '-')}`)}
                className="terminal-card p-5 hover:border-primary/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{dep.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{dep.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${status.badgeClass}`}>
                          {status.label}
                        </span>
                      </div>
                      {/* SLA info */}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{dep.sla_promised}% promis</span>
                        <span>—</span>
                        <span className={slaBreach ? 'text-destructive font-medium' : 'text-success'}>
                          {uptime}% réel
                        </span>
                        {slaBreach && (
                          <Badge variant="destructive" className="text-[10px] font-mono">
                            {delta.toFixed(2)}%
                          </Badge>
                        )}
                        <span className="text-muted-foreground/50">•</span>
                        <span>{quarterIncidents.length} incident{quarterIncidents.length !== 1 ? 's' : ''} ce trimestre</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      title="Vérifier maintenant"
                      onClick={() => {
                        forceCheck.mutate(dep.id, {
                          onSuccess: () => toast.success('Check lancé'),
                          onError: (err) => toast.error(err.message),
                        });
                      }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      title="Delete"
                      onClick={() => setDeleteTarget(dep)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Response time and last check */}
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  {(dep.avg_response_time ?? 0) > 0 && (
                    <span className="font-mono text-primary/70">{dep.avg_response_time}ms</span>
                  )}
                  {dep.last_check && (
                    <span>Vérifié {formatDistanceToNow(new Date(dep.last_check), { addSuffix: true }).replace('less than a minute ago', 'à l\'instant')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Catalog Modal */}
      <Dialog open={addModalOpen} onOpenChange={(v) => { if (!v) { setAddModalOpen(false); setSelectedSaas([]); setCatalogSearch(''); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter des dépendances SaaS</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search a tool..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[350px] overflow-y-auto">
              {filteredKnown.map(([key, saas]) => {
                const isSelected = selectedSaas.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleSelect(key)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-primary/30 hover:bg-muted/50'
                    }`}
                  >
                    <span className="text-xl">{saas.icon}</span>
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{saas.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {filteredKnown.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucun résultat</p>
            )}

            {selectedSaas.length > 0 && (
              <Button
                onClick={handleAddSelected}
                disabled={addDep.isPending}
                className="w-full gap-2 gradient-primary text-primary-foreground hover:opacity-90"
              >
                {addDep.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Monitorer la sélection ({selectedSaas.length})
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer {deleteTarget?.name} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette dépendance ne sera plus monitorée dans ton workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
