import { useServices } from '@/hooks/use-supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { SERVICE_STATUS } from '@/lib/status';

export default function StatusListWidget({ serviceIds }: { serviceIds?: string[] }) {
  const { data: allServices = [], isLoading } = useServices();

  const services = serviceIds?.length
    ? allServices.filter(s => serviceIds.includes(s.id))
    : allServices;

  if (isLoading) {
    return (
      <div className="h-full flex flex-col gap-1.5 p-1">
        <Skeleton className="h-3 w-24 mb-1" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="w-3.5 h-3.5 rounded-full shrink-0" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    );
  }

  if (services.length === 0) {
    return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No services</div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <p className="text-xs font-medium text-muted-foreground mb-2">Services Status</p>
      <div className="flex-1 overflow-y-auto space-y-1">
        {services.map((s) => {
          const cfg = SERVICE_STATUS[s.status] ?? SERVICE_STATUS.unknown;
          const Icon = cfg.icon;
          return (
            <div key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.colorClass}`} />
                <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
              </div>
              <span className="text-xs text-muted-foreground font-mono shrink-0 ml-2">
                {(s.avg_response_time ?? 0) > 0 ? `${s.avg_response_time}ms` : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
