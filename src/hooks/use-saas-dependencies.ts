import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SaasIncident {
  date: string;
  title: string;
  duration_minutes: number;
  severity: 'minor' | 'major' | 'critical';
}

export interface SaasProvider {
  id: string;
  name: string;
  url: string;
  status_page_url: string | null;
  icon: string;
  sla_promised_default: number;
  // Merged final status (ping + status page)
  status: string;
  // Raw sources
  ping_status: string;
  status_page_status: string;
  consecutive_ping_failures: number;
  // Uptime
  uptime_percentage: number;       // alias of uptime_from_ping, kept for compat
  uptime_from_ping: number;
  uptime_from_statuspage: number;
  avg_response_time: number;
  last_check: string | null;
  incidents: SaasIncident[];
  created_at: string;
  added_by: string;
}

export interface SaasSubscription {
  id: string;
  workspace_id: string;
  user_id: string;
  saas_provider_id: string;
  sla_promised_override: number | null;
  created_at: string;
}

export interface SaasProviderWithSubscription extends SaasProvider {
  subscription_id: string;
  sla_promised: number; // override or default
}

// Known SaaS with pre-filled status page URLs (suggestions)
export const KNOWN_SAAS: Record<string, { name: string; icon: string; url: string; statusPageUrl: string; defaultSla: number }> = {
  stripe: { name: 'Stripe', icon: '💳', url: 'https://stripe.com', statusPageUrl: 'https://status.stripe.com', defaultSla: 99.99 },
  github: { name: 'GitHub', icon: '🐙', url: 'https://github.com', statusPageUrl: 'https://www.githubstatus.com', defaultSla: 99.95 },
  vercel: { name: 'Vercel', icon: '▲', url: 'https://vercel.com', statusPageUrl: 'https://www.vercel-status.com', defaultSla: 99.99 },
  slack: { name: 'Slack', icon: '💬', url: 'https://slack.com', statusPageUrl: 'https://status.slack.com', defaultSla: 99.99 },
  datadog: { name: 'Datadog', icon: '🐕', url: 'https://www.datadoghq.com', statusPageUrl: 'https://status.datadoghq.com', defaultSla: 99.9 },
  twilio: { name: 'Twilio', icon: '📱', url: 'https://www.twilio.com', statusPageUrl: 'https://status.twilio.com', defaultSla: 99.95 },
  sendgrid: { name: 'SendGrid', icon: '📧', url: 'https://sendgrid.com', statusPageUrl: 'https://status.sendgrid.com', defaultSla: 99.95 },
  cloudflare: { name: 'Cloudflare', icon: '🛡️', url: 'https://www.cloudflare.com', statusPageUrl: 'https://www.cloudflarestatus.com', defaultSla: 99.99 },
  linear: { name: 'Linear', icon: '📋', url: 'https://linear.app', statusPageUrl: 'https://linearstatus.com', defaultSla: 99.9 },
  notion: { name: 'Notion', icon: '📝', url: 'https://www.notion.so', statusPageUrl: 'https://status.notion.so', defaultSla: 99.9 },
  supabase_saas: { name: 'Supabase', icon: '⚡', url: 'https://supabase.com', statusPageUrl: 'https://status.supabase.com', defaultSla: 99.99 },
  resend: { name: 'Resend', icon: '✉️', url: 'https://resend.com', statusPageUrl: 'https://resend-status.com', defaultSla: 99.9 },
};

/**
 * Get all SaaS providers the current workspace is subscribed to,
 * joined with the provider data.
 */
export function useSaasDependencies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['saas_subscriptions', user?.id],
    queryFn: async () => {
      // Get workspace
      const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('user_id', user!.id)
        .single();

      if (!profile?.workspace_id) return [];

      // Get subscriptions
      const { data: subs, error: subsError } = await supabase
        .from('user_saas_subscriptions' as any)
        .select('*')
        .eq('workspace_id', profile.workspace_id);
      if (subsError) throw subsError;
      if (!subs || subs.length === 0) return [];

      // Get all provider IDs
      const providerIds = (subs as any[]).map((s: any) => s.saas_provider_id);

      // Get providers
      const { data: providers, error: provError } = await supabase
        .from('saas_providers' as any)
        .select('*')
        .in('id', providerIds);
      if (provError) throw provError;

      const providerMap = new Map((providers as any[]).map((p: any) => [p.id, p]));

      return (subs as any[]).map((sub: any) => {
        const prov = providerMap.get(sub.saas_provider_id);
        if (!prov) return null;
        return {
          ...prov,
          incidents: Array.isArray(prov.incidents) ? prov.incidents : [],
          subscription_id: sub.id,
          sla_promised: sub.sla_promised_override ?? prov.sla_promised_default,
        } as SaasProviderWithSubscription;
      }).filter(Boolean) as SaasProviderWithSubscription[];
    },
    enabled: !!user,
    refetchInterval: 60000,
  });
}

/**
 * Get all existing SaaS providers (for the "add" modal search)
 */
export function useAllSaasProviders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['saas_providers_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saas_providers' as any)
        .select('*')
        .order('name');
      if (error) throw error;
      return (data as unknown as SaasProvider[]);
    },
    enabled: !!user,
  });
}

/**
 * Add a SaaS: creates provider if not exists + subscribes workspace
 */
export function useAddSaasDependency() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      name: string;
      url: string;
      status_page_url?: string;
      icon?: string;
      sla_promised?: number;
    }) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('user_id', user!.id)
        .single();
      if (!profile?.workspace_id) throw new Error('No workspace');

      // Normalize URL
      let normalizedUrl = params.url.trim();
      if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`;

      // Check if provider already exists by URL
      const { data: existing } = await supabase
        .from('saas_providers' as any)
        .select('id')
        .eq('url', normalizedUrl)
        .maybeSingle();

      let providerId: string;

      if (existing) {
        providerId = (existing as any).id;
      } else {
        // Create provider
        const { data: newProvider, error: insertError } = await supabase
          .from('saas_providers' as any)
          .insert({
            name: params.name,
            url: normalizedUrl,
            status_page_url: params.status_page_url || null,
            icon: params.icon || '📦',
            sla_promised_default: params.sla_promised || 99.9,
            added_by: user!.id,
          } as any)
          .select()
          .single();
        if (insertError) throw insertError;
        providerId = (newProvider as any).id;
      }

      // Check if already subscribed
      const { data: existingSub } = await supabase
        .from('user_saas_subscriptions' as any)
        .select('id')
        .eq('workspace_id', profile.workspace_id)
        .eq('saas_provider_id', providerId)
        .maybeSingle();

      if (existingSub) throw new Error('Already subscribed to this SaaS');

      // Subscribe
      const { error: subError } = await supabase
        .from('user_saas_subscriptions' as any)
        .insert({
          workspace_id: profile.workspace_id,
          user_id: user!.id,
          saas_provider_id: providerId,
          sla_promised_override: params.sla_promised || null,
        } as any);
      if (subError) throw subError;

      return providerId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saas_subscriptions'] });
      qc.invalidateQueries({ queryKey: ['saas_providers_all'] });
    },
  });
}

/**
 * Unsubscribe from a SaaS (does not delete the provider)
 */
export function useDeleteSaasDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { error } = await supabase
        .from('user_saas_subscriptions' as any)
        .delete()
        .eq('id', subscriptionId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saas_subscriptions'] }),
  });
}

/**
 * Force check a specific SaaS provider
 */
export function useForceCheckSaas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (providerId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-saas?provider_id=${providerId}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Check failed');
      }
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saas_subscriptions'] });
    },
  });
}

/**
 * Update SLA override for a subscription
 */
export function useUpdateSlaOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subscriptionId, sla }: { subscriptionId: string; sla: number | null }) => {
      const { error } = await supabase
        .from('user_saas_subscriptions' as any)
        .update({ sla_promised_override: sla } as any)
        .eq('id', subscriptionId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saas_subscriptions'] }),
  });
}
