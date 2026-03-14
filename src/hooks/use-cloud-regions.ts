import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/hooks/use-workspace';

export interface CloudRegion {
  provider: 'aws' | 'gcp' | 'azure';
  code: string;
  name: string;
  location: string;
  statusUrl: string;
}

// Comprehensive list of cloud provider regions
export const CLOUD_REGIONS: CloudRegion[] = [
  // AWS
  { provider: 'aws', code: 'us-east-1', name: 'US East (N. Virginia)', location: '🇺🇸 Virginia', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'us-east-2', name: 'US East (Ohio)', location: '🇺🇸 Ohio', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'us-west-1', name: 'US West (N. California)', location: '🇺🇸 California', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'us-west-2', name: 'US West (Oregon)', location: '🇺🇸 Oregon', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'eu-west-1', name: 'Europe (Ireland)', location: '🇮🇪 Ireland', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'eu-west-2', name: 'Europe (London)', location: '🇬🇧 London', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'eu-west-3', name: 'Europe (Paris)', location: '🇫🇷 Paris', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'eu-central-1', name: 'Europe (Frankfurt)', location: '🇩🇪 Frankfurt', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'eu-north-1', name: 'Europe (Stockholm)', location: '🇸🇪 Stockholm', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', location: '🇸🇬 Singapore', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'ap-southeast-2', name: 'Asia Pacific (Sydney)', location: '🇦🇺 Sydney', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', location: '🇯🇵 Tokyo', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'ap-northeast-2', name: 'Asia Pacific (Seoul)', location: '🇰🇷 Seoul', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'ap-south-1', name: 'Asia Pacific (Mumbai)', location: '🇮🇳 Mumbai', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'sa-east-1', name: 'South America (São Paulo)', location: '🇧🇷 São Paulo', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'ca-central-1', name: 'Canada (Central)', location: '🇨🇦 Canada', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'me-south-1', name: 'Middle East (Bahrain)', location: '🇧🇭 Bahrain', statusUrl: 'https://health.aws.amazon.com' },
  { provider: 'aws', code: 'af-south-1', name: 'Africa (Cape Town)', location: '🇿🇦 Cape Town', statusUrl: 'https://health.aws.amazon.com' },

  // GCP
  { provider: 'gcp', code: 'us-central1', name: 'Iowa', location: '🇺🇸 Iowa', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'us-east1', name: 'South Carolina', location: '🇺🇸 South Carolina', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'us-east4', name: 'Northern Virginia', location: '🇺🇸 Virginia', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'us-west1', name: 'Oregon', location: '🇺🇸 Oregon', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'us-west4', name: 'Las Vegas', location: '🇺🇸 Las Vegas', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'europe-west1', name: 'Belgium', location: '🇧🇪 Belgium', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'europe-west2', name: 'London', location: '🇬🇧 London', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'europe-west3', name: 'Frankfurt', location: '🇩🇪 Frankfurt', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'europe-west4', name: 'Netherlands', location: '🇳🇱 Netherlands', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'europe-west6', name: 'Zürich', location: '🇨🇭 Zürich', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'europe-north1', name: 'Finland', location: '🇫🇮 Finland', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'asia-east1', name: 'Taiwan', location: '🇹🇼 Taiwan', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'asia-southeast1', name: 'Singapore', location: '🇸🇬 Singapore', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'asia-northeast1', name: 'Tokyo', location: '🇯🇵 Tokyo', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'australia-southeast1', name: 'Sydney', location: '🇦🇺 Sydney', statusUrl: 'https://status.cloud.google.com' },
  { provider: 'gcp', code: 'southamerica-east1', name: 'São Paulo', location: '🇧🇷 São Paulo', statusUrl: 'https://status.cloud.google.com' },

  // Azure
  { provider: 'azure', code: 'eastus', name: 'East US', location: '🇺🇸 Virginia', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'eastus2', name: 'East US 2', location: '🇺🇸 Virginia', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'westus', name: 'West US', location: '🇺🇸 California', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'westus2', name: 'West US 2', location: '🇺🇸 Washington', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'centralus', name: 'Central US', location: '🇺🇸 Iowa', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'northeurope', name: 'North Europe', location: '🇮🇪 Ireland', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'westeurope', name: 'West Europe', location: '🇳🇱 Netherlands', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'uksouth', name: 'UK South', location: '🇬🇧 London', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'francecentral', name: 'France Central', location: '🇫🇷 Paris', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'germanywestcentral', name: 'Germany West Central', location: '🇩🇪 Frankfurt', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'swedencentral', name: 'Sweden Central', location: '🇸🇪 Gävle', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'southeastasia', name: 'Southeast Asia', location: '🇸🇬 Singapore', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'eastasia', name: 'East Asia', location: '🇭🇰 Hong Kong', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'japaneast', name: 'Japan East', location: '🇯🇵 Tokyo', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'australiaeast', name: 'Australia East', location: '🇦🇺 Sydney', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'brazilsouth', name: 'Brazil South', location: '🇧🇷 São Paulo', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'canadacentral', name: 'Canada Central', location: '🇨🇦 Toronto', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'koreacentral', name: 'Korea Central', location: '🇰🇷 Seoul', statusUrl: 'https://status.azure.com' },
  { provider: 'azure', code: 'centralindia', name: 'Central India', location: '🇮🇳 Pune', statusUrl: 'https://status.azure.com' },
];

const PROVIDER_ICONS: Record<string, string> = {
  aws: '🟠',
  gcp: '🔵',
  azure: '🟢',
};

const PROVIDER_LABELS: Record<string, string> = {
  aws: 'AWS',
  gcp: 'Google Cloud',
  azure: 'Microsoft Azure',
};

export { PROVIDER_ICONS, PROVIDER_LABELS };

export function useCloudRegionFavorites() {
  const { user } = useAuth();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id;
  const queryClient = useQueryClient();

  const favoritesQuery = useQuery({
    queryKey: ['cloud-region-favorites', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('cloud_region_favorites')
        .select('*')
        .eq('workspace_id', workspaceId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && !!workspaceId,
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ provider, regionCode }: { provider: string; regionCode: string }) => {
      if (!user || !workspaceId) throw new Error('Not authenticated');
      
      const existing = favoritesQuery.data?.find(
        f => f.provider === provider && f.region_code === regionCode
      );
      
      if (existing) {
        const { error } = await supabase
          .from('cloud_region_favorites')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cloud_region_favorites')
          .insert({
            user_id: user.id,
            workspace_id: workspaceId,
            provider,
            region_code: regionCode,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloud-region-favorites'] });
    },
  });

  return {
    favorites: favoritesQuery.data ?? [],
    isLoading: favoritesQuery.isLoading,
    toggleFavorite,
  };
}
