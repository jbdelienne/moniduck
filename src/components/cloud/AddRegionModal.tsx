import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Check, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  CLOUD_REGIONS, PROVIDER_ICONS, PROVIDER_LABELS,
  useCloudRegionFavorites, CloudRegion,
} from '@/hooks/use-cloud-regions';
import { toast } from 'sonner';

interface AddRegionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddRegionModal({ open, onOpenChange }: AddRegionModalProps) {
  const { favorites, toggleFavorite } = useCloudRegionFavorites();
  const [search, setSearch] = useState('');

  const isFavorite = (provider: string, code: string) =>
    favorites.some(f => f.provider === provider && f.region_code === code);

  const filtered = useMemo(() => {
    if (!search.trim()) return CLOUD_REGIONS;
    const q = search.toLowerCase();
    return CLOUD_REGIONS.filter(r =>
      r.code.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.location.toLowerCase().includes(q) ||
      PROVIDER_LABELS[r.provider].toLowerCase().includes(q)
    );
  }, [search]);

  const handleToggle = (region: CloudRegion) => {
    const wasFav = isFavorite(region.provider, region.code);
    toggleFavorite.mutate(
      { provider: region.provider, regionCode: region.code },
      {
        onSuccess: () => {
          toast.success(wasFav ? `${region.code} removed` : `${region.code} added`);
        },
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setSearch(''); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a region</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search by region code, name or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-80 overflow-y-auto -mx-6 px-6 space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No regions found.</p>
          ) : (
            filtered.map((region) => {
              const added = isFavorite(region.provider, region.code);
              return (
                <div
                  key={`${region.provider}-${region.code}`}
                  className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base shrink-0">{PROVIDER_ICONS[region.provider]}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-foreground">{region.code}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono shrink-0 ${
                            region.provider === 'aws'
                              ? 'border-orange-500/30 text-orange-400'
                              : region.provider === 'gcp'
                              ? 'border-blue-500/30 text-blue-400'
                              : 'border-green-500/30 text-green-400'
                          }`}
                        >
                          {PROVIDER_LABELS[region.provider]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{region.location}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={added ? 'secondary' : 'outline'}
                    className="shrink-0 gap-1.5 text-xs"
                    onClick={() => handleToggle(region)}
                    disabled={toggleFavorite.isPending}
                  >
                    {added ? (
                      <><Check className="w-3 h-3" /> Added</>
                    ) : (
                      <><Plus className="w-3 h-3" /> Add</>
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
