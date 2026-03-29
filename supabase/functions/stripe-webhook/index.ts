import Stripe from "npm:stripe@14"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 })
  }

  const body = await req.text()
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!)
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error("Webhook signature failed:", err)
    return new Response("Invalid signature", { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== "subscription") break

        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        const { workspace_id, plan_id = "starter", billing_cycle = "monthly" } = sub.metadata

        if (!workspace_id) break

        await supabase.from("subscriptions" as any).upsert(
          {
            workspace_id,
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer as string,
            plan_id,
            billing_cycle,
            status: sub.status,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end:   new Date(sub.current_period_end   * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          },
          { onConflict: "workspace_id" },
        )
        break
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        const { workspace_id, plan_id } = sub.metadata
        if (!workspace_id) break

        const resolvedPlan = plan_id || planFromPrice(sub.items.data[0]?.price.id)
        const billingCycle = sub.items.data[0]?.price.recurring?.interval === "year"
          ? "annual"
          : "monthly"

        await supabase.from("subscriptions" as any).upsert(
          {
            workspace_id,
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer as string,
            plan_id: resolvedPlan,
            billing_cycle: billingCycle,
            status: sub.status,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end:   new Date(sub.current_period_end   * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          },
          { onConflict: "workspace_id" },
        )
        break
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        const { workspace_id } = sub.metadata
        if (!workspace_id) break

        await supabase
          .from("subscriptions" as any)
          .update({ status: "canceled", cancel_at_period_end: false })
          .eq("workspace_id", workspace_id)
        break
      }

      default:
        console.log(`Unhandled event: ${event.type}`)
    }
  } catch (err) {
    console.error("Webhook processing error:", err)
    return new Response("Processing error", { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  })
})

function planFromPrice(priceId: string | undefined): string {
  if (!priceId) return "starter"
  const map: Record<string, string> = {
    [Deno.env.get("STRIPE_PRICE_STARTER_MONTHLY") ?? ""]: "starter",
    [Deno.env.get("STRIPE_PRICE_STARTER_ANNUAL")  ?? ""]: "starter",
    [Deno.env.get("STRIPE_PRICE_PRO_MONTHLY")     ?? ""]: "pro",
    [Deno.env.get("STRIPE_PRICE_PRO_ANNUAL")      ?? ""]: "pro",
    [Deno.env.get("STRIPE_PRICE_SCALE_MONTHLY")   ?? ""]: "scale",
    [Deno.env.get("STRIPE_PRICE_SCALE_ANNUAL")    ?? ""]: "scale",
  }
  return map[priceId] ?? "starter"
}
