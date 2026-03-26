import { type RefObject, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/hooks/use-workspace';
import { pdf } from '@react-pdf/renderer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { fr, enUS, de } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Activity, Shield, Clock, TrendingUp, Layers, Download, Link2, Cloud } from 'lucide-react';
import { toast } from 'sonner';
import ReportPDF from './ReportPDF';
import type { GeneratedReport } from '@/pages/ReportsPage';

function getDateLocale(lang: string) {
  if (lang === 'fr') return fr;
  if (lang === 'de') return de;
  return enUS;
}

const SAAS_SLA_PROMISES: Record<string, number> = {
  google: 99.9, microsoft: 99.9, aws: 99.99, gcp: 99.95, azure: 99.95, slack: 99.99, stripe: 99.99,
};
const SAAS_LABELS: Record<string, string> = {
  google: 'Google Workspace', microsoft: 'Microsoft 365', aws: 'AWS', gcp: 'Google Cloud', azure: 'Microsoft Azure', slack: 'Slack', stripe: 'Stripe',
};

interface ReportViewProps {
  report: GeneratedReport;
  onBack: () => void;
  contentRef?: RefObject<HTMLDivElement>;
}

export default function ReportView({ report, onBack, contentRef }: ReportViewProps) {
  const { user } = useAuth();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id;
  const { i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);
  const [exporting, setExporting] = useState(false);

  const periodStart = report.periodStart;
  const periodEnd = report.periodEnd;
  const isSaasReport = report.reportType === 'saas';

  // ── Services report data ──
  const { data: services = [] } = useQuery({
    queryKey: ['report-view-services', workspaceId, report.serviceIds],
    queryFn: async () => {
      let query = supabase.from('services').select('*').eq('workspace_id', workspaceId!);
      if (report.serviceIds.length > 0) query = query.in('id', report.serviceIds);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId && !isSaasReport,
  });

  const serviceIds = services.map((s) => s.id);

  const { data: checks = [] } = useQuery({
    queryKey: ['report-view-checks', serviceIds, periodStart, periodEnd],
    queryFn: async () => {
      if (serviceIds.length === 0) return [];
      const allChecks: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('checks')
          .select('*')
          .in('service_id', serviceIds)
          .gte('checked_at', periodStart)
          .lte('checked_at', periodEnd)
          .order('checked_at', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allChecks.push(...(data || []));
        hasMore = (data?.length ?? 0) === pageSize;
        from += pageSize;
      }
      return allChecks;
    },
    enabled: serviceIds.length > 0 && !isSaasReport,
  });

  // ── SaaS report data ──
  const { data: saasProviders = [] } = useQuery({
    queryKey: ['report-view-saas-providers', report.saasProviderIds],
    queryFn: async () => {
      let query = supabase.from('saas_providers').select('*');
      if (report.saasProviderIds.length > 0) query = query.in('id', report.saasProviderIds);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: isSaasReport,
  });

  const saasProviderIds = saasProviders.map((p) => p.id);

  const { data: saasChecks = [] } = useQuery({
    queryKey: ['report-view-saas-checks', saasProviderIds, periodStart, periodEnd],
    queryFn: async () => {
      if (saasProviderIds.length === 0) return [];
      const allChecks: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('saas_checks')
          .select('*')
          .in('saas_provider_id', saasProviderIds)
          .gte('checked_at', periodStart)
          .lte('checked_at', periodEnd)
          .order('checked_at', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allChecks.push(...(data || []));
        hasMore = (data?.length ?? 0) === pageSize;
        from += pageSize;
      }
      return allChecks;
    },
    enabled: saasProviderIds.length > 0 && isSaasReport,
  });

  // ── Real incidents from incidents table (services) ──
  const { data: dbIncidents = [] } = useQuery({
    queryKey: ['report-view-incidents', workspaceId, periodStart, periodEnd, report.serviceIds],
    queryFn: async () => {
      let query = supabase
        .from('incidents')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .gte('started_at', periodStart)
        .lte('started_at', periodEnd)
        .order('started_at', { ascending: false });
      if (report.serviceIds.length > 0) query = query.in('service_id', report.serviceIds);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!workspaceId && !isSaasReport,
  });

  // ── SLA data for services reports ──
  const { data: integrations = [] } = useQuery({
    queryKey: ['report-view-integrations', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integrations')
        .select('id, integration_type, is_connected, last_sync')
        .eq('workspace_id', workspaceId!)
        .eq('is_connected', true);
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId && report.includeSla && !isSaasReport,
  });

  const integrationIds = integrations.map((i) => i.id);
  const { data: syncData = [] } = useQuery({
    queryKey: ['report-view-sync', integrationIds],
    queryFn: async () => {
      if (integrationIds.length === 0) return [];
      const { data, error } = await supabase
        .from('integration_sync_data')
        .select('*')
        .in('integration_id', integrationIds)
        .gte('synced_at', periodStart)
        .lte('synced_at', periodEnd);
      if (error) throw error;
      return data;
    },
    enabled: integrationIds.length > 0 && report.includeSla && !isSaasReport,
  });

  // ── Compute per-service metrics ──
  const serviceMetrics = services.map((service) => {
    const sChecks = checks.filter((c) => c.service_id === service.id);
    const total = sChecks.length;
    const up = sChecks.filter((c) => c.status === 'up').length;
    const uptime = total > 0 ? Math.round((up / total) * 10000) / 100 : null;
    const avgResponse = total > 0
      ? Math.round(sChecks.reduce((sum: number, c: any) => sum + c.response_time, 0) / total)
      : null;

    const incidents: { start: string; end: string; duration: number; cause: string }[] = [];
    let currentInc: { start: string; end: string; cause: string } | null = null;
    for (const check of sChecks) {
      if (check.status === 'down') {
        if (!currentInc) currentInc = { start: check.checked_at, end: check.checked_at, cause: check.error_message || `HTTP ${check.status_code || 'timeout'}` };
        currentInc.end = check.checked_at;
        if (check.error_message) currentInc.cause = check.error_message;
      } else if (currentInc) {
        const dur = Math.round((new Date(currentInc.end).getTime() - new Date(currentInc.start).getTime()) / 60000);
        incidents.push({ ...currentInc, duration: Math.max(dur, 1) });
        currentInc = null;
      }
    }
    if (currentInc) {
      const dur = Math.round((new Date(currentInc.end).getTime() - new Date(currentInc.start).getTime()) / 60000);
      incidents.push({ ...currentInc, duration: Math.max(dur, 1) });
    }
    return { service, uptime, avgResponse, total, incidents };
  });

  // ── Enrich service metrics with real DB incidents ──
  const enrichedServiceMetrics = serviceMetrics.map((m) => {
    const realIncidents = dbIncidents
      .filter((inc: any) => inc.service_id === m.service.id)
      .map((inc: any) => ({
        start: inc.started_at,
        end: inc.resolved_at || new Date().toISOString(),
        duration: inc.duration_minutes || Math.round((new Date(inc.resolved_at || new Date()).getTime() - new Date(inc.started_at).getTime()) / 60000),
        cause: inc.error_message || (inc.status_code ? `HTTP ${inc.status_code}` : 'Service unavailable'),
        statusCode: inc.status_code || null,
        resolvedAt: inc.resolved_at || null,
        isFromDb: true,
      }));

    // Use DB incidents if available, otherwise fall back to check-derived incidents
    const finalIncidents = realIncidents.length > 0 ? realIncidents : m.incidents.map(inc => ({ ...inc, statusCode: null, resolvedAt: inc.end, isFromDb: false }));
    return { ...m, incidents: finalIncidents };
  });

  // ── Compute per-SaaS provider metrics ──
  const saasMetrics = saasProviders.map((provider) => {
    const pChecks = saasChecks.filter((c: any) => c.saas_provider_id === provider.id);
    const total = pChecks.length;
    const up = pChecks.filter((c: any) => c.status === 'operational' || c.status === 'up').length;
    const uptime = total > 0 ? Math.round((up / total) * 10000) / 100 : null;
    const avgResponse = total > 0
      ? Math.round(pChecks.reduce((sum: number, c: any) => sum + c.response_time, 0) / total)
      : null;

    // Use incidents from provider.incidents JSON field
    const providerIncidents = Array.isArray(provider.incidents) ? (provider.incidents as any[]) : [];
    const parsedProviderIncidents = providerIncidents
      .filter((inc: any) => {
        const incDate = new Date(inc.started_at || inc.start || inc.date);
        return incDate >= new Date(periodStart) && incDate <= new Date(periodEnd);
      })
      .map((inc: any) => ({
        start: inc.started_at || inc.start || inc.date,
        end: inc.resolved_at || inc.end || inc.date,
        duration: inc.duration_minutes || inc.duration || 0,
        cause: inc.description || inc.cause || inc.title || 'Provider incident',
        statusCode: inc.status_code || null,
        resolvedAt: inc.resolved_at || inc.end || null,
        isFromDb: true,
      }));

    // Fall back to check-derived incidents if no stored incidents
    const checkDerivedIncidents: { start: string; end: string; duration: number; cause: string; statusCode: string | null; resolvedAt: string | null; isFromDb: boolean }[] = [];
    let currentInc: { start: string; end: string; cause: string } | null = null;
    for (const check of pChecks) {
      if (check.status === 'down') {
        if (!currentInc) currentInc = { start: check.checked_at, end: check.checked_at, cause: check.error_message || `HTTP ${check.status_code || 'timeout'}` };
        currentInc.end = check.checked_at;
        if (check.error_message) currentInc.cause = check.error_message;
      } else if (currentInc) {
        const dur = Math.round((new Date(currentInc.end).getTime() - new Date(currentInc.start).getTime()) / 60000);
        checkDerivedIncidents.push({ ...currentInc, duration: Math.max(dur, 1), statusCode: null, resolvedAt: currentInc.end, isFromDb: false });
        currentInc = null;
      }
    }
    if (currentInc) {
      const dur = Math.round((new Date(currentInc.end).getTime() - new Date(currentInc.start).getTime()) / 60000);
      checkDerivedIncidents.push({ ...currentInc, duration: Math.max(dur, 1), statusCode: null, resolvedAt: currentInc.end, isFromDb: false });
    }

    const finalIncidents = parsedProviderIncidents.length > 0 ? parsedProviderIncidents : checkDerivedIncidents;

    const slaPromised = provider.sla_promised_default ?? 99.9;
    return { provider, uptime, avgResponse, total, incidents: finalIncidents, slaPromised };
  });

  // ── Global stats ──
  const metrics = isSaasReport ? saasMetrics : enrichedServiceMetrics;
  const validUptimes = metrics.filter((m) => m.uptime !== null);
  const globalUptime = validUptimes.length > 0
    ? Math.round(validUptimes.reduce((s, m) => s + (m.uptime ?? 0), 0) / validUptimes.length * 100) / 100
    : 0;
  const totalIncidents = metrics.reduce((s, m) => s + m.incidents.length, 0);

  const allIncidents = metrics
    .flatMap((m) =>
      m.incidents.map((inc) => ({
        ...inc,
        serviceName: 'service' in m ? (m as any).service.name : (m as any).provider.name,
        serviceIcon: 'service' in m ? (m as any).service.icon : (m as any).provider.icon,
      }))
    )
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

  // SLA data for services reports
  const slaRows = report.includeSla && !isSaasReport
    ? integrations.map((integ) => {
        const promised = SAAS_SLA_PROMISES[integ.integration_type] ?? 99.9;
        const uptimeMetrics = syncData.filter((d) => d.integration_id === integ.id && d.metric_key === 'uptime_percent');
        const realSla = uptimeMetrics.length > 0
          ? Math.round(uptimeMetrics.reduce((s, d) => s + Number(d.metric_value), 0) / uptimeMetrics.length * 100) / 100
          : null;
        return { provider: SAAS_LABELS[integ.integration_type] || integ.integration_type, promised, real: realSla, delta: realSla !== null ? Math.round((realSla - promised) * 100) / 100 : null };
      })
    : [];

  const getUptimeBadge = (uptime: number | null) => {
    if (uptime === null) return <Badge variant="secondary">N/A</Badge>;
    if (uptime >= 99.9) return <Badge className="bg-success text-success-foreground">{uptime}%</Badge>;
    if (uptime >= 99) return <Badge className="bg-warning text-warning-foreground">{uptime}%</Badge>;
    return <Badge className="bg-destructive text-destructive-foreground">{uptime}%</Badge>;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    return `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? `${minutes % 60}min` : ''}`;
  };

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try {
      const pdfServiceMetrics = (isSaasReport ? saasMetrics : enrichedServiceMetrics).map((m) => ({
        name: 'service' in m ? (m as any).service.name : (m as any).provider.name,
        icon: 'service' in m ? (m as any).service.icon : (m as any).provider.icon,
        uptime: m.uptime,
        avgResponse: m.avgResponse,
        incidents: m.incidents,
      }));
      const pdfAllIncidents = allIncidents.map((inc) => ({
        serviceName: inc.serviceName, start: inc.start, duration: inc.duration, cause: inc.cause,
        statusCode: inc.statusCode || null, resolvedAt: inc.resolvedAt || null,
      }));
      const blob = await pdf(
        <ReportPDF
          periodLabel={report.periodLabel}
          createdAt={report.createdAt}
          globalUptime={globalUptime}
          totalIncidents={totalIncidents}
          servicesCount={metrics.length}
          serviceMetrics={pdfServiceMetrics}
          allIncidents={pdfAllIncidents}
          slaRows={isSaasReport ? saasMetrics.map(m => ({
            provider: m.provider.name,
            promised: m.slaPromised,
            real: m.uptime,
            delta: m.uptime !== null ? Math.round((m.uptime - m.slaPromised) * 100) / 100 : null,
          })) : slaRows}
          includeSla={isSaasReport || report.includeSla}
          reportType={report.reportType}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moniduck-report-${report.reportType}-${report.period}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF exported');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  }, [serviceMetrics, saasMetrics, allIncidents, report, globalUptime, totalIncidents, metrics.length, slaRows, isSaasReport]);

  const handleShareLink = useCallback(() => {
    if (!report.shareToken) { toast.error('No share token available'); return; }
    const url = `https://moniduck.io/reports/shared/${report.shareToken}`;
    navigator.clipboard.writeText(url);
    toast.success('Public link copied to clipboard');
  }, [report.shareToken]);

  const itemsLabel = isSaasReport ? 'Providers' : 'Services';

  return (
    <div className="space-y-6" ref={contentRef}>
      {/* Back + title + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              {isSaasReport ? <Cloud className="w-4 h-4 text-primary" /> : null}
              Report — {report.periodLabel}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isSaasReport ? 'SaaS Providers' : 'Services'} · Generated {format(new Date(report.createdAt), 'PPPp', { locale: dateLocale })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting} className="gap-1.5">
            <Download className="w-4 h-4" /> Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleShareLink} className="gap-1.5">
            <Link2 className="w-4 h-4" /> Share
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{globalUptime}%</p>
            <p className="text-xs text-muted-foreground">Global Uptime</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Shield className="w-5 h-5 text-destructive mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{totalIncidents}</p>
            <p className="text-xs text-muted-foreground">Incidents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-bold text-foreground">{report.periodLabel}</p>
            <p className="text-xs text-muted-foreground">Period</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Layers className="w-5 h-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{metrics.length}</p>
            <p className="text-xs text-muted-foreground">{itemsLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* Uptime table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            {isSaasReport ? 'SaaS Providers Uptime' : 'Services Uptime'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No {itemsLabel.toLowerCase()} in scope</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isSaasReport ? 'Provider' : 'Service'}</TableHead>
                  <TableHead className="text-right">Uptime %</TableHead>
                  <TableHead className="text-right">Incidents</TableHead>
                  <TableHead className="text-right">Avg Response</TableHead>
                  {isSaasReport && <TableHead className="text-right">SLA Promised</TableHead>}
                  {isSaasReport && <TableHead className="text-right">Delta</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isSaasReport ? saasMetrics.map(({ provider, uptime, avgResponse, incidents, slaPromised }) => {
                  const delta = uptime !== null ? Math.round((uptime - slaPromised) * 100) / 100 : null;
                  return (
                    <TableRow key={provider.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{provider.icon}</span>
                          <span className="font-medium text-foreground">{provider.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{getUptimeBadge(uptime)}</TableCell>
                      <TableCell className="text-right">
                        {incidents.length > 0 ? <Badge variant="destructive" className="text-xs">{incidents.length}</Badge> : <span className="text-success">✓</span>}
                      </TableCell>
                      <TableCell className="text-right text-foreground">{avgResponse !== null ? `${avgResponse}ms` : '—'}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{slaPromised}%</TableCell>
                      <TableCell className="text-right">
                        {delta !== null ? (
                          <span className={delta >= 0 ? 'text-success' : 'text-destructive'}>
                            {delta >= 0 ? '+' : ''}{delta}%
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                }) : serviceMetrics.map(({ service, uptime, avgResponse, incidents }) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{service.icon}</span>
                        <span className="font-medium text-foreground">{service.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{getUptimeBadge(uptime)}</TableCell>
                    <TableCell className="text-right">
                      {incidents.length > 0 ? <Badge variant="destructive" className="text-xs">{incidents.length}</Badge> : <span className="text-success">✓</span>}
                    </TableCell>
                    <TableCell className="text-right text-foreground">{avgResponse !== null ? `${avgResponse}ms` : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Incidents Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-destructive" />
            Incidents Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allIncidents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No incidents during this period 🎉</p>
          ) : (
            <div className="space-y-2">
              {allIncidents.map((inc, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{inc.serviceIcon}</span>
                    <div>
                      <p className="font-medium text-foreground text-sm">{inc.serviceName}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(inc.start), 'PPp', { locale: dateLocale })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground max-w-[200px] truncate">{inc.cause}</span>
                    <Badge variant="destructive" className="text-xs whitespace-nowrap">
                      <Clock className="w-3 h-3 mr-1" />{formatDuration(inc.duration)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SLA section for services reports */}
      {report.includeSla && !isSaasReport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              SaaS Providers SLA
            </CardTitle>
          </CardHeader>
          <CardContent>
            {slaRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No connected SaaS integrations</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Promised SLA</TableHead>
                    <TableHead className="text-right">Measured SLA</TableHead>
                    <TableHead className="text-right">Delta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slaRows.map((row) => (
                    <TableRow key={row.provider}>
                      <TableCell className="font-medium text-foreground">{row.provider}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.promised}%</TableCell>
                      <TableCell className="text-right">
                        {row.real !== null ? getUptimeBadge(row.real) : <Badge variant="secondary">N/A</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.delta !== null ? (
                          <span className={row.delta >= 0 ? 'text-success' : 'text-destructive'}>
                            {row.delta >= 0 ? '+' : ''}{row.delta}%
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
