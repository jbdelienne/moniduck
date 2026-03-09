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

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h} hour${h > 1 ? "s" : ""}`;
}

function buildUpEmail(vars: {
  service_name: string;
  service_url: string;
  incident_started_at: string;
  incident_resolved_at: string;
  incident_duration: string;
  uptime_30d: string;
  dashboard_url: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:24px auto;background:#1A1A2E;border-radius:12px;overflow:hidden;">
  <div style="background:#16a34a;padding:20px 24px;">
    <h1 style="margin:0;font-size:18px;color:#fff;">✅ ${vars.service_name} is back up</h1>
  </div>
  <div style="padding:24px;">
    <table style="width:100%;border-collapse:collapse;color:#e0e0e0;font-size:14px;">
      <tr><td style="padding:10px 0;color:#999;width:140px;">Service</td><td style="padding:10px 0;font-weight:600;color:#fff;">${vars.service_name}</td></tr>
      <tr><td style="padding:10px 0;color:#999;">URL</td><td style="padding:10px 0;"><a href="${vars.service_url}" style="color:#927FBF;text-decoration:none;">${vars.service_url}</a></td></tr>
      <tr><td style="padding:10px 0;color:#999;">Down since</td><td style="padding:10px 0;">${vars.incident_started_at}</td></tr>
      <tr><td style="padding:10px 0;color:#999;">Recovered at</td><td style="padding:10px 0;">${vars.incident_resolved_at}</td></tr>
      <tr><td style="padding:10px 0;color:#999;">Total downtime</td><td style="padding:10px 0;font-weight:600;color:#FF8C42;">${vars.incident_duration}</td></tr>
      <tr><td style="padding:10px 0;color:#999;">Uptime (30d)</td><td style="padding:10px 0;">${vars.uptime_30d}</td></tr>
    </table>
    <div style="margin-top:24px;text-align:center;">
      <a href="${vars.dashboard_url}" style="display:inline-block;background:#4F3B78;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View Report</a>
    </div>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #2a2a4e;font-size:12px;color:#666;">
    MoniDuck — Monitoring for modern tech stacks
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
      incident_started_at,
      incident_resolved_at,
      duration_minutes,
      uptime_30d,
    } = await req.json();

    const resendKey = Deno.env.get("RESEND_SENDING_KEY") || Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "No Resend key configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = buildUpEmail({
      service_name,
      service_url,
      incident_started_at: formatDate(incident_started_at),
      incident_resolved_at: formatDate(incident_resolved_at),
      incident_duration: formatDuration(duration_minutes),
      uptime_30d: `${uptime_30d ?? "N/A"}%`,
      dashboard_url: `https://moniduck.io/services`,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MoniDuck Alerts <serviceup@mail.moniduck.io>",
        to: Array.isArray(to) ? to : [to],
        subject: `✅ ${service_name} is back up`,
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

    console.log("Recovery alert sent to", to, "for", service_name);
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-alert-up error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
