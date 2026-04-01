import { CheckCircle, XCircle, AlertTriangle, HelpCircle, type LucideIcon } from 'lucide-react';

export interface StatusConfig {
  icon: LucideIcon;
  label: string;
  colorClass: string;
  bgClass: string;
  dotClass: string;
}

/** HTTP services: up / down / degraded / unknown */
export const SERVICE_STATUS: Record<string, StatusConfig> = {
  up:       { icon: CheckCircle,   label: 'Operational', colorClass: 'text-success',         bgClass: 'bg-success/10',     dotClass: 'bg-success' },
  down:     { icon: XCircle,       label: 'Down',        colorClass: 'text-destructive',      bgClass: 'bg-destructive/10', dotClass: 'bg-destructive' },
  degraded: { icon: AlertTriangle, label: 'Degraded',    colorClass: 'text-warning',          bgClass: 'bg-warning/10',     dotClass: 'bg-warning' },
  unknown:  { icon: HelpCircle,    label: 'Unknown',     colorClass: 'text-muted-foreground', bgClass: 'bg-muted',          dotClass: 'bg-muted-foreground' },
};

/** SaaS providers: operational / outage / degraded / unknown */
export const SAAS_STATUS: Record<string, StatusConfig> = {
  operational:        { icon: CheckCircle,   label: 'Operational', colorClass: 'text-success',         bgClass: 'bg-success/10',     dotClass: 'bg-success' },
  outage:             { icon: XCircle,       label: 'Outage',      colorClass: 'text-destructive',      bgClass: 'bg-destructive/10', dotClass: 'bg-destructive' },
  degraded:           { icon: AlertTriangle, label: 'Degraded',    colorClass: 'text-warning',          bgClass: 'bg-warning/10',     dotClass: 'bg-warning' },
  unconfirmed_outage: { icon: AlertTriangle, label: 'Unconfirmed', colorClass: 'text-warning',          bgClass: 'bg-warning/10',     dotClass: 'bg-warning' },
  unknown:            { icon: HelpCircle,    label: 'Unknown',     colorClass: 'text-muted-foreground', bgClass: 'bg-muted',          dotClass: 'bg-muted-foreground' },
};

/** Incident severity icons for status page incidents */
export const INCIDENT_SEVERITY: Record<string, StatusConfig> = {
  critical: { icon: XCircle,       label: 'Critical', colorClass: 'text-destructive', bgClass: 'bg-destructive/15', dotClass: 'bg-destructive' },
  major:    { icon: AlertTriangle, label: 'Major',    colorClass: 'text-warning',     bgClass: 'bg-warning/15',     dotClass: 'bg-warning' },
  minor:    { icon: AlertTriangle, label: 'Minor',    colorClass: 'text-info',        bgClass: 'bg-info/15',        dotClass: 'bg-info' },
};
