/**
 * DEPRECATED — functionality merged into check-saas.
 * Kept to avoid breaking any existing cron triggers.
 * Redirects to check-saas internally.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Forward to check-saas
    const checkSaasUrl = `${supabaseUrl}/functions/v1/check-saas`;
    const res = await fetch(checkSaasUrl, {
      method: req.method,
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    });

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: "Deprecated — use check-saas instead" }),
      { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
