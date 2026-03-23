import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Status page detection ──────────────────────────

/** Try common status page URL patterns for a given domain */
function guessStatusPageUrls(siteUrl: string): string[] {
  try {
    const u = new URL(siteUrl);
    const domain = u.hostname.replace(/^www\./, "");
    const baseDomain = domain.split(".").slice(-2).join(".");
    const candidates = [
      `https://status.${baseDomain}`,
      `https://${domain}/status`,
      `https://status.${domain}`,
      `https://${baseDomain.replace(".", "")  }status.com`,
      `https://www.${baseDomain.replace(".", "")}status.com`,
    ];
    // De-dup
    return [...new Set(candidates)];
  } catch {
    return [];
  }
}

/** Check if a URL hosts an Atlassian Statuspage (has /api/v2/status.json) */
async function probeAtlassianStatuspage(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/v2/status.json`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
      redirect: "follow",
    });
    if (!res.ok) { await res.text().catch(() => {}); return false; }
    const json = await res.json();
    // Atlassian Statuspage always has status.indicator
    return json?.status?.indicator !== undefined;
  } catch {
    return false;
  }
}

/** Discover the status page URL for a provider by probing common patterns */
async function discoverStatusPageUrl(siteUrl: string): Promise<string | null> {
  const candidates = guessStatusPageUrls(siteUrl);
  for (const candidate of candidates) {
    // First try Atlassian JSON API (fastest signal)
    if (await probeAtlassianStatuspage(candidate)) {
      return candidate;
    }
    // Then try if the page itself loads and looks like a status page
    try {
      const res = await fetch(candidate, {
        signal: AbortSignal.timeout(5000),
        redirect: "follow",
        headers: { "User-Agent": "moniduck/1.0 StatusChecker" },
      });
      if (res.ok) {
        const html = await res.text();
        // Check for common status page indicators in HTML
        const lowerHtml = html.toLowerCase();
        const signals = [
          "all systems operational",
          "system status",
          "service status",
          "operational",
          "statuspage",
          "incident history",
          "uptime",
          "current status",
          "component status",
        ];
        const matchCount = signals.filter((s) => lowerHtml.includes(s)).length;
        if (matchCount >= 2) {
          return candidate;
        }
      }
    } catch {
      // Candidate doesn't resolve, skip
    }
  }
  return null;
}

// ── Atlassian Statuspage JSON API ──────────────────

function getStatuspageApiUrl(statusPageUrl: string): { statusUrl: string; incidentsUrl: string } | null {
  try {
    const u = new URL(statusPageUrl);
    return {
      statusUrl: `${u.origin}/api/v2/status.json`,
      incidentsUrl: `${u.origin}/api/v2/incidents.json`,
    };
  } catch {
    return null;
  }
}

async function fetchAtlassianStatus(statusPageUrl: string): Promise<{
  status: string;
  incidents: Array<{ date: string; title: string; duration_minutes: number; severity: string }>;
  isAtlassian: boolean;
}> {
  const apiUrls = getStatuspageApiUrl(statusPageUrl);
  if (!apiUrls) return { status: "unknown", incidents: [], isAtlassian: false };

  let status = "unknown";
  let isAtlassian = false;
  const incidents: Array<{ date: string; title: string; duration_minutes: number; severity: string }> = [];

  // Fetch status
  try {
    const res = await fetch(apiUrls.statusUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.status?.indicator !== undefined) {
        isAtlassian = true;
        status = mapStatuspageStatus(json.status.indicator);
      }
    } else {
      await res.text().catch(() => {});
    }
  } catch {
    // Not an Atlassian status page or unreachable
  }

  if (!isAtlassian) return { status: "unknown", incidents: [], isAtlassian: false };

  // Fetch incidents
  try {
    const res = await fetch(apiUrls.incidentsUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      const rawIncidents = json.incidents || [];
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      for (const inc of rawIncidents.slice(0, 20)) {
        const createdAt = new Date(inc.created_at);
        if (createdAt < thirtyDaysAgo) continue;

        let durationMinutes = 0;
        if (inc.resolved_at) {
          durationMinutes = Math.round(
            (new Date(inc.resolved_at).getTime() - createdAt.getTime()) / 60000,
          );
        } else {
          durationMinutes = Math.round((now.getTime() - createdAt.getTime()) / 60000);
        }

        incidents.push({
          date: inc.created_at,
          title: inc.name || "Incident",
          duration_minutes: Math.max(durationMinutes, 1),
          severity: mapSeverity(inc.impact || "minor"),
        });
      }
    } else {
      await res.text().catch(() => {});
    }
  } catch {
    // ignore
  }

  return { status, incidents, isAtlassian };
}

// ── HTML scraping fallback ─────────────────────────

async function scrapeStatusFromHtml(statusPageUrl: string): Promise<{
  status: string;
  incidents: Array<{ date: string; title: string; duration_minutes: number; severity: string }>;
}> {
  try {
    const res = await fetch(statusPageUrl, {
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
      headers: { "User-Agent": "moniduck/1.0 StatusChecker" },
    });
    if (!res.ok) {
      await res.text().catch(() => {});
      return { status: "unknown", incidents: [] };
    }
    const html = await res.text();
    const lower = html.toLowerCase();
    // Debug: log first 500 chars to see what we're getting
    console.log(`[scrapeHTML] ${statusPageUrl} → ${html.length} chars, preview: ${html.substring(0, 500)}`);


    // Detect status from common text patterns
    let status: string;
    if (
      lower.includes("all systems operational") ||
      lower.includes("all services are online") ||
      lower.includes("everything is up") ||
      lower.includes("is up and running") ||
      lower.includes("no issues") ||
      lower.includes("systems are go")
    ) {
      status = "operational";
    } else if (
      lower.includes("major outage") ||
      lower.includes("major incident") ||
      lower.includes("service disruption")
    ) {
      status = "outage";
    } else if (
      lower.includes("partial outage") ||
      lower.includes("partial system outage") ||
      lower.includes("some systems")
    ) {
      status = "outage";
    } else if (
      lower.includes("degraded performance") ||
      lower.includes("minor incident") ||
      lower.includes("elevated error") ||
      lower.includes("experiencing issues")
    ) {
      status = "degraded";
    } else if (
      lower.includes("under maintenance") ||
      lower.includes("scheduled maintenance")
    ) {
      status = "degraded";
    } else if (lower.includes("operational")) {
      status = "operational";
    } else {
      status = "unknown";
    }

    return { status, incidents: [] };
  } catch {
    return { status: "unknown", incidents: [] };
  }
}

// ── Helpers ────────────────────────────────────────

function mapStatuspageStatus(indicator: string): string {
  switch (indicator) {
    case "none":
      return "operational";
    case "minor":
      return "degraded";
    case "major":
      return "outage";
    case "critical":
      return "outage";
    default:
      return "unknown";
  }
}

function mapSeverity(impact: string): string {
  switch (impact) {
    case "critical":
      return "critical";
    case "major":
      return "major";
    default:
      return "minor";
  }
}

function calculateSlaFromIncidents(
  incidents: Array<{ date: string; duration_minutes: number }>,
): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const minutesInMonth = (now.getTime() - monthStart.getTime()) / 60000;
  if (minutesInMonth <= 0) return 100;

  let downtimeMinutes = 0;
  for (const inc of incidents) {
    const incDate = new Date(inc.date);
    if (incDate >= monthStart) {
      downtimeMinutes += inc.duration_minutes;
    }
  }

  const sla = ((minutesInMonth - downtimeMinutes) / minutesInMonth) * 100;
  return Math.round(sla * 100) / 100;
}

// ── Main handler ───────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const providerId = url.searchParams.get("provider_id");

    let query = supabase.from("saas_providers").select("*");
    if (providerId) {
      query = query.eq("id", providerId);
    }

    const { data: providers, error } = await query;
    if (error) throw error;
    if (!providers || providers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No SaaS providers to check", checked: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Array<{
      name: string;
      status: string;
      response_time: number;
      status_page_detected: boolean;
    }> = [];

    for (const provider of providers) {
      try {
        // ── 1. HTTP Ping ───────────────────────────
        let pingStatus = "unknown";
        let responseTime = 0;
        let statusCode: number | null = null;
        let errorMessage: string | null = null;

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const start = Date.now();
          const res = await fetch(provider.url, {
            method: "GET",
            signal: controller.signal,
            redirect: "follow",
            headers: { "User-Agent": "moniduck/1.0 SaaS Monitor" },
          });
          clearTimeout(timeout);
          responseTime = Date.now() - start;
          statusCode = res.status;
          // Consume body to avoid leak
          await res.text().catch(() => {});

          if (res.status >= 200 && res.status < 400) {
            pingStatus = "operational";
          } else if (res.status >= 400 && res.status < 500) {
            pingStatus = "degraded";
          } else {
            pingStatus = "outage";
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.includes("abort")) {
            pingStatus = "outage";
            errorMessage = "Timeout (10s)";
          } else {
            pingStatus = "outage";
            errorMessage = errMsg;
          }
        }

        // ── 2. Store check ─────────────────────────
        await supabase.from("saas_checks").insert({
          saas_provider_id: provider.id,
          response_time: responseTime,
          status: pingStatus,
          status_code: statusCode,
          error_message: errorMessage,
        });

        // ── 3. Status page: discover → scrape ──────
        let statusPageUrl = provider.status_page_url;
        let statusPageStatus = "unknown";
        let incidents: Array<{
          date: string;
          title: string;
          duration_minutes: number;
          severity: string;
        }> = [];
        let statusPageDetected = false;

        // Auto-discover status page if not set
        if (!statusPageUrl) {
          console.log(`[${provider.name}] No status page URL — attempting auto-discovery...`);
          const discovered = await discoverStatusPageUrl(provider.url);
          if (discovered) {
            statusPageUrl = discovered;
            statusPageDetected = true;
            console.log(`[${provider.name}] ✓ Discovered status page: ${discovered}`);
          } else {
            console.log(`[${provider.name}] ✗ No status page found`);
          }
        }

        if (statusPageUrl) {
          // Try Atlassian JSON API first
          const atlassian = await fetchAtlassianStatus(statusPageUrl);
          if (atlassian.isAtlassian) {
            statusPageStatus = atlassian.status;
            incidents = atlassian.incidents;
            console.log(`[${provider.name}] Atlassian API → ${statusPageStatus}`);
          } else {
            // Fallback: scrape HTML
            const scraped = await scrapeStatusFromHtml(statusPageUrl);
            statusPageStatus = scraped.status;
            incidents = scraped.incidents;
            console.log(`[${provider.name}] HTML scrape fallback → ${statusPageStatus}`);
          }
        }

        // ── 4. Final status (ping prevails) ────────
        const finalStatus = pingStatus;

        // ── 5. Uptime from recent checks (24h) ────
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentChecks } = await supabase
          .from("saas_checks")
          .select("status")
          .eq("saas_provider_id", provider.id)
          .gte("checked_at", twentyFourHoursAgo);

        let uptimePercentage = 100;
        if (recentChecks && recentChecks.length > 0) {
          const upCount = recentChecks.filter((c: any) => c.status === "operational").length;
          uptimePercentage = Math.round((upCount / recentChecks.length) * 10000) / 100;
        }

        // ── 6. Avg response time (24h) ─────────────
        const { data: recentTimings } = await supabase
          .from("saas_checks")
          .select("response_time")
          .eq("saas_provider_id", provider.id)
          .gte("checked_at", twentyFourHoursAgo)
          .gt("response_time", 0);

        let avgResponseTime = responseTime;
        if (recentTimings && recentTimings.length > 0) {
          const sum = recentTimings.reduce((acc: number, c: any) => acc + c.response_time, 0);
          avgResponseTime = Math.round(sum / recentTimings.length);
        }

        // ── 7. SLA actual ──────────────────────────
        const slaActual =
          incidents.length > 0 ? calculateSlaFromIncidents(incidents) : uptimePercentage;

        // ── 8. Update provider ─────────────────────
        const updatePayload: Record<string, unknown> = {
          status: finalStatus,
          status_page_status: statusPageStatus,
          avg_response_time: avgResponseTime,
          uptime_percentage: uptimePercentage,
          last_check: new Date().toISOString(),
          incidents,
        };

        // Persist discovered status page URL so we don't re-discover every time
        if (statusPageDetected && statusPageUrl) {
          updatePayload.status_page_url = statusPageUrl;
        }

        await supabase.from("saas_providers").update(updatePayload).eq("id", provider.id);

        results.push({
          name: provider.name,
          status: finalStatus,
          response_time: responseTime,
          status_page_detected: statusPageDetected,
        });
      } catch (providerErr) {
        console.error(`Error checking ${provider.name}:`, providerErr);
      }
    }

    return new Response(JSON.stringify({ checked: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("check-saas error:", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
