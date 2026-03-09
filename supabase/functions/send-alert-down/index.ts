import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }) +
    " UTC";
}

function buildDownEmail(vars: {
  service_name: string;
  service_url: string;
  status_code: string;
  detected_at: string;
  endpoint_type: string;
  last_seen_up: string;
  uptime_30d: string;
  dashboard_url: string;
  settings_url: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:24px auto;background:#1A1A2E;border-radius:12px;overflow:hidden;">
  <div style="background:#dc2626;padding:20px 24px;">
    <h1 style="margin:0;font-size:18px;color:#fff;">🔴 ${vars.service_name} is down</h1>
  </div>
  <div style="padding:24px;">
    <table style="width:100%;border-collapse:collapse;color:#e0e0e0;font-size:14px;">
      <tr><td style="padding:10px 0;color:#999;width:140px;">Service</td><td style="padding:10px 0;font-weight:600;color:#fff;">${vars.service_name}</td></tr>
      <tr><td style="padding:10px 0;color:#999;">URL</td><td style="padding:10px 0;"><a href="${vars.service_url}" style="color:#927FBF;text-decoration:none;">${vars.service_url}</a></td></tr>
      <tr><td style="padding:10px 0;color:#999;">Status</td><td style="padding:10px 0;color:#FF8C42;font-weight:600;">${vars.status_code}</td></tr>
      <tr><td style="padding:10px 0;color:#999;">Detected at</td><td style="padding:10px 0;">${vars.detected_at}</td></tr>
      <tr><td style="padding:10px 0;color:#999;">Endpoint type</td><td style="padding:10px 0;">${vars.endpoint_type}</td></tr>
      <tr><td style="padding:10px 0;color:#999;">Last seen up</td><td style="padding:10px 0;">${vars.last_seen_up}</td></tr>
      <tr><td style="padding:10px 0;color:#999;">Uptime (30d)</td><td style="padding:10px 0;">${vars.uptime_30d}</td></tr>
    </table>
    <div style="margin-top:24px;text-align:center;">
      <a href="${vars.dashboard_url}" style="display:inline-block;background:#4F3B78;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View Dashboard</a>
    </div>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #2a2a4e;font-size:12px;color:#666;">
    <a href="${vars.settings_url}" style="color:#927FBF;text-decoration:none;">Notification settings</a> · MoniDuck — Monitoring for modern tech stacks
  </div>
</div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      to,
      service_name,
      service_url,
      service_id,
      status_code,
      error_message,
      detected_at,
      visibility,
      last_check_up,
      uptime_30d,
    } = await req.json();

    const resendKey = Deno.env.get("RESEND_SENDING_KEY") || Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "No Resend key configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detectedFormatted = formatDate(detected_at);
    const endpointType = visibility === "private" ? "🔒 Private" : "🌐 Public";

    // Calculate last seen up
    let lastSeenUp = "Unknown";
    if (last_check_up) {
      const diff = Math.round((Date.now() - new Date(last_check_up).getTime()) / 60000);
      if (diff < 60) lastSeenUp = `${diff} minute${diff > 1 ? "s" : ""} ago`;
      else if (diff < 1440) lastSeenUp = `${Math.floor(diff / 60)}h ${diff % 60}min ago`;
      else lastSeenUp = `${Math.floor(diff / 1440)} day(s) ago`;
    }

    const dashboardUrl = `https://moniduck.io/services`;
    const settingsUrl = `https://moniduck.io/settings`;

    const statusDisplay = error_message || `HTTP ${status_code}`;

    const html = buildDownEmail({
      service_name,
      service_url,
      status_code: statusDisplay,
      detected_at: detectedFormatted,
      endpoint_type: endpointType,
      last_seen_up: lastSeenUp,
      uptime_30d: `${uptime_30d ?? "N/A"}%`,
      dashboard_url: dashboardUrl,
      settings_url: settingsUrl,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MoniDuck Alerts <servicedown@mail.moniduck.io>",
        to: Array.isArray(to) ? to : [to],
        subject: `🔴 ${service_name} is down`,
        html,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: "Email send failed", details: result }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Down alert sent to", to, "for", service_name);
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-alert-down error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
