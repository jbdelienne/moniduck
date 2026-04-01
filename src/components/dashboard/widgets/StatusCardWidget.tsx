import { Service } from '@/hooks/use-supabase';
import { SERVICE_STATUS } from '@/lib/status';

export default function StatusCardWidget({ service }: { service: Service | undefined }) {
  if (!service) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Service not found
      </div>
    );
  }

  const cfg = SERVICE_STATUS[service.status] ?? SERVICE_STATUS.unknown;
  const Icon = cfg.icon;

  return (
    <div className="h-full flex flex-col justify-between p-1">
      <div className="flex items-center gap-2">
        <span className="text-lg">{service.icon}</span>
        <span className="font-medium text-sm text-foreground truncate">{service.name}</span>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <Icon className={`w-8 h-8 ${cfg.colorClass}`} />
        <div>
          <p className="text-2xl font-bold text-foreground tracking-tight">
            {service.status === 'unknown' ? '—' : `${service.uptime_percentage ?? 0}%`}
          </p>
          <p className="text-[11px] text-muted-foreground">uptime</p>
        </div>
      </div>
      <div className="text-xs text-muted-foreground font-mono mt-1">
        {(service.avg_response_time ?? 0) > 0 ? `${service.avg_response_time}ms avg` : 'No data yet'}
      </div>
    </div>
  );
}
