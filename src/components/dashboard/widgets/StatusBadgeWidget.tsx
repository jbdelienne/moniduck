import { Service } from '@/hooks/use-supabase';
import { formatDistanceToNow } from 'date-fns';
import { SERVICE_STATUS } from '@/lib/status';

export default function StatusBadgeWidget({ service }: { service?: Service }) {
  if (!service) {
    return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Service not found</div>;
  }

  const cfg = SERVICE_STATUS[service.status] ?? SERVICE_STATUS.unknown;
  const Icon = cfg.icon;

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-2 gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xl">{service.icon}</span>
        <span className="font-semibold text-foreground">{service.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${cfg.colorClass}`} />
        <span className={`text-sm px-2.5 py-0.5 rounded-full font-medium ${cfg.colorClass} ${cfg.bgClass}`}>
          {cfg.label}
        </span>
      </div>
      {service.last_check && (
        <p className="text-[10px] text-muted-foreground">
          checked {formatDistanceToNow(new Date(service.last_check), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
