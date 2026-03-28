import { useState, useMemo, useEffect } from 'react';
import {
  Loader2, CheckCircle, Clock, ArrowUpDown, ShieldCheck, ChevronDown, ChevronRight, Timer,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIncidents, sortIncidents, Incident, SortKey } from '@/hooks/use-incidents';
import { PROVIDER_ICONS } from '@/hooks/use-cloud-regions';

type SourceFilter = 'all' | 'service' | 'alert' | 'cloud';

const SORT_LABELS: Record<Exclude<SortKey, 'ongoing_first'>, string> = {
  newest:   'Newest first',
  oldest:   'Oldest first',
  severity: 'By severity',
};

const SOURCE_FILTERS: { key: SourceFilter; label: string }[] = [
  { key: 'all',     label: 'All sources' },
  { key: 'service', label: 'Services' },
  { key: 'alert',   label: 'SaaS' },
  { key: 'cloud',   label: 'Cloud' },
];

const ONGOING_BORDER: Record<string, string> = {
  critical: 'border-red-500/50 ring-1 ring-red-500/10',
  warning:  'border-orange-500/50 ring-1 ring-orange-500/10',
  info:     'border-blue-500/50 ring-1 ring-blue-500/10',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  warning:  'bg-orange-500/10 text-orange-400',
  info:     'bg-blue-500/10 text-blue-400',
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function useLiveMinutes(startedAt: string): number {
  const [minutes, setMinutes] = useState(
    () => Math.round((Date.now() - new Date(startedAt).getTime()) / 60000),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setMinutes(Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
    }, 60_000);
    return () => clearInterval(id);
  }, [startedAt]);
  return minutes;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function IncidentsPage() {
  const { incidents, isLoading } = useIncidents();
  const [source, setSource]   = useState<SourceFilter>('all');
  const [sortKey, setSortKey] = useState<Exclude<SortKey, 'ongoing_first'>>('newest');
  const [resolvedOpen, setResolvedOpen] = useState(false);

  const filtered = useMemo(() => {
    const list = source === 'all' ? incidents : incidents.filter(i => i.source === source);
    return sortIncidents(list, sortKey);
  }, [incidents, source, sortKey]);

  const ongoing  = filtered.filter(i => i.status === 'ongoing');
  const resolved = filtered.filter(i => i.status === 'resolved');

  const lastResolved = resolved[0];
  const allClear     = ongoing.length === 0;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Incidents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Service, SaaS and cloud incidents
          </p>
          <div className="mt-2">
            {allClear ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                All systems operational
                {lastResolved && (
                  <span className="text-green-400/60 font-normal">
                    · last incident {formatDistanceToNow(new Date(lastResolved.startedAt), { addSuffix: true })}
                  </span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {ongoing.length} incident{ongoing.length > 1 ? 's' : ''} in progress
              </span>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 mt-1 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5" />
              {SORT_LABELS[sortKey]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(SORT_LABELS) as Exclude<SortKey, 'ongoing_first'>[]).map(key => (
              <DropdownMenuItem
                key={key}
                onClick={() => setSortKey(key)}
                className={sortKey === key ? 'font-semibold' : ''}
              >
                {SORT_LABELS[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Source filter */}
      <div className="flex items-center gap-1.5 mb-6">
        {SOURCE_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setSource(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              source === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">

          {/* ── Ongoing ── */}
          {ongoing.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                In progress — {ongoing.length}
              </h2>
              <div className="space-y-3">
                {ongoing.map(i => <IncidentCard key={i.id} incident={i} />)}
              </div>
            </section>
          )}

          {/* ── Resolved ── */}
          {resolved.length > 0 && (
            <section>
              <button
                onClick={() => setResolvedOpen(v => !v)}
                className="flex items-center gap-2 mb-3 group"
              >
                {resolvedOpen
                  ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                }
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                  Resolved — {resolved.length}
                </h2>
              </button>

              {resolvedOpen && (
                <div className="space-y-2">
                  {resolved.map(i => <IncidentCard key={i.id} incident={i} />)}
                </div>
              )}
            </section>
          )}

          {/* All clear with no ongoing but has resolved */}
          {allClear && ongoing.length === 0 && resolved.length === 0 && (
            <EmptyState />
          )}
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-7 h-7 text-green-400" />
      </div>
      <p className="font-semibold text-foreground">No incidents</p>
      <p className="text-sm text-muted-foreground mt-1">Everything is running smoothly.</p>
    </div>
  );
}

// ── Incident card ─────────────────────────────────────────────────────────────

function IncidentCard({ incident }: { incident: Incident }) {
  const isOngoing   = incident.status === 'ongoing';
  const liveMinutes = useLiveMinutes(incident.startedAt);

  const borderClass = isOngoing
    ? (ONGOING_BORDER[incident.severity] ?? ONGOING_BORDER.info)
    : 'border-border';

  const cardClass = isOngoing
    ? `bg-card border rounded-xl p-4 transition-all ${borderClass}`
    : `bg-card/50 border border-border/50 rounded-xl p-4 transition-all opacity-60 hover:opacity-80`;

  const icon = incident.source === 'cloud'
    ? (PROVIDER_ICONS[incident.provider!] ?? '☁️')
    : incident.source === 'alert' && incident.integrationIcon
      ? incident.integrationIcon
      : incident.serviceIcon ?? null;

  return (
    <div className={cardClass}>
      <div className="flex items-start gap-3">

        {/* Icon */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base ${
          isOngoing
            ? incident.severity === 'critical' ? 'bg-red-500/10'
              : incident.severity === 'warning' ? 'bg-orange-500/10'
              : 'bg-muted'
            : 'bg-muted'
        }`}>
          {icon ?? (
            <span className={`w-2.5 h-2.5 rounded-full ${
              isOngoing
                ? incident.severity === 'critical' ? 'bg-red-400'
                  : incident.severity === 'warning' ? 'bg-orange-400'
                  : 'bg-blue-400'
                : 'bg-muted-foreground/40'
            }`} />
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{incident.title}</h3>

            {incident.source === 'cloud' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-muted text-muted-foreground">
                {incident.provider?.toUpperCase()} · {incident.regionCode}
              </span>
            )}
            {incident.source === 'service' && incident.statusCode && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-muted text-muted-foreground">
                HTTP {incident.statusCode}
              </span>
            )}
            {incident.hasCorrelation && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-500/10 text-blue-400">
                Correlated
              </span>
            )}
          </div>

          {incident.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{incident.description}</p>
          )}
          {incident.source === 'cloud' && incident.affectedServices?.length ? (
            <p className="text-xs text-muted-foreground mt-1">
              Affected: {incident.affectedServices.join(', ')}
            </p>
          ) : null}

          {/* Time row */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(incident.startedAt), { addSuffix: true })}
            </span>

            {isOngoing ? (
              <span className={`inline-flex items-center gap-1 font-semibold ${
                incident.severity === 'critical' ? 'text-red-400' : 'text-orange-400'
              }`}>
                <Timer className="w-3 h-3" />
                {formatDuration(liveMinutes)}
              </span>
            ) : (
              incident.durationMinutes != null && incident.durationMinutes > 0 && (
                <span>Duration: {formatDuration(incident.durationMinutes)}</span>
              )
            )}

            {incident.resolvedAt && (
              <span>
                Resolved {formatDistanceToNow(new Date(incident.resolvedAt), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>

        {/* Right badges */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            isOngoing ? SEVERITY_BADGE[incident.severity] : 'bg-muted text-muted-foreground'
          }`}>
            {incident.severity}
          </span>
          {!isOngoing && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-500/10 text-green-400">
              Resolved
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
