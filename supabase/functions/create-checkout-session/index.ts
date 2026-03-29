import Stripe from "npm:stripe@14"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Price IDs are set in Supabase Edge Function secrets
// STRIPE_PRICE_STARTER_MONTHLY, STRIPE_PRICE_STARTER_ANNUAL
// STRIPE_PRICE_PRO_MONTHLY,     STRIPE_PRICE_PRO_ANNUAL
// STRIPE_PRICE_SCALE_MONTHLY,   STRIPE_PRICE_SCALE_ANNUAL
const PRICE_IDS: Record<string, Record<string, string>> = {
  starter: {
    monthly: Deno.env.get("STRIPE_PRICE_STARTER_MONTHLY") ?? "",
    annual:  Deno.env.get("STRIPE_PRICE_STARTER_ANNUAL")  ?? "",
  },
  pro: {
    monthly: Deno.env.get("STRIPE_PRICE_PRO_MONTHLY") ?? "",
    annual:  Deno.env.get("STRIPE_PRICE_PRO_ANNUAL")  ?? "",
  },
  scale: {
    monthly: Deno.env.get("STRIPE_PRICE_SCALE_MONTHLY") ?? "",
    annual:  Deno.env.get("STRIPE_PRICE_SCALE_ANNUAL")  ?? "",
  },
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

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const sbUrl   = Deno.env.get("SUPABASE_URL")!

    const userClient = createClient(sbUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { plan_id, billing_cycle, workspace_id } = await req.json()

    if (!plan_id || !billing_cycle || !workspace_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const priceId = PRICE_IDS[plan_id]?.[billing_cycle]
    if (!priceId) {
      return new Response(JSON.stringify({ error: "Invalid plan or billing cycle" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const serviceClient = createClient(sbUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    // Verify caller is workspace admin
    const { data: member } = await serviceClient
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .single()

    if (!member || member.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can manage billing" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Get or create Stripe customer
    const { data: workspace } = await serviceClient
      .from("workspaces")
      .select("stripe_customer_id, name")
      .eq("id", workspace_id)
      .single()

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!)
    let customerId = workspace?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:  workspace?.name ?? undefined,
        metadata: { workspace_id, user_id: user.id },
      })
      customerId = customer.id
      await serviceClient
        .from("workspaces")
        .update({ stripe_customer_id: customerId })
        .eq("id", workspace_id)
    }

    const appUrl = Deno.env.get("APP_URL") ?? "https://app.moniduck.io"

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?tab=billing&billing=success`,
      cancel_url:  `${appUrl}/settings?tab=billing`,
      subscription_data: {
        metadata: { workspace_id, plan_id, billing_cycle },
      },
      allow_promotion_codes: true,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("create-checkout-session:", err)
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
