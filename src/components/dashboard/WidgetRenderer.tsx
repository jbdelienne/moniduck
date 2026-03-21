import { Service } from '@/hooks/use-supabase';
import { SyncMetric } from '@/hooks/use-all-sync-data';
import { SaasProvider } from '@/hooks/use-saas-dependencies';
import StatusCardWidget from './widgets/StatusCardWidget';
import UptimeChartWidget from './widgets/UptimeChartWidget';
import ResponseTimeChartWidget from './widgets/ResponseTimeChartWidget';
import AlertListWidget from './widgets/AlertListWidget';
import ServiceTableWidget from './widgets/ServiceTableWidget';
import IntegrationMetricCardWidget from './widgets/IntegrationMetricCardWidget';
import DriveStorageGaugeWidget from './widgets/DriveStorageGaugeWidget';
import BigNumberWidget from './widgets/BigNumberWidget';
import StatusBadgeWidget from './widgets/StatusBadgeWidget';
import StatusListWidget from './widgets/StatusListWidget';
import AlertCountWidget from './widgets/AlertCountWidget';

export interface WidgetConfig {
  id: string;
  widget_type: string;
  title: string;
  config: {
    service_id?: string;
    resource_id?: string;
    source_type?: string;
    metric_key?: string;
    source?: string;
    [key: string]: unknown;
  };
  width: number;
  height: number;
}

interface WidgetRendererProps {
  widget: WidgetConfig;
  services: Service[];
  syncMetrics?: SyncMetric[];
  saasProviders?: SaasProvider[];
}

export default function WidgetRenderer({ widget, services, syncMetrics = [], saasProviders = [] }: WidgetRendererProps) {
  const { service_id, resource_id, source_type } = widget.config;

  // Resolve service from either service_id or resource_id (for services source type)
  const resolvedServiceId = service_id || (source_type === 'services' ? resource_id : undefined);
  const service = resolvedServiceId
    ? services.find((s) => s.id === resolvedServiceId)
    : undefined;

  // Resolve SaaS provider for saas source type
  const saasProvider = source_type === 'saas' && resource_id
    ? saasProviders.find((p) => p.id === resource_id)
    : undefined;

  // Create a service-like object from SaaS provider for widgets that expect a Service
  const serviceOrSaas: Service | undefined = service ?? (saasProvider ? {
    id: saasProvider.id,
    name: saasProvider.name,
    icon: saasProvider.icon,
    status: saasProvider.status === 'operational' ? 'up' : saasProvider.status === 'down' ? 'down' : saasProvider.status === 'degraded' ? 'degraded' : 'unknown',
    url: saasProvider.url,
    uptime_percentage: saasProvider.uptime_percentage,
    avg_response_time: saasProvider.avg_response_time,
    last_check: saasProvider.last_check,
    // Fill required fields with defaults
    user_id: '',
    check_interval: 0,
    is_paused: true,
    created_at: saasProvider.created_at,
    updated_at: saasProvider.created_at,
    workspace_id: null,
    owner_id: null,
    alert_email_enabled: false,
    alert_checks_threshold: 0,
    maintenance_until: null,
    consecutive_failures: 0,
    alert_notify_down: false,
    alert_notify_up: false,
    visibility: 'public',
    notification_email: null,
    ssl_expiry_date: null,
    ssl_issuer: null,
    content_keyword: null,
    tags: null,
    alert_email: null,
  } as Service : undefined);

  switch (widget.widget_type) {
    case 'big_number':
      return (
        <BigNumberWidget
          metricKey={widget.config.metric_key ?? ''}
          service={serviceOrSaas}
          services={services}
          syncMetrics={syncMetrics}
          period={(widget.config.period as any) ?? '24h'}
        />
      );
    case 'status_badge':
      return <StatusBadgeWidget service={serviceOrSaas} />;
    case 'status_list':
      return <StatusListWidget />;
    case 'alert_count':
      return <AlertCountWidget />;
    case 'status_card':
      return <StatusCardWidget service={serviceOrSaas} />;
    case 'uptime_chart':
      return <UptimeChartWidget serviceId={resolvedServiceId ?? ''} title={widget.title} />;
    case 'response_time_chart':
      return <ResponseTimeChartWidget serviceId={resolvedServiceId ?? ''} title={widget.title} />;
    case 'alert_list':
      return <AlertListWidget />;
    case 'service_table':
      return <ServiceTableWidget />;
    case 'integration_metric':
      return <IntegrationMetricCardWidget metricKey={widget.config.metric_key ?? ''} metrics={syncMetrics} />;
    case 'drive_storage_gauge':
      return <DriveStorageGaugeWidget metrics={syncMetrics} />;
    default:
      return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Unknown widget</div>;
  }
}