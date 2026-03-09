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

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MoniDuck Alerts <alerts@mail.moniduck.io>",
        to: Array.isArray(to) ? to : [to],
        subject: `✅ ${service_name} is back up`,
        template: {
          id: "d49e3500-f3ab-43fc-aea8-789d5ff11d76",
          variables: {
            service_name,
            service_url,
            incident_started_at: formatDate(incident_started_at),
            incident_resolved_at: formatDate(incident_resolved_at),
            incident_duration: formatDuration(duration_minutes),
            uptime_30d: `${uptime_30d ?? "N/A"}%`,
            dashboard_url: "https://moniduck.io/services",
          },
        },
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
