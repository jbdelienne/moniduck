import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Try to detect statuspage.io API from a status page URL
function getStatuspageApiUrl(statusPageUrl: string): { statusUrl: string; incidentsUrl: string } | null {
  try {
    const u = new URL(statusPageUrl);
    // Most statuspage.io sites have /api/v2/status.json
    return {
      statusUrl: `${u.origin}/api/v2/status.json`,
      incidentsUrl: `${u.origin}/api/v2/incidents.json`,
    };
  } catch {
    return null;
  }
}

function mapStatuspageStatus(indicator: string): string {
  switch (indicator) {
    case "none": return "operational";
    case "minor": return "degraded";
    case "major": return "outage";
    case "critical": return "outage";
    default: return "unknown";
  }
}

function mapSeverity(impact: string): string {
  switch (impact) {
    case "critical": return "critical";
    case "major": return "major";
    default: return "minor";
  }
}

function calculateSlaFromIncidents(incidents: Array<{ date: string; duration_minutes: number }>): number {
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

    const results: Array<{ name: string; status: string; response_time: number }> = [];

    for (const provider of providers) {
      try {
        // 1. HTTP Ping
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
            headers: { "User-Agent": "MoniDuck/1.0 SaaS Monitor" },
          });
          clearTimeout(timeout);
          responseTime = Date.now() - start;
          statusCode = res.status;

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

        // 2. Store check
        await supabase.from("saas_checks").insert({
          saas_provider_id: provider.id,
          response_time: responseTime,
          status: pingStatus,
          status_code: statusCode,
          error_message: errorMessage,
        });

        // 3. Status page scraping (if available)
        let statusPageStatus = "unknown";
        let incidents: Array<{ date: string; title: string; duration_minutes: number; severity: string }> = [];

        if (provider.status_page_url) {
          const apiUrls = getStatuspageApiUrl(provider.status_page_url);
          if (apiUrls) {
            // Fetch status
            try {
              const res = await fetch(apiUrls.statusUrl, {
                headers: { Accept: "application/json" },
                signal: AbortSignal.timeout(5000),
              });
              if (res.ok) {
                const json = await res.json();
                statusPageStatus = mapStatuspageStatus(json.status?.indicator || "none");
              }
            } catch (err) {
              console.error(`Status page fetch failed for ${provider.name}:`, err);
            }

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
                    durationMinutes = Math.round((new Date(inc.resolved_at).getTime() - createdAt.getTime()) / 60000);
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
              }
            } catch (err) {
              console.error(`Incidents fetch failed for ${provider.name}:`, err);
            }
          }
        }

        // 4. Determine final status: ping prevails over status page
        // If ping says operational but status page says degraded/outage, use ping (our data prevails)
        const finalStatus = pingStatus;

        // 5. Calculate uptime from recent checks (last 24h)
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

        // 6. Calculate avg response time from recent checks
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

        // 7. Calculate SLA actual from status page incidents + our downtime checks
        const slaActual = incidents.length > 0
          ? calculateSlaFromIncidents(incidents)
          : uptimePercentage;

        // 8. Update provider
        await supabase
          .from("saas_providers")
          .update({
            status: finalStatus,
            status_page_status: statusPageStatus,
            avg_response_time: avgResponseTime,
            uptime_percentage: uptimePercentage,
            last_check: new Date().toISOString(),
            incidents,
          })
          .eq("id", provider.id);

        results.push({ name: provider.name, status: finalStatus, response_time: responseTime });
      } catch (providerErr) {
        console.error(`Error checking ${provider.name}:`, providerErr);
      }
    }

    return new Response(
      JSON.stringify({ checked: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("check-saas error:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
