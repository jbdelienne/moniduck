import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * Consecutive ping failures needed to trust the ping over the status page.
 * - If other SaaS pings in the same batch succeeded → network is healthy → threshold = 2
 *   (failure is isolated to this provider, almost certainly their problem)
 * - If all/most other pings also failed → could be our network → threshold = 3
 */
const THRESHOLD_NETWORK_OK   = 2;
const THRESHOLD_NETWORK_UNKNOWN = 3;

// ── Status page parsing ────────────────────────────────────────────────────

function guessStatusPageUrls(siteUrl: string): string[] {
  try {
    const u = new URL(siteUrl);
    const domain = u.hostname.replace(/^www\./, "");
    const baseDomain = domain.split(".").slice(-2).join(".");
    return [...new Set([
      `https://status.${baseDomain}`,
      `https://${domain}/status`,
      `https://status.${domain}`,
      `https://${baseDomain.replace(".", "")}status.com`,
      `https://www.${baseDomain.replace(".", "")}status.com`,
    ])];
  } catch {
    return [];
  }
}

async function probeAtlassianStatuspage(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/v2/status.json`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) { await res.text().catch(() => {}); return false; }
    const json = await res.json();
    return json?.status?.indicator !== undefined;
  } catch {
    return false;
  }
}

async function discoverStatusPageUrl(siteUrl: string): Promise<string | null> {
  for (const candidate of guessStatusPageUrls(siteUrl)) {
    if (await probeAtlassianStatuspage(candidate)) return candidate;
    try {
      const res = await fetch(candidate, {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "moniduck/1.0 StatusChecker" },
      });
      if (res.ok) {
        const html = (await res.text()).toLowerCase();
        const signals = ["all systems operational", "system status", "service status",
          "operational", "statuspage", "incident history", "uptime"];
        if (signals.filter((s) => html.includes(s)).length >= 2) return candidate;
      }
    } catch { /* skip */ }
  }
  return null;
}

// ── Atlassian Statuspage API ───────────────────────────────────────────────

type ParsedIncident = { date: string; title: string; duration_minutes: number; severity: string };

function mapStatuspageStatus(indicator: string): string {
  switch (indicator) {
    case "none":     return "operational";
    case "minor":    return "degraded";
    case "major":
    case "critical": return "outage";
    default:         return "unknown";
  }
}

function mapSeverity(impact: string): string {
  if (impact === "critical") return "critical";
  if (impact === "major")    return "major";
  return "minor";
}

async function fetchStatusPage(statusPageUrl: string): Promise<{
  statusPageStatus: string;
  incidents: ParsedIncident[];
  isAtlassian: boolean;
}> {
  // Try Atlassian JSON API
  try {
    const origin = new URL(statusPageUrl).origin;
    const [statusRes, incidentsRes] = await Promise.all([
      fetch(`${origin}/api/v2/status.json`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) }),
      fetch(`${origin}/api/v2/incidents.json`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) }),
    ]);

    if (statusRes.ok) {
      const json = await statusRes.json();
      if (json?.status?.indicator !== undefined) {
        const statusPageStatus = mapStatuspageStatus(json.status.indicator);
        const incidents: ParsedIncident[] = [];

        if (incidentsRes.ok) {
          const incJson = await incidentsRes.json();
          const now = new Date();
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

          for (const inc of (incJson.incidents ?? []).slice(0, 20)) {
            const createdAt = new Date(inc.created_at);
            if (createdAt < thirtyDaysAgo) continue;
            const durationMinutes = inc.resolved_at
              ? Math.round((new Date(inc.resolved_at).getTime() - createdAt.getTime()) / 60000)
              : Math.round((now.getTime() - createdAt.getTime()) / 60000);
            incidents.push({
              date: inc.created_at,
              title: inc.name || "Incident",
              duration_minutes: Math.max(durationMinutes, 1),
              severity: mapSeverity(inc.impact || "minor"),
            });
          }
        } else {
          await incidentsRes.text().catch(() => {});
        }

        return { statusPageStatus, incidents, isAtlassian: true };
      }
    } else {
      await statusRes.text().catch(() => {});
    }
  } catch { /* Not Atlassian or unreachable */ }

  // Fallback: HTML scrape for status only
  try {
    const res = await fetch(statusPageUrl, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "moniduck/1.0 StatusChecker" },
    });
    if (res.ok) {
      const html = (await res.text()).toLowerCase();
      let statusPageStatus = "unknown";
      if (html.includes("all systems operational") || html.includes("no issues")) {
        statusPageStatus = "operational";
      } else if (html.includes("major outage") || html.includes("service disruption")) {
        statusPageStatus = "outage";
      } else if (html.includes("degraded") || html.includes("minor incident") || html.includes("elevated error")) {
        statusPageStatus = "degraded";
      } else if (html.includes("operational")) {
        statusPageStatus = "operational";
      }
      return { statusPageStatus, incidents: [], isAtlassian: false };
    } else {
      await res.text().catch(() => {});
    }
  } catch { /* unreachable */ }

  return { statusPageStatus: "unknown", incidents: [], isAtlassian: false };
}

// ── SLA calculation ────────────────────────────────────────────────────────

function slaFromIncidents(incidents: ParsedIncident[]): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const minutesInMonth = (now.getTime() - monthStart.getTime()) / 60000;
  if (minutesInMonth <= 0) return 100;

  let downtimeMinutes = 0;
  for (const inc of incidents) {
    if (new Date(inc.date) >= monthStart) downtimeMinutes += inc.duration_minutes;
  }
  return Math.round(((minutesInMonth - downtimeMinutes) / minutesInMonth) * 10000) / 100;
}

// ── Status merge logic ─────────────────────────────────────────────────────
//
// | Ping        | Status page  | consecutive_failures | Final             |
// |-------------|-------------|----------------------|-------------------|
// | operational | operational  | any                  | operational       |
// | operational | degraded     | any                  | degraded          |
// | operational | outage       | any                  | outage            |
// | failing     | operational  | < threshold          | operational (wait)|
// | failing     | operational  | >= threshold         | unconfirmed_outage|
// | failing     | degraded     | any                  | degraded          |
// | failing     | outage       | any                  | outage            |

function mergeStatus(
  pingOk: boolean,
  statusPageStatus: string,
  consecutiveFailures: number,
  threshold: number,
): string {
  if (pingOk) {
    // Ping is up — trust status page if it shows a problem
    if (statusPageStatus === "outage" || statusPageStatus === "degraded") return statusPageStatus;
    return "operational";
  }

  // Ping is failing
  if (statusPageStatus === "outage") return "outage";
  if (statusPageStatus === "degraded") return "degraded";

  // Status page says operational but ping fails
  if (consecutiveFailures >= threshold) return "unconfirmed_outage";

  // Not enough consecutive failures yet — give benefit of the doubt
  return "operational";
}

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const providerId = url.searchParams.get("provider_id");

    const query = supabase.from("saas_providers").select("*");
    const { data: providers, error } = providerId
      ? await query.eq("id", providerId)
      : await query;

    if (error) throw error;
    if (!providers?.length) {
      return new Response(
        JSON.stringify({ message: "No SaaS providers to check", checked: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Pass 1: ping all providers in parallel ─────────────────────────────
    type PingResult = {
      providerId: string;
      pingOk: boolean;
      pingStatusLabel: string;
      responseTime: number;
      statusCode: number | null;
      errorMessage: string | null;
    };

    const pingResults = await Promise.all(
      providers.map(async (provider): Promise<PingResult> => {
        let pingOk = false;
        let responseTime = 0;
        let statusCode: number | null = null;
        let errorMessage: string | null = null;
        let pingStatusLabel = "outage";

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
          await res.text().catch(() => {});

          if (res.status >= 200 && res.status < 400) {
            pingOk = true;
            pingStatusLabel = "operational";
          } else if (res.status >= 400 && res.status < 500) {
            pingStatusLabel = "degraded";
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errorMessage = msg.includes("abort") ? "Timeout (10s)" : msg;
        }

        return { providerId: provider.id, pingOk, pingStatusLabel, responseTime, statusCode, errorMessage };
      })
    );

    // Network health: if at least one OTHER provider pinged OK, our network is fine
    const pingMap = new Map(pingResults.map(r => [r.providerId, r]));
    const successCount = pingResults.filter(r => r.pingOk).length;
    const networkHealthy = successCount > 0; // at least one succeeded → not our network

    const consecutiveThreshold = networkHealthy ? THRESHOLD_NETWORK_OK : THRESHOLD_NETWORK_UNKNOWN;

    // ── Pass 2: process each provider ─────────────────────────────────────
    const results = [];

    for (const provider of providers) {
      try {
        const ping = pingMap.get(provider.id)!;
        const { pingOk, pingStatusLabel, responseTime, statusCode, errorMessage } = ping;

        // ── Track consecutive ping failures ────────────────────────────────
        const previousFailures: number = provider.consecutive_ping_failures ?? 0;
        const consecutiveFailures = pingOk ? 0 : previousFailures + 1;

        // ── 3. Store ping check ────────────────────────────────────────────
        await supabase.from("saas_checks").insert({
          saas_provider_id: provider.id,
          response_time: responseTime,
          status: pingStatusLabel,
          status_code: statusCode,
          error_message: errorMessage,
        });

        // ── 4. Status page ─────────────────────────────────────────────────
        let statusPageUrl: string | null = provider.status_page_url ?? null;
        let statusPageStatus = "unknown";
        let incidents: ParsedIncident[] = [];
        let discoveredUrl = false;

        if (!statusPageUrl) {
          const found = await discoverStatusPageUrl(provider.url);
          if (found) { statusPageUrl = found; discoveredUrl = true; }
        }

        if (statusPageUrl) {
          const parsed = await fetchStatusPage(statusPageUrl);
          statusPageStatus = parsed.statusPageStatus;
          incidents = parsed.incidents;
        }

        // ── 5. Merge status ────────────────────────────────────────────────
        const finalStatus = mergeStatus(pingOk, statusPageStatus, consecutiveFailures, consecutiveThreshold);

        // ── 6. Uptime from pings (last 30 days) ───────────────────────────
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentChecks } = await supabase
          .from("saas_checks")
          .select("status, response_time")
          .eq("saas_provider_id", provider.id)
          .gte("checked_at", thirtyDaysAgo);

        let uptimeFromPing = 100;
        let avgResponseTime = responseTime;
        if (recentChecks?.length) {
          const upCount = recentChecks.filter((c: any) => c.status === "operational").length;
          uptimeFromPing = Math.round((upCount / recentChecks.length) * 10000) / 100;
          const timings = recentChecks.filter((c: any) => c.response_time > 0);
          if (timings.length) {
            avgResponseTime = Math.round(timings.reduce((s: number, c: any) => s + c.response_time, 0) / timings.length);
          }
        }

        // ── 7. Uptime from status page incidents ───────────────────────────
        const uptimeFromStatusPage = incidents.length > 0 ? slaFromIncidents(incidents) : 100;

        // ── 8. Update provider ─────────────────────────────────────────────
        const update: Record<string, unknown> = {
          status: finalStatus,
          ping_status: pingStatusLabel,
          status_page_status: statusPageStatus,
          uptime_percentage: uptimeFromPing,       // kept for backwards compat
          uptime_from_ping: uptimeFromPing,
          uptime_from_statuspage: uptimeFromStatusPage,
          avg_response_time: avgResponseTime,
          consecutive_ping_failures: consecutiveFailures,
          last_check: new Date().toISOString(),
          incidents,
        };
        if (discoveredUrl && statusPageUrl) update.status_page_url = statusPageUrl;

        await supabase.from("saas_providers").update(update).eq("id", provider.id);

        results.push({ name: provider.name, finalStatus, pingOk, statusPageStatus, uptimeFromPing, uptimeFromStatusPage, consecutiveFailures, threshold: consecutiveThreshold });
      } catch (err) {
        console.error(`Error checking ${provider.name}:`, err);
      }
    }

    return new Response(JSON.stringify({ checked: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("check-saas error:", err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
