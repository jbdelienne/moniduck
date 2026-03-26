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
  incident_title?: string | null;
  incident_description?: string | null;
  affected_services?: string[] | null;
  last_incident_at?: string | null;
}

// ─── AWS (RSS feed) ────────────────────────────────────
async function fetchAwsStatuses(): Promise<RegionStatus[]> {
  const awsRegions = [
    "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
    "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-south-1",
    "sa-east-1", "ca-central-1", "me-south-1", "af-south-1",
  ];

  const regionIncidents = new Map<string, { title: string; description: string; date: string }>();

  try {
    const res = await fetch("https://status.aws.amazon.com/rss/all.rss");
    if (!res.ok) throw new Error(`AWS RSS ${res.status}`);
    const xml = await res.text();

    // Simple XML parsing for RSS items
    const items = xml.split("<item>").slice(1);
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    for (const item of items) {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s);
      const guidMatch = item.match(/<guid[^>]*>(.*?)<\/guid>/s);
      const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s);
      const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);

      if (!guidMatch) continue;

      const guid = guidMatch[1];
      const title = titleMatch?.[1] || "AWS Incident";
      const description = descMatch?.[1]?.substring(0, 500) || "";
      const pubDate = dateMatch?.[1] || "";
      const pubTimestamp = new Date(pubDate).getTime();

      // Only consider recent items (last 30 days)
      if (pubTimestamp < thirtyDaysAgo) continue;

      // Extract region from GUID: #servicename-region_timestamp
      const regionMatch = guid.match(/([a-z]{2}-[a-z]+-\d)/);
      if (!regionMatch) continue;

      const regionCode = regionMatch[1];
      if (!awsRegions.includes(regionCode)) continue;

      // Check if this looks resolved
      const lowerDesc = description.toLowerCase();
      const isResolved = lowerDesc.includes("resolved") ||
        lowerDesc.includes("has been resolved") ||
        lowerDesc.includes("is now operating normally") ||
        lowerDesc.includes("recovered");

      if (isResolved) continue;

      // Only keep the most recent incident per region
      const existing = regionIncidents.get(regionCode);
      if (!existing || new Date(pubDate) > new Date(existing.date)) {
        regionIncidents.set(regionCode, {
          title,
          description: description.substring(0, 300),
          date: pubDate,
        });
      }
    }
  } catch (e) {
    console.error("AWS fetch error:", e.message);
  }

  return awsRegions.map((rc) => {
    const incident = regionIncidents.get(rc);
    const title = incident?.title?.toLowerCase() || "";
    const isOutage = title.includes("disruption") || title.includes("outage");

    return {
      provider: "aws",
      region_code: rc,
      status: incident ? (isOutage ? "outage" : "degraded") : "operational",
      incident_title: incident?.title || null,
      incident_description: incident?.description || null,
      last_incident_at: incident ? new Date(incident.date).toISOString() : null,
    };
  });
}

// ─── GCP (incidents.json) ──────────────────────────────
async function fetchGcpStatuses(): Promise<RegionStatus[]> {
  const gcpRegions = [
    "us-central1", "us-east1", "us-east4", "us-west1", "us-west4",
    "europe-west1", "europe-west2", "europe-west3", "europe-west4", "europe-west6", "europe-north1",
    "asia-east1", "asia-southeast1", "asia-northeast1",
    "australia-southeast1", "southamerica-east1",
  ];

  const regionIncidents = new Map<string, { title: string; severity: string; services: string[] }>();

  try {
    const res = await fetch("https://status.cloud.google.com/incidents.json");
    if (!res.ok) throw new Error(`GCP status ${res.status}`);
    const incidents: any[] = await res.json();

    const now = Date.now();

    for (const inc of incidents) {
      // Only active incidents (no end date or end in future)
      const end = inc.end ? new Date(inc.end).getTime() : null;
      if (end && end < now) continue;

      const severity = inc.severity || "medium";
      const title = inc.external_desc || inc.service_name || "GCP Incident";
      const affectedProducts = inc.affected_products || [];
      const serviceNames = affectedProducts.map((p: any) => p.title || "Unknown");

      // Check locations in most_recent_update
      const locations = inc.most_recent_update?.affected_locations || [];
      
      if (locations.length > 0) {
        for (const loc of locations) {
          const locId = (loc.id || loc.title || (typeof loc === 'string' ? loc : '')).toLowerCase();
          for (const region of gcpRegions) {
            if (locId.includes(region) || region.includes(locId)) {
              regionIncidents.set(region, { title, severity, services: serviceNames });
            }
          }
        }
      } else {
        // If no specific location, check description for region mentions
        const desc = (inc.external_desc || "").toLowerCase();
        for (const region of gcpRegions) {
          if (desc.includes(region)) {
            regionIncidents.set(region, { title, severity, services: serviceNames });
          }
        }
        // If truly global incident with no regions specified, mark all as affected
        if (locations.length === 0 && !end) {
          // Only if there are no specific regions mentioned in desc
          const mentionsRegion = gcpRegions.some(r => desc.includes(r));
          if (!mentionsRegion && severity === "high") {
            // Global high-severity incident
            for (const region of gcpRegions) {
              if (!regionIncidents.has(region)) {
                regionIncidents.set(region, { title, severity, services: serviceNames });
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("GCP fetch error:", e.message);
  }

  return gcpRegions.map((rc) => {
    const incident = regionIncidents.get(rc);
    return {
      provider: "gcp",
      region_code: rc,
      status: incident
        ? incident.severity === "high" ? "outage" : "degraded"
        : "operational",
      incident_title: incident?.title?.substring(0, 200) || null,
      affected_services: incident?.services?.length ? [...new Set(incident.services)] : null,
      last_incident_at: incident ? new Date().toISOString() : null,
    };
  });
}

// ─── Azure (RSS feed) ──────────────────────────────────
async function fetchAzureStatuses(): Promise<RegionStatus[]> {
  const azureRegions = [
    "eastus", "eastus2", "westus", "westus2", "centralus",
    "northeurope", "westeurope", "uksouth", "francecentral",
    "germanywestcentral", "swedencentral",
    "southeastasia", "eastasia", "japaneast",
    "australiaeast", "brazilsouth", "canadacentral", "koreacentral", "centralindia",
  ];

  // Azure region name -> slug mapping
  const regionNameMap: Record<string, string> = {
    "east us": "eastus", "east us 2": "eastus2",
    "west us": "westus", "west us 2": "westus2",
    "central us": "centralus", "north europe": "northeurope",
    "west europe": "westeurope", "uk south": "uksouth",
    "france central": "francecentral", "germany west central": "germanywestcentral",
    "sweden central": "swedencentral", "southeast asia": "southeastasia",
    "east asia": "eastasia", "japan east": "japaneast",
    "australia east": "australiaeast", "brazil south": "brazilsouth",
    "canada central": "canadacentral", "korea central": "koreacentral",
    "central india": "centralindia",
  };

  const regionIncidents = new Map<string, { title: string }>();

  try {
    const res = await fetch("https://azure.status.microsoft/en-us/status/feed/");
    if (!res.ok) throw new Error(`Azure RSS ${res.status}`);
    const xml = await res.text();

    const items = xml.split("<item>").slice(1);
    const now = Date.now();
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

    for (const item of items) {
      const titleMatch = item.match(/<title>(.*?)<\/title>/s) || item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s);
      const descMatch = item.match(/<description>(.*?)<\/description>/s) || item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s);
      const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);

      const title = titleMatch?.[1] || "Azure Incident";
      const description = (descMatch?.[1] || "").toLowerCase();
      const pubDate = dateMatch?.[1] || "";
      const pubTimestamp = pubDate ? new Date(pubDate).getTime() : 0;

      if (pubTimestamp < twoDaysAgo) continue;

      // Check resolved
      if (description.includes("resolved") || description.includes("mitigated")) continue;

      // Try to find region mentions
      const fullText = (title + " " + description).toLowerCase();
      for (const [name, slug] of Object.entries(regionNameMap)) {
        if (fullText.includes(name) || fullText.includes(slug)) {
          regionIncidents.set(slug, { title });
        }
      }
    }
  } catch (e) {
    console.error("Azure fetch error:", e.message);
  }

  return azureRegions.map((rc) => {
    const incident = regionIncidents.get(rc);
    return {
      provider: "azure",
      region_code: rc,
      status: incident ? "degraded" : "operational",
      incident_title: incident?.title?.substring(0, 200) || null,
      last_incident_at: incident ? new Date().toISOString() : null,
    };
  });
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
        console.error(`Upsert error ${s.provider}:${s.region_code}:`, error.message);
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
