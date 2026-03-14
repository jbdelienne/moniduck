import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/hooks/use-workspace';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, subDays, subMonths } from 'date-fns';
import { fr, enUS, de } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { FileText, Plus, Eye, Download, Link2, CalendarIcon, Trash2, Globe, Cloud } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ReportView from '@/components/reports/ReportView';

type PeriodOption = '7d' | '30d' | '3m' | 'custom';
type ReportType = 'services' | 'saas';

export interface GeneratedReport {
  id: string;
  createdAt: string;
  period: string;
  periodLabel: string;
  scope: string;
  includeSla: boolean;
  serviceIds: string[];
  saasProviderIds: string[];
  reportType: ReportType;
  periodStart: string;
  periodEnd: string;
  shareToken?: string;
}

function getDateLocale(lang: string) {
  if (lang === 'fr') return fr;
  if (lang === 'de') return de;
  return enUS;
}

const PERIOD_LABELS: Record<PeriodOption, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '3m': 'Last 3 months',
  'custom': 'Custom range',
};

export default function ReportsPage() {
  const { user } = useAuth();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id;
  const { i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);
  const queryClient = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewingReport, setViewingReport] = useState<GeneratedReport | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const reportViewRef = useRef<HTMLDivElement>(null);

  // Form state
  const [reportType, setReportType] = useState<ReportType>('services');
  const [period, setPeriod] = useState<PeriodOption>('7d');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [scopeAll, setScopeAll] = useState(true);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedSaasIds, setSelectedSaasIds] = useState<string[]>([]);
  const [includeSla, setIncludeSla] = useState(false);

  // Fetch saved reports from DB
  const { data: reports = [] } = useQuery({
    queryKey: ['saved-reports', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_reports')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        createdAt: r.created_at,
        period: r.period,
        periodLabel: r.period_label,
        scope: r.scope,
        includeSla: r.include_sla,
        serviceIds: r.service_ids || [],
        saasProviderIds: r.saas_provider_ids || [],
        reportType: (r.report_type || 'services') as ReportType,
        periodStart: r.period_start,
        periodEnd: r.period_end,
        shareToken: r.share_token,
      })) as GeneratedReport[];
    },
    enabled: !!workspaceId,
  });

  // Save report mutation
  const saveReportMutation = useMutation({
    mutationFn: async (report: GeneratedReport) => {
      const { error } = await supabase.from('saved_reports').insert({
        id: report.id,
        workspace_id: workspaceId!,
        created_by: user!.id,
        period: report.period,
        period_label: report.periodLabel,
        period_start: report.periodStart,
        period_end: report.periodEnd,
        scope: report.scope,
        include_sla: report.includeSla,
        service_ids: report.serviceIds,
        report_type: report.reportType,
        saas_provider_ids: report.saasProviderIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-reports', workspaceId] });
    },
  });

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase.from('saved_reports').delete().eq('id', reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-reports', workspaceId] });
      toast.success('Report deleted');
    },
  });

  // Fetch services for scope selector
  const { data: services = [] } = useQuery({
    queryKey: ['report-services', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, icon')
        .eq('workspace_id', workspaceId!);
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  // Fetch SaaS providers for scope selector
  const { data: saasProviders = [] } = useQuery({
    queryKey: ['report-saas-providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saas_providers')
        .select('id, name, icon')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleSaas = (id: string) => {
    setSelectedSaasIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    let periodLabel = PERIOD_LABELS[period];
    if (period === 'custom' && customFrom && customTo) {
      periodLabel = `${format(customFrom, 'dd/MM/yyyy')} → ${format(customTo, 'dd/MM/yyyy')}`;
    }

    const items = reportType === 'services' ? services : saasProviders;
    const selectedIds = reportType === 'services' ? selectedServiceIds : selectedSaasIds;

    const scopeLabel = scopeAll
      ? reportType === 'services' ? 'All services' : 'All SaaS providers'
      : items
          .filter((s) => selectedIds.includes(s.id))
          .map((s) => s.name)
          .join(', ') || 'None';

    const now = new Date();
    let pStart: Date;
    if (period === '7d') pStart = subDays(now, 7);
    else if (period === '30d') pStart = subDays(now, 30);
    else if (period === '3m') pStart = subMonths(now, 3);
    else pStart = customFrom!;
    const pEnd = period === 'custom' ? customTo! : now;

    const newReport: GeneratedReport = {
      id: crypto.randomUUID(),
      createdAt: now.toISOString(),
      period: period,
      periodLabel,
      scope: scopeLabel,
      includeSla,
      reportType,
      serviceIds: reportType === 'services' ? (scopeAll ? [] : [...selectedServiceIds]) : [],
      saasProviderIds: reportType === 'saas' ? (scopeAll ? [] : [...selectedSaasIds]) : [],
      periodStart: pStart.toISOString(),
      periodEnd: pEnd.toISOString(),
    };

    try {
      await saveReportMutation.mutateAsync(newReport);
      toast.success('Report generated & saved');
    } catch (e) {
      toast.error('Failed to save report');
    }

    setDrawerOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setReportType('services');
    setPeriod('7d');
    setCustomFrom(undefined);
    setCustomTo(undefined);
    setScopeAll(true);
    setSelectedServiceIds([]);
    setSelectedSaasIds([]);
    setIncludeSla(false);
  };

  const handleCopyLink = (report: GeneratedReport) => {
    if (!report.shareToken) {
      toast.error('No share token available');
      return;
    }
    const url = `https://moniduck.io/reports/shared/${report.shareToken}`;
    navigator.clipboard.writeText(url);
    toast.success('Public link copied to clipboard');
  };

  const isGenerateDisabled =
    (period === 'custom' && (!customFrom || !customTo)) ||
    (!scopeAll && reportType === 'services' && selectedServiceIds.length === 0) ||
    (!scopeAll && reportType === 'saas' && selectedSaasIds.length === 0);

  return (
    <>
      <div className="space-y-6">
        {viewingReport ? (
          <ReportView report={viewingReport} onBack={() => setViewingReport(null)} contentRef={reportViewRef} />
        ) : (
          <>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate and export monitoring reports
            </p>
          </div>
          <Button onClick={() => setDrawerOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Report
          </Button>
        </div>

        {/* Reports Table */}
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-foreground">No reports yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click "New Report" to generate your first monitoring report.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      {format(new Date(report.createdAt), 'PPp', { locale: dateLocale })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {report.reportType === 'saas' ? <Cloud className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                        {report.reportType === 'saas' ? 'SaaS' : 'Services'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{report.periodLabel}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {report.scope}
                      {report.includeSla && (
                        <Badge variant="outline" className="ml-2 text-xs">SLA</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="View" onClick={() => setViewingReport(report)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Copy link" onClick={() => handleCopyLink(report)}>
                          <Link2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete" onClick={() => deleteReportMutation.mutate(report.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
          </>
        )}
      </div>

      {/* New Report Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Report</SheetTitle>
            <SheetDescription>
              Configure and generate a monitoring report.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Report Type */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Report Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={reportType === 'services' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setReportType('services'); setScopeAll(true); setSelectedSaasIds([]); }}
                  className="gap-1.5 text-xs"
                >
                  <Globe className="w-3.5 h-3.5" />
                  Services
                </Button>
                <Button
                  type="button"
                  variant={reportType === 'saas' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setReportType('saas'); setScopeAll(true); setSelectedServiceIds([]); }}
                  className="gap-1.5 text-xs"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  SaaS Providers
                </Button>
              </div>
            </div>

            {/* Period */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Period</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['7d', '30d', '3m', 'custom'] as PeriodOption[]).map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    variant={period === opt ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPeriod(opt)}
                    className="text-xs"
                  >
                    {PERIOD_LABELS[opt]}
                  </Button>
                ))}
              </div>

              {period === 'custom' && (
                <div className="flex gap-2 mt-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-xs", !customFrom && "text-muted-foreground")}>
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        {customFrom ? format(customFrom, 'dd/MM/yyyy') : 'From'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-xs", !customTo && "text-muted-foreground")}>
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        {customTo ? format(customTo, 'dd/MM/yyyy') : 'To'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Scope */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Scope</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="scope-all"
                  checked={scopeAll}
                  onCheckedChange={(checked) => {
                    setScopeAll(!!checked);
                    if (checked) { setSelectedServiceIds([]); setSelectedSaasIds([]); }
                  }}
                />
                <Label htmlFor="scope-all" className="text-sm cursor-pointer">
                  {reportType === 'services' ? 'All services' : 'All SaaS providers'}
                </Label>
              </div>

              {!scopeAll && reportType === 'services' && (
                <div className="space-y-2 pl-1 max-h-48 overflow-y-auto border border-border rounded-md p-3">
                  {services.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No services found</p>
                  ) : (
                    services.map((service) => (
                      <div key={service.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`svc-${service.id}`}
                          checked={selectedServiceIds.includes(service.id)}
                          onCheckedChange={() => toggleService(service.id)}
                        />
                        <Label htmlFor={`svc-${service.id}`} className="text-sm cursor-pointer flex items-center gap-1.5">
                          <span>{service.icon}</span>
                          {service.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              )}

              {!scopeAll && reportType === 'saas' && (
                <div className="space-y-2 pl-1 max-h-48 overflow-y-auto border border-border rounded-md p-3">
                  {saasProviders.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No SaaS providers found</p>
                  ) : (
                    saasProviders.map((provider) => (
                      <div key={provider.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`saas-${provider.id}`}
                          checked={selectedSaasIds.includes(provider.id)}
                          onCheckedChange={() => toggleSaas(provider.id)}
                        />
                        <Label htmlFor={`saas-${provider.id}`} className="text-sm cursor-pointer flex items-center gap-1.5">
                          <span>{provider.icon}</span>
                          {provider.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* SLA Toggle — only for services reports */}
            {reportType === 'services' && (
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Include SaaS providers SLA</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add SLA comparison from connected integrations
                  </p>
                </div>
                <Switch checked={includeSla} onCheckedChange={setIncludeSla} />
              </div>
            )}

            {/* Generate */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerateDisabled}
              className="w-full"
            >
              Generate
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
