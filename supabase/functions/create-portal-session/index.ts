import Stripe from "npm:stripe@14"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const sbUrl   = Deno.env.get("SUPABASE_URL")!
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!

    const userClient = createClient(sbUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { workspace_id } = await req.json()

    const serviceClient = createClient(sbUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    const { data: workspace } = await serviceClient
      .from("workspaces")
      .select("stripe_customer_id")
      .eq("id", workspace_id)
      .single()

    if (!workspace?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: "No billing account found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const stripe  = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!)
    const appUrl  = Deno.env.get("APP_URL") ?? "https://app.moniduck.io"

    const session = await stripe.billingPortal.sessions.create({
      customer:   workspace.stripe_customer_id,
      return_url: `${appUrl}/settings?tab=billing`,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("create-portal-session:", err)
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
