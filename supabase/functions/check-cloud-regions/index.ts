import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RegionStatus {
  provider: string;
  region_code: string;
  status: "operational" | "degraded" | "outage" | "unknown";
  incident_title?: string;
  incident_description?: string;
  affected_services?: string[];
  last_incident_at?: string;
}

// ─── AWS ───────────────────────────────────────────────
async function fetchAwsStatuses(): Promise<RegionStatus[]> {
  const results: RegionStatus[] = [];
  try {
    const res = await fetch("https://health.aws.amazon.com/health/status");
    if (!res.ok) throw new Error(`AWS status ${res.status}`);
    const data = await res.json();

    // Build a map of region -> active incidents
    const regionIncidents = new Map<string, { title: string; services: string[] }>();

    // AWS returns archive[] with current_events or similar structure
    const archives = data?.archive || data?.current || [];
    for (const entry of (Array.isArray(archives) ? archives : [])) {
      const serviceName = entry?.service_name || entry?.service || "";
      const description = entry?.description || entry?.summary || "";
      const entryDate = entry?.date || entry?.start || "";

      // Extract region from service name like "Amazon EC2 (eu-west-1)"
      const regionMatch = serviceName.match(/\(([a-z]{2,}-[a-z]+-\d+)\)/);
      if (!regionMatch) continue;

      const regionCode = regionMatch[1];
      const existing = regionIncidents.get(regionCode);
      if (existing) {
        existing.services.push(serviceName.replace(/\s*\([^)]+\)/, ""));
      } else {
        regionIncidents.set(regionCode, {
          title: description?.substring(0, 200) || `Incident in ${regionCode}`,
          services: [serviceName.replace(/\s*\([^)]+\)/, "")],
        });
      }
    }

    // Also check feed items if available
    const feedItems = data?.feed_items || data?.events || [];
    for (const item of (Array.isArray(feedItems) ? feedItems : [])) {
      const status = item?.status || "";
      if (status === "resolved" || status === "closed") continue;

      const regionCode = item?.region || "";
      if (!regionCode) continue;

      const existing = regionIncidents.get(regionCode);
      const title = item?.title || item?.summary || `Incident in ${regionCode}`;
      const service = item?.service || "";
      if (existing) {
        if (service) existing.services.push(service);
      } else {
        regionIncidents.set(regionCode, {
          title,
          services: service ? [service] : [],
        });
      }
    }

    // Known AWS regions
    const awsRegions = [
      "us-east-1", "us-east-2", "us-west-1", "us-west-2",
      "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
      "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-south-1",
      "sa-east-1", "ca-central-1", "me-south-1", "af-south-1",
    ];

    for (const rc of awsRegions) {
      const incident = regionIncidents.get(rc);
      results.push({
        provider: "aws",
        region_code: rc,
        status: incident ? "degraded" : "operational",
        incident_title: incident?.title || null,
        affected_services: incident?.services || null,
        last_incident_at: incident ? new Date().toISOString() : null,
      } as any);
    }
  } catch (e) {
    console.error("AWS fetch error:", e.message);
    // Return empty — we won't overwrite existing data
  }
  return results;
}

// ─── GCP ───────────────────────────────────────────────
async function fetchGcpStatuses(): Promise<RegionStatus[]> {
  const results: RegionStatus[] = [];
  try {
    const res = await fetch("https://status.cloud.google.com/incidents.json");
    if (!res.ok) throw new Error(`GCP status ${res.status}`);
    const incidents = await res.json();

    const gcpRegions = [
      "us-central1", "us-east1", "us-east4", "us-west1", "us-west4",
      "europe-west1", "europe-west2", "europe-west3", "europe-west4", "europe-west6", "europe-north1",
      "asia-east1", "asia-southeast1", "asia-northeast1",
      "australia-southeast1", "southamerica-east1",
    ];

    // Find active incidents (no end time or end in future)
    const regionIncidents = new Map<string, { title: string; services: string[]; severity: string }>();
    const now = Date.now();

    for (const inc of (Array.isArray(incidents) ? incidents : [])) {
      // Check if incident is active
      const end = inc.end ? new Date(inc.end).getTime() : null;
      if (end && end < now) continue;

      const severity = inc.severity || "medium";
      const title = inc.external_desc || inc.service_name || "GCP Incident";
      const affectedProducts = inc.affected_products || [];
      const locations = inc.currently_affected_locations || inc.most_recent_update?.affected_locations || [];

      const serviceNames = affectedProducts.map((p: any) => p.title || p.id || "Unknown");

      for (const loc of locations) {
        const locId = (loc.id || loc.title || loc || "").toLowerCase().replace(/\s+/g, "-");
        for (const region of gcpRegions) {
          if (locId.includes(region) || region.includes(locId)) {
            const existing = regionIncidents.get(region);
            if (existing) {
              existing.services.push(...serviceNames);
            } else {
              regionIncidents.set(region, {
                title: title.substring(0, 200),
                services: [...serviceNames],
                severity,
              });
            }
          }
        }
      }
    }

    for (const rc of gcpRegions) {
      const incident = regionIncidents.get(rc);
      results.push({
        provider: "gcp",
        region_code: rc,
        status: incident
          ? incident.severity === "high" ? "outage" : "degraded"
          : "operational",
        incident_title: incident?.title || null,
        affected_services: incident?.services?.length ? [...new Set(incident.services)] : null,
        last_incident_at: incident ? new Date().toISOString() : null,
      } as any);
    }
  } catch (e) {
    console.error("GCP fetch error:", e.message);
  }
  return results;
}

// ─── Azure ─────────────────────────────────────────────
async function fetchAzureStatuses(): Promise<RegionStatus[]> {
  const results: RegionStatus[] = [];
  try {
    const res = await fetch("https://azure.status.microsoft/api/v2/status.json");
    if (!res.ok) throw new Error(`Azure status ${res.status}`);
    const data = await res.json();

    const azureRegions = [
      "eastus", "eastus2", "westus", "westus2", "centralus",
      "northeurope", "westeurope", "uksouth", "francecentral",
      "germanywestcentral", "swedencentral",
      "southeastasia", "eastasia", "japaneast",
      "australiaeast", "brazilsouth", "canadacentral", "koreacentral", "centralindia",
    ];

    // Azure status JSON: status.geographies[].regions[]
    const regionStatusMap = new Map<string, { status: string; title?: string; services?: string[] }>();

    const geographies = data?.status?.geographies || data?.geographies || [];
    for (const geo of geographies) {
      const regions = geo?.regions || [];
      for (const region of regions) {
        const slug = (region.name || "").toLowerCase().replace(/\s+/g, "");
        const regionStatus = (region.status || "").toLowerCase();

        let mappedStatus: "operational" | "degraded" | "outage" = "operational";
        if (regionStatus.includes("degraded") || regionStatus.includes("warning") || regionStatus.includes("advisory")) {
          mappedStatus = "degraded";
        } else if (regionStatus.includes("outage") || regionStatus.includes("critical") || regionStatus.includes("disruption")) {
          mappedStatus = "outage";
        } else if (regionStatus.includes("good") || regionStatus.includes("healthy") || regionStatus === "1") {
          mappedStatus = "operational";
        }

        // Try to match against known regions
        for (const knownRegion of azureRegions) {
          if (slug.includes(knownRegion) || knownRegion.includes(slug)) {
            if (mappedStatus !== "operational") {
              regionStatusMap.set(knownRegion, {
                status: mappedStatus,
                title: region.statusText || `Azure issue in ${knownRegion}`,
              });
            }
          }
        }
      }
    }

    // Also parse impacts / incidents if present
    const impacts = data?.impacts || data?.incidents || [];
    for (const impact of (Array.isArray(impacts) ? impacts : [])) {
      const affectedRegions = impact?.impactedRegions || impact?.regions || [];
      const title = impact?.title || impact?.name || "Azure Incident";
      const severity = (impact?.severity || impact?.impact || "").toLowerCase();

      for (const r of affectedRegions) {
        const slug = (r.name || r || "").toLowerCase().replace(/\s+/g, "");
        for (const knownRegion of azureRegions) {
          if (slug.includes(knownRegion) || knownRegion.includes(slug)) {
            regionStatusMap.set(knownRegion, {
              status: severity.includes("critical") ? "outage" : "degraded",
              title: title.substring(0, 200),
            });
          }
        }
      }
    }

    for (const rc of azureRegions) {
      const incident = regionStatusMap.get(rc);
      results.push({
        provider: "azure",
        region_code: rc,
        status: incident?.status as any || "operational",
        incident_title: incident?.title || null,
        affected_services: incident?.services || null,
        last_incident_at: incident ? new Date().toISOString() : null,
      } as any);
    }
  } catch (e) {
    console.error("Azure fetch error:", e.message);
  }
  return results;
}

// ─── Main handler ──────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all providers in parallel
    const [awsStatuses, gcpStatuses, azureStatuses] = await Promise.all([
      fetchAwsStatuses(),
      fetchGcpStatuses(),
      fetchAzureStatuses(),
    ]);

    const allStatuses = [...awsStatuses, ...gcpStatuses, ...azureStatuses];
    const now = new Date().toISOString();

    let upserted = 0;
    let errors = 0;

    for (const s of allStatuses) {
      const { error } = await supabase
        .from("cloud_region_status")
        .upsert(
          {
            provider: s.provider,
            region_code: s.region_code,
            status: s.status,
            incident_title: s.incident_title || null,
            incident_description: s.incident_description || null,
            affected_services: s.affected_services || null,
            last_incident_at: s.last_incident_at || null,
            last_checked_at: now,
            updated_at: now,
          },
          { onConflict: "provider,region_code" }
        );

      if (error) {
        console.error(`Upsert error for ${s.provider}:${s.region_code}:`, error.message);
        errors++;
      } else {
        upserted++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        upserted,
        errors,
        total: allStatuses.length,
        breakdown: {
          aws: awsStatuses.length,
          gcp: gcpStatuses.length,
          azure: azureStatuses.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-cloud-regions error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
