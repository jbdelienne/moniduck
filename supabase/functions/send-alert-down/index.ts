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
    const statusDisplay = error_message || `HTTP ${status_code}`;

    let lastSeenUp = "Unknown";
    if (last_check_up) {
      const diff = Math.round((Date.now() - new Date(last_check_up).getTime()) / 60000);
      if (diff < 60) lastSeenUp = `${diff} minute${diff > 1 ? "s" : ""} ago`;
      else if (diff < 1440) lastSeenUp = `${Math.floor(diff / 60)}h ${diff % 60}min ago`;
      else lastSeenUp = `${Math.floor(diff / 1440)} day(s) ago`;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "moniduck Alerts <alerts@mail.moniduck.io>",
        to: Array.isArray(to) ? to : [to],
        subject: `🔴 ${service_name} is down`,
        template: {
          id: "1723624d-8656-4b91-ad05-130baa524b96",
          variables: {
            service_name,
            service_url,
            status: statusDisplay,
            detected_at: detectedFormatted,
            endpoint_type: endpointType,
            last_seen_up: lastSeenUp,
            uptime_30d: `${uptime_30d ?? "N/A"}%`,
            dashboard_url: "https://moniduck.io/services",
            settings_url: "https://moniduck.io/settings",
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
