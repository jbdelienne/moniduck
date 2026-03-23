import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Loader2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCorrelation, CorrelatedEvent } from '@/hooks/use-correlation';

const severityColors: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  major: 'bg-warning/10 text-warning border-warning/20',
  minor: 'bg-muted text-muted-foreground border-muted-foreground/20',
};

const confidenceDot: Record<string, string> = {
  high: 'bg-destructive',
  medium: 'bg-yellow-500',
  low: 'bg-muted-foreground',
};

export default function CorrelationFeedWidget() {
  const { correlations, isLoading } = useCorrelation();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (correlations.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4">
        <Zap className="w-8 h-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No correlations in the last 30 days</p>
        <p className="text-xs text-muted-foreground/60">Add SaaS dependencies to enable correlation</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Incident Correlations
        <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{correlations.length}</span>
      </p>
      <div className="flex-1 space-y-1.5 overflow-y-auto">
        {correlations.slice(0, 12).map((c) => (
          <CorrelationRow key={c.id} event={c} />
        ))}
      </div>
    </div>
  );
}

function CorrelationRow({ event }: { event: CorrelatedEvent }) {
  const leadText =
    event.leadTimeMinutes > 0
      ? `${event.leadTimeMinutes}min before`
      : event.leadTimeMinutes === 0
        ? 'simultaneously'
        : `${Math.abs(event.leadTimeMinutes)}min after`;

  return (
    <div className="flex flex-col gap-1 py-2 px-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      {/* Confidence + timestamp */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${confidenceDot[event.confidence]}`} />
          <span className="text-[10px] text-muted-foreground capitalize">{event.confidence} confidence</span>
        </div>
        <span className="text-[10px] text-muted-foreground/60">
          {formatDistanceToNow(event.httpIncident.startedAt, { addSuffix: true })}
        </span>
      </div>

      {/* SaaS → HTTP flow */}
      <div className="flex items-center gap-1.5 text-xs">
        <div className="flex items-center gap-1 min-w-0 max-w-[40%]">
          <span className="text-sm leading-none flex-shrink-0">{event.saasIncident.providerIcon}</span>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{event.saasIncident.providerName}</p>
            <p className="text-muted-foreground text-[10px] truncate">{event.saasIncident.title}</p>
          </div>
        </div>

        <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-sm leading-none flex-shrink-0">{event.httpIncident.serviceIcon}</span>
            <p className="font-medium text-foreground truncate">{event.httpIncident.serviceName}</p>
          </div>
          <p className="text-muted-foreground text-[10px]">went down</p>
        </div>
      </div>

      {/* Timing + severity */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground/70">{leadText}</span>
        <Badge
          variant="outline"
          className={`text-[9px] px-1 py-0 h-3.5 leading-none ${severityColors[event.saasIncident.severity]}`}
        >
          {event.saasIncident.severity}
        </Badge>
        {event.httpIncident.durationMinutes && (
          <span className="text-[10px] text-muted-foreground/60 ml-auto">
            down {event.httpIncident.durationMinutes}min
          </span>
        )}
      </div>
    </div>
  );
}
