import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import tls from "node:tls";

function checkSSL(hostname: string, port = 443): Promise<{ daysLeft: number; expiryDate: string; issuer: string }> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(port, hostname, { servername: hostname }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      const expiryDate = new Date(cert.valid_to);
      const now = new Date();
      const daysLeft = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const issuer = cert.issuer?.O || cert.issuer?.CN || "Unknown";
      resolve({ daysLeft, expiryDate: expiryDate.toISOString(), issuer });
    });
    socket.on("error", (err: Error) => reject(err));
    socket.setTimeout(5000, () => { socket.destroy(); reject(new Error("Timeout")); });
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---- Invoke sibling edge function ----
async function invokeFunction(functionName: string, body: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(body),
    });
    const result = await res.text();
    if (!res.ok) console.error(`${functionName} error:`, res.status, result);
    else console.log(`${functionName} OK:`, result);
  } catch (err) {
    console.error(`Failed to invoke ${functionName}:`, err);
  }
}

// ---- Get notification email for a service ----
async function getNotificationEmail(supabase: any, service: any): Promise<string | null> {
  // Check maintenance window
  if (service.maintenance_until) {
    const maintEnd = new Date(service.maintenance_until);
    if (maintEnd > new Date()) return null;
  }

  // Use notification_email > alert_email > account email
  if (service.notification_email) return service.notification_email;
  if (service.alert_email) return service.alert_email;

  const { data } = await supabase.rpc('get_auth_email');
  return data || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedCronSecret = Deno.env.get("CRON_SECRET");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let isAuthorized = false;
    let isCronCall = false;

    // Option 1: Cron secret header
    if (expectedCronSecret && cronSecret === expectedCronSecret) {
      isAuthorized = true;
      isCronCall = true;
    }

    // Option 2: Check if the bearer token is service_role or anon key by decoding JWT role
    if (!isAuthorized && authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      try {
        // Decode JWT payload (base64) to check role claim
        const payloadB64 = token.split(".")[1];
        if (payloadB64) {
          const payload = JSON.parse(atob(payloadB64));
          if (payload.role === "anon" || payload.role === "service_role") {
            // It's a Supabase system key (anon or service_role), treat as cron
            isAuthorized = true;
            isCronCall = true;
          }
        }
      } catch { /* not a valid JWT, try user auth below */ }
    }

    // Option 3: Valid user JWT
    if (!isAuthorized && authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(sbUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (user && !error) isAuthorized = true;
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(sbUrl, serviceRoleKey);

    // Parse query params first
    const url = new URL(req.url);
    const singleServiceId = url.searchParams.get("service_id");

    // Determine force: cron call, ?force=true query param, or JSON body
    let force = isCronCall || url.searchParams.get("force") === "true";
    try {
      const body = await req.json();
      if (body?.force === true) force = true;
    } catch { /* no body */ }

    console.log("check-services: force =", force, "isCron =", isCronCall, "singleServiceId =", singleServiceId);

    // If a specific service_id is provided, force-check only that service
    if (singleServiceId) {
      force = true;
    }

    // Get services to check
    let query = supabase.from("services").select("*").eq("is_paused", false);
    if (singleServiceId) {
      query = query.eq("id", singleServiceId);
    }
    const { data: services, error: svcErr } = await query;

    if (svcErr) throw svcErr;
    if (!services || services.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active services", checked: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const results: Array<{ service_id: string; status: string; response_time: number }> = [];

    for (const service of services) {
      try {
      // Check interval filtering (skip if force or single service)
      if (!force && service.last_check) {
        const lastCheck = new Date(service.last_check);
        const diffMinutes = (now.getTime() - lastCheck.getTime()) / 60000;
        if (diffMinutes < service.check_interval) continue;
      }

      let status = "down";
      let responseTime = 0;
      let statusCode: number | null = null;
      let errorMessage: string | null = null;
      let ttfb: number | null = null;
      let responseSize: number | null = null;
      const checkRegion = Deno.env.get("DENO_REGION") || Deno.env.get("SB_REGION") || "eu-central-1";

      // ---- HTTP CHECK ----
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const start = performance.now();
        const res = await fetch(service.url, {
          method: "GET",
          signal: controller.signal,
          redirect: "follow",
        });
        const ttfbEnd = performance.now();
        ttfb = Math.round(ttfbEnd - start);

        const body = await res.text();
        const end = performance.now();
        clearTimeout(timeout);

        responseTime = Math.round(end - start);
        responseSize = new TextEncoder().encode(body).length;
        statusCode = res.status;

        // A check is FAILED if status >= 500
        if (res.status >= 500) {
          status = "down";
          errorMessage = `HTTP ${res.status}`;
        } else if (res.status >= 200 && res.status < 500) {
          status = "up";
        }

        // Content validation
        if (status === "up" && service.content_keyword) {
          const keyword = service.content_keyword.trim().toLowerCase();
          if (keyword && !body.toLowerCase().includes(keyword)) {
            status = "degraded";
            errorMessage = `Content keyword "${service.content_keyword}" not found`;
          }
        }
      } catch (err: unknown) {
        status = "down";
        errorMessage = err instanceof Error ? err.message : "Unknown error";
        if (errorMessage.includes("aborted")) {
          errorMessage = "Request timeout (>10s)";
        }
      }

      // ---- INSERT CHECK RECORD ----
      await supabase.from("checks").insert({
        service_id: service.id,
        user_id: service.user_id,
        status,
        response_time: responseTime,
        status_code: statusCode,
        error_message: errorMessage,
        ttfb,
        response_size: responseSize,
        check_region: checkRegion,
      });

      // ---- INCIDENT & ALERTING LOGIC ----
      const checksBeforeAlert = service.alert_checks_threshold || 2;
      const currentFailures = service.consecutive_failures || 0;

      if (status === "down") {
        const newFailures = currentFailures + 1;

        // Update consecutive_failures
        await supabase
          .from("services")
          .update({ consecutive_failures: newFailures })
          .eq("id", service.id);

        // Check if we should create an incident
        if (newFailures >= checksBeforeAlert) {
          // Check no open incident exists
          const { data: openIncident } = await supabase
            .from("incidents")
            .select("id")
            .eq("service_id", service.id)
            .is("resolved_at", null)
            .limit(1);

          if (!openIncident || openIncident.length === 0) {
            // Create incident
            const { data: newIncident } = await supabase
              .from("incidents")
              .insert({
                service_id: service.id,
                user_id: service.user_id,
                workspace_id: service.workspace_id,
                status_code: errorMessage || `HTTP ${statusCode}`,
                error_message: errorMessage,
                started_at: now.toISOString(),
              })
              .select()
              .single();

            // Send down alert email
            if (newIncident && service.alert_notify_down !== false) {
              const email = await getNotificationEmail(supabase, service);
              if (email) {
                // Get last successful check time
                const { data: lastUp } = await supabase
                  .from("checks")
                  .select("checked_at")
                  .eq("service_id", service.id)
                  .eq("status", "up")
                  .order("checked_at", { ascending: false })
                  .limit(1);

                await invokeFunction("send-alert-down", {
                  to: email,
                  service_name: service.name,
                  service_url: service.url,
                  service_id: service.id,
                  status_code: statusCode?.toString() || "N/A",
                  error_message: errorMessage,
                  detected_at: now.toISOString(),
                  visibility: service.visibility,
                  last_check_up: lastUp?.[0]?.checked_at || null,
                  uptime_30d: service.uptime_percentage,
                });

                // Mark alert_sent_at on the incident
                await supabase
                  .from("incidents")
                  .update({ alert_sent_at: now.toISOString() })
                  .eq("id", newIncident.id);
              }
            }

            // Also create alert record for the UI
            const alertSeverity = service.visibility === "private" ? "warning" : "critical";
            await supabase.from("alerts").insert({
              user_id: service.user_id,
              workspace_id: service.workspace_id,
              service_id: service.id,
              alert_type: "downtime",
              severity: alertSeverity,
              title: `${service.name}: Service is down`,
              description: errorMessage || `HTTP ${statusCode} - Service is not responding`,
              integration_type: "service",
              incident_id: newIncident?.id,
              metadata: {
                service_id: service.id,
                url: service.url,
                down_since: now.toISOString(),
              },
            });
          }
        }
      }

      // ---- RESOLUTION LOGIC ----
      if (status === "up") {
        // Reset consecutive failures
        if (currentFailures > 0) {
          await supabase
            .from("services")
            .update({ consecutive_failures: 0 })
            .eq("id", service.id);
        }

        // Resolve any open incidents
        const { data: openIncidents } = await supabase
          .from("incidents")
          .select("*")
          .eq("service_id", service.id)
          .is("resolved_at", null);

        for (const incident of openIncidents || []) {
          const startedAt = new Date(incident.started_at);
          const durationMin = Math.round((now.getTime() - startedAt.getTime()) / 60000);

          await supabase
            .from("incidents")
            .update({
              resolved_at: now.toISOString(),
              duration_minutes: durationMin,
              resolution_sent_at: service.alert_notify_up !== false ? now.toISOString() : null,
            })
            .eq("id", incident.id);

          // Send recovery email
          if (service.alert_notify_up !== false && incident.alert_sent_at) {
            const email = await getNotificationEmail(supabase, service);
            if (email) {
              await invokeFunction("send-alert-up", {
                to: email,
                service_name: service.name,
                service_url: service.url,
                incident_started_at: incident.started_at,
                incident_resolved_at: now.toISOString(),
                duration_minutes: durationMin,
                uptime_30d: service.uptime_percentage,
              });
            }
          }

          // Resolve corresponding alerts
          await supabase
            .from("alerts")
            .update({
              resolved_at: now.toISOString(),
              is_dismissed: true,
              metadata: {
                resolved_at: now.toISOString(),
                downtime_minutes: durationMin,
              },
            })
            .eq("service_id", service.id)
            .eq("alert_type", "downtime")
            .is("resolved_at", null);
        }
      }

      // ---- UPTIME CALCULATION ----
      const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
      const { count: totalChecks } = await supabase
        .from("checks")
        .select("*", { count: "exact", head: true })
        .eq("service_id", service.id)
        .gte("checked_at", twelveMonthsAgo);

      const { count: upChecks } = await supabase
        .from("checks")
        .select("*", { count: "exact", head: true })
        .eq("service_id", service.id)
        .eq("status", "up")
        .gte("checked_at", twelveMonthsAgo);

      const total = totalChecks || 1;
      const up = upChecks || 0;
      const uptimePercentage = Math.round((up / total) * 10000) / 100;

      // Avg response time
      const { data: rtChecks } = await supabase
        .from("checks")
        .select("response_time")
        .eq("service_id", service.id)
        .eq("status", "up")
        .order("checked_at", { ascending: false })
        .limit(20);

      const avgResponseTime = rtChecks && rtChecks.length > 0
        ? Math.round(rtChecks.reduce((sum: number, c: any) => sum + c.response_time, 0) / rtChecks.length)
        : 0;

      // SSL check
      let sslExpiryDate: string | null = null;
      let sslIssuer: string | null = null;
      try {
        const urlObj = new URL(service.url);
        if (urlObj.protocol === "https:") {
          const sslInfo = await checkSSL(urlObj.hostname, Number(urlObj.port) || 443);
          sslExpiryDate = sslInfo.expiryDate;
          sslIssuer = sslInfo.issuer;
        }
      } catch (_e) { /* SSL check failed */ }

      // Update service
      const updatePayload: Record<string, any> = {
        status,
        last_check: now.toISOString(),
        uptime_percentage: uptimePercentage,
        avg_response_time: avgResponseTime,
      };
      if (sslExpiryDate) updatePayload.ssl_expiry_date = sslExpiryDate;
      if (sslIssuer) updatePayload.ssl_issuer = sslIssuer;

      await supabase
        .from("services")
        .update(updatePayload)
        .eq("id", service.id);

      results.push({ service_id: service.id, status, response_time: responseTime });
      } catch (serviceErr) {
        console.error(`Error processing service ${service.id} (${service.name}):`, serviceErr);
        results.push({ service_id: service.id, status: "error", response_time: 0 });
      }
    }

    return new Response(
      JSON.stringify({ checked: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("check-services error:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Internal error", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
