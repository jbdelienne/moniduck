import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Check, ChevronDown, X, Globe, Cloud, Plug,
  Bell, Search, Zap, Shield, TrendingDown, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import duckLogo from "@/assets/moniduck-logo.png";

/* ── Pricing ──────────────────────────────────────── */

type Tier = {
  name: string;
  mo: number | null;
  annual: number | null;
  desc: string;
  popular: boolean;
  cta: string;
  features: { text: string; ok: boolean; badge?: "Soon" | "Roadmap" }[];
};

// Feature rows are identical across the 3 paid plans — same order, same label.
// This makes the progression immediately readable left to right.
const tiers: Tier[] = [
  {
    name: "Starter",
    mo: 29,
    annual: 23,
    desc: "For freelancers and solo devs who need reliable uptime visibility.",
    popular: false,
    cta: "Get started",
    features: [
      { text: "10 HTTP monitors", ok: true },
      { text: "5-minute check interval", ok: true },
      { text: "10 SaaS dependencies", ok: true },
      { text: "Email alerts", ok: true },
      { text: "30-day incident history", ok: true },
      { text: "1 workspace member", ok: true },
      { text: "Public status reports", ok: true },
      { text: "Cloud account (AWS)", ok: false },
      { text: "Slack alerts", ok: false, badge: "Soon" },
    ],
  },
  {
    name: "Pro",
    mo: 89,
    annual: 71,
    desc: "For any team that ships to production and takes uptime seriously.",
    popular: true,
    cta: "Get started",
    features: [
      { text: "50 HTTP monitors", ok: true },
      { text: "1-minute check interval", ok: true },
      { text: "Unlimited SaaS dependencies", ok: true },
      { text: "Email alerts", ok: true },
      { text: "90-day incident history", ok: true },
      { text: "5 workspace members", ok: true },
      { text: "1 AWS cloud account", ok: true },
      { text: "Public status reports", ok: true },
      { text: "Slack alerts", ok: false, badge: "Soon" },
    ],
  },
  {
    name: "Scale",
    mo: 199,
    annual: 159,
    desc: "For engineering teams managing serious infrastructure across multiple accounts.",
    popular: false,
    cta: "Get started",
    features: [
      { text: "Unlimited HTTP monitors", ok: true },
      { text: "1-minute check interval", ok: true },
      { text: "Unlimited SaaS dependencies", ok: true },
      { text: "Email alerts", ok: true },
      { text: "1-year incident history", ok: true },
      { text: "15 workspace members", ok: true },
      { text: "Unlimited cloud accounts", ok: true },
      { text: "SLA exports (PDF + CSV)", ok: true, badge: "Soon" },
      { text: "Slack + webhooks", ok: false, badge: "Soon" },
    ],
  },
  {
    name: "Enterprise",
    mo: null,
    annual: null,
    desc: "For organisations with compliance requirements, custom contracts, and large teams.",
    popular: false,
    cta: "Contact us",
    features: [
      { text: "Everything in Scale", ok: true },
      { text: "Unlimited members & workspaces", ok: true },
      { text: "SSO / SAML", ok: true, badge: "Roadmap" },
      { text: "Custom data retention policy", ok: true },
      { text: "Dedicated support channel", ok: true },
      { text: "Uptime SLA on moniduck itself", ok: true },
      { text: "Audit logs", ok: true, badge: "Roadmap" },
      { text: "Signed DPA & custom MSA", ok: true },
      { text: "Volume discounts", ok: true },
      { text: "Roadmap influence", ok: true },
    ],
  },
];

/* ── FAQ ──────────────────────────────────────────── */

const faqs = [
  {
    q: "Why not just use UptimeRobot or Pingdom?",
    a: "Those tools ping your URLs — that's it. moniduck does that, but also cross-checks your SaaS vendors' status pages against our own pings, tracks their actual uptime vs their contractual SLA, and monitors your cloud resources and costs. It's the difference between a thermometer and a full health check.",
  },
  {
    q: "What exactly is an 'SLA breach report'?",
    a: "When Stripe goes down three times this month and their actual uptime is 99.71% instead of the 99.99% they promised, moniduck generates a PDF with dates, durations, and the gap vs their SLA. You send it to their support team and negotiate service credits. One successful claim can pay for years of subscription.",
  },
  {
    q: "How long does setup take?",
    a: "Under 5 minutes for your first service. About 2 minutes per additional integration. No server configuration, no agent to install.",
  },
  {
    q: "Is my cloud data safe?",
    a: "moniduck only uses read-only access to your cloud accounts. We never write, modify, or delete anything. Credentials are encrypted at rest. EU-hosted infrastructure.",
  },
  {
    q: "What happens if I exceed my plan limits?",
    a: "We notify you before you hit the ceiling. No service interruption — you have 7 days to upgrade.",
  },
  {
    q: "Is there a minimum commitment?",
    a: "None. Cancel anytime from your settings. Annual plans are refunded pro-rata if you cancel within the first 30 days.",
  },
];

/* ── Sub-components ───────────────────────────────── */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left">
        <span className="font-medium text-foreground pr-4">{q}</span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-56 pb-5" : "max-h-0"}`}>
        <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────── */

export default function LandingPage() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(true);

  const heroRef = useScrollReveal({ delay: 100 });
  const roiRef = useScrollReveal();
  const featuresRef = useScrollReveal();
  const pricingRef = useScrollReveal();
  const faqRef = useScrollReveal();

  const cta = () => navigate("/auth");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{`
        .hero-grid {
          background-image:
            linear-gradient(hsl(var(--border)/0.35) 1px,transparent 1px),
            linear-gradient(90deg,hsl(var(--border)/0.35) 1px,transparent 1px);
          background-size:64px 64px;
          mask-image:radial-gradient(ellipse 100% 70% at 60% 0%,black 30%,transparent 100%);
          -webkit-mask-image:radial-gradient(ellipse 100% 70% at 60% 0%,black 30%,transparent 100%);
        }
        .shimmer { position:relative; overflow:hidden; }
        .shimmer::after {
          content:''; position:absolute; inset:0;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent);
          animation:sh 3s infinite;
        }
        @keyframes sh { 0%{transform:translateX(-100%)} 60%,100%{transform:translateX(100%)} }
      `}</style>

      {/* ─── Nav ─────────────────────────────────── */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={duckLogo} alt="moniduck" className="w-10 h-10" />
            <span className="font-semibold text-xl tracking-tight">moniduck</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#pricing" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
            <Button size="sm" className="h-9 shimmer" onClick={cta}>
              Get started
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 hero-grid pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 700px 500px at 0% 50%,hsl(160 84% 39%/0.05),transparent)",
        }} />

        <div ref={heroRef} className="relative max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="grid lg:grid-cols-[1fr_480px] gap-16 items-center">

            {/* Left: Copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-success/20 bg-success/5 text-xs font-medium mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-success">Beta — full Pro features included during early access</span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-[64px] font-bold tracking-tight leading-[1.05] mb-6">
                Your vendors
                <br />promise 99.9%.
                <br /><span className="text-green-600">Hold them to it.</span>
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                moniduck monitors your HTTP services, cloud resources, and SaaS
                dependencies — and generates breach reports when a vendor falls
                short of the uptime they promised.
              </p>

              <div className="flex flex-col gap-3 mb-10">
                {[
                  "Alerts in under 2 minutes — before your users notice",
                  "SLA breaches documented and exportable as PDF",
                  "One dashboard for your entire stack",
                ].map(item => (
                  <div key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-success shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <Button size="lg" className="h-12 px-8 shimmer group" onClick={cta}>
                  Start for free
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
                <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">
                  See pricing →
                </a>
              </div>
            </div>

            {/* Right: Dashboard mockup */}
            <div className="hidden lg:block">
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_32px_80px_-16px_rgba(0,0,0,0.2)]">
                <div className="border-b border-border px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-destructive/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-warning/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-success/50" />
                  </div>
                  <span className="text-xs text-muted-foreground ml-2">moniduck — incidents</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    <span className="text-xs text-destructive font-medium">2 active</span>
                  </div>
                </div>

                {/* Incident rows */}
                <div className="divide-y divide-border">
                  {[
                    {
                      badge: "Critical",
                      badgeColor: "bg-destructive/10 text-destructive",
                      name: "Dashboard — app.mycompany.com",
                      sub: "Down for 18 min · ~€290 revenue impact",
                      right: "Ongoing",
                      rightColor: "text-destructive",
                    },
                    {
                      badge: "SLA Breach",
                      badgeColor: "bg-warning/10 text-warning",
                      name: "Stripe — 99.71% vs 99.99% promised",
                      sub: "PDF report ready · gap: −0.28%",
                      right: "This month",
                      rightColor: "text-warning",
                    },
                    {
                      badge: "OK",
                      badgeColor: "bg-success/10 text-success",
                      name: "Auth Service · AWS us-east-1",
                      sub: "100% uptime · 43ms avg",
                      right: "Normal",
                      rightColor: "text-success",
                    },
                    {
                      badge: "OK",
                      badgeColor: "bg-success/10 text-success",
                      name: "GitHub — 99.99% uptime",
                      sub: "SLA compliant · last check 41s ago",
                      right: "Normal",
                      rightColor: "text-success",
                    },
                  ].map(row => (
                    <div key={row.name} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md shrink-0 mt-0.5 ${row.badgeColor}`}>
                          {row.badge}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{row.sub}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium shrink-0 ml-3 ${row.rightColor}`}>{row.right}</span>
                    </div>
                  ))}
                </div>

                {/* Bottom bar */}
                <div className="border-t border-border px-4 py-2.5 bg-muted/20 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">4 monitors · checked 41s ago</span>
                  <span className="text-xs font-medium text-warning">1 SLA breach this month</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── ROI section ─────────────────────────── */}
      <section className="border-b border-border bg-card/30">
        <div ref={roiRef} className="max-w-6xl mx-auto px-6 py-16">
          <p className="text-center text-xs text-muted-foreground uppercase tracking-widest mb-12">
            The real question isn't whether it's worth the price
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: TrendingDown,
                stat: "~€500",
                label: "in lost revenue per hour of downtime",
                sub: "For a startup at €1M ARR. At €89/month, moniduck pays for itself the first time it catches an incident before your users do.",
                color: "text-destructive",
                bg: "bg-destructive/10",
              },
              {
                icon: Shield,
                stat: "1 claim",
                label: "can pay for years of subscription",
                sub: "Stripe at 99.71% instead of 99.99%? That's a provable SLA breach. moniduck generates the PDF. You negotiate service credits.",
                color: "text-warning",
                bg: "bg-warning/10",
              },
              {
                icon: Zap,
                stat: "< 2 min",
                label: "to detect an outage, not 14",
                sub: "Without monitoring, average detection time is 14 minutes — usually because a customer tweeted at you. That's the scenario we prevent.",
                color: "text-success",
                bg: "bg-success/10",
              },
            ].map(item => (
              <div key={item.stat} className="rounded-xl border border-border bg-card p-6">
                <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center mb-5`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div className={`text-3xl font-bold mb-1 ${item.color}`}>{item.stat}</div>
                <p className="text-sm font-semibold text-foreground mb-3">{item.label}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ────────────────────────────── */}
      <section className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div ref={featuresRef} className="text-center mb-16">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">What you monitor</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Three layers. <span className="text-primary">One dashboard.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Most monitoring tools cover one layer. Your outages can come from all three at once.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                emoji: "📡",
                title: "HTTP Services",
                bullets: [
                  "Pinged every minute",
                  "HTTP code, latency, incident duration",
                  "Alert in under 2 minutes",
                  "Incident history and timeline",
                ],
              },
              {
                emoji: "☁️",
                title: "Cloud Resources",
                bullets: [
                  "AWS, GCP, Azure — read-only connection",
                  "State of every resource (EC2, Lambda, RDS…)",
                  "Monthly costs at a glance",
                  "Real-time cloud region status",
                ],
              },
              {
                emoji: "🔌",
                title: "SaaS & SLA",
                bullets: [
                  "Stripe, GitHub, Vercel, Slack and 10+ more",
                  "Cross-checks status page with our own pings",
                  "Actual uptime vs contractual SLA",
                  "Exportable breach report (PDF)",
                ],
              },
            ].map(f => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-lg transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 text-2xl group-hover:bg-primary/15 transition-colors">
                  {f.emoji}
                </div>
                <h3 className="text-lg font-semibold mb-4">{f.title}</h3>
                <ul className="space-y-2.5">
                  {f.bullets.map(b => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-16 grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-7 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-border" />
            {[
              { n: "1", icon: Search, title: "Connect your stack", desc: "Your URLs, AWS key, SaaS to monitor. Under 5 minutes." },
              { n: "2", icon: Bell, title: "We monitor continuously", desc: "HTTP pings, status page parsing, cloud reads — every minute." },
              { n: "3", icon: Zap, title: "You're alerted first", desc: "Email, Slack, or webhook. Before your users. Before your customers." },
            ].map(step => (
              <div key={step.n} className="flex flex-col items-center text-center relative">
                <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4 relative z-10">
                  <step.icon className="w-5 h-5 text-foreground" />
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{step.n}</span>
                </div>
                <h3 className="font-semibold mb-1.5">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─────────────────────────────── */}
      <section id="pricing" className="border-b border-border bg-card/20">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div ref={pricingRef} className="text-center mb-12">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Cheaper than one hour of downtime.
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              All plans include full access during beta. No commitment. Cancel anytime.
            </p>

            <div className="inline-flex items-center gap-2 bg-muted rounded-full px-2 py-1.5">
              <button
                onClick={() => setAnnual(false)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${!annual ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${annual ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
              >
                Annual
                <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-semibold">−20%</span>
              </button>
            </div>
          </div>

          {/* 3 paid plans */}
          <div className="grid md:grid-cols-3 gap-6 items-start mb-6">
            {tiers.filter(t => t.name !== "Enterprise").map(tier => (
              <div
                key={tier.name}
                className={`rounded-2xl border p-7 flex flex-col relative ${
                  tier.popular
                    ? "border-primary bg-card shadow-[0_0_80px_-10px_hsl(160_84%_39%_/_0.2)] md:scale-[1.03]"
                    : "border-border bg-card"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-5 py-1.5 rounded-full shadow-lg">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-1">{tier.name}</p>
                  <p className="text-sm text-muted-foreground mb-5 min-h-[40px]">{tier.desc}</p>
                  <div className="flex items-end gap-1.5 mb-1">
                    <span className="text-5xl font-bold text-foreground">
                      €{annual ? tier.annual : tier.mo}
                    </span>
                    <span className="text-muted-foreground text-sm mb-2">/mo</span>
                  </div>
                  {annual && tier.annual && tier.mo && (
                    <p className="text-xs text-muted-foreground">
                      Billed €{tier.annual * 12}/year · save €{(tier.mo - tier.annual) * 12}
                    </p>
                  )}
                </div>

                <Button size="lg" variant={tier.popular ? "default" : "outline"} className="w-full h-11 mb-7" onClick={cta}>
                  {tier.cta}
                </Button>

                <ul className="space-y-3 flex-1">
                  {tier.features.map(f => (
                    <li key={f.text} className={`flex items-center gap-3 text-sm ${f.ok ? "text-foreground" : "text-muted-foreground/40"}`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${f.ok ? "bg-success/10" : "bg-muted"}`}>
                        {f.ok
                          ? <Check className="w-2.5 h-2.5 text-success" />
                          : <X className="w-2.5 h-2.5 text-muted-foreground/25" />}
                      </span>
                      <span className="flex-1">{f.text}</span>
                      {f.badge && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                          f.badge === "Soon"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {f.badge}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Enterprise — full width band */}
          {(() => {
            const ent = tiers.find(t => t.name === "Enterprise")!;
            return (
              <div className="rounded-2xl border border-border bg-card p-7">
                <div className="grid md:grid-cols-[1fr_auto] gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <p className="text-sm font-semibold text-primary uppercase tracking-wider">Enterprise</p>
                      <span className="text-xs bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full">Custom pricing</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">{ent.desc}</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {ent.features.map(f => (
                        <div key={f.text} className="flex items-center gap-2.5 text-sm text-foreground">
                          <Check className="w-3.5 h-3.5 text-success shrink-0" />
                          {f.text}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3 shrink-0">
                    <Button size="lg" variant="outline" className="gap-2 h-11 px-8 whitespace-nowrap" onClick={() => window.location.href = "mailto:hello@moniduck.io"}>
                      <Mail className="w-4 h-4" /> Contact us
                    </Button>
                    <p className="text-xs text-muted-foreground">hello@moniduck.io</p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center max-w-2xl mx-auto">
            <p className="font-semibold text-foreground mb-1">🎁 Beta = full Pro, free</p>
            <p className="text-sm text-muted-foreground">
              Early users get all Pro features at no cost during the beta.
              When paid plans launch, you lock in a founding member rate.
            </p>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────── */}
      <section id="faq" className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 py-20 md:py-28">
          <h2 ref={faqRef} className="text-3xl md:text-4xl font-bold tracking-tight mb-12 text-center">
            Frequently asked questions
          </h2>
          {faqs.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────── */}
      <section>
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            The next outage — you'll know
            <br /><span className="text-primary">before your users do.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Free early access. Full Pro during beta. No credit card required.
          </p>
          <Button size="lg" className="h-12 px-12 shimmer group" onClick={cta}>
            Get early access
            <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
          <p className="text-xs text-muted-foreground mt-4">No credit card · EU-hosted · GDPR compliant</p>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={duckLogo} alt="moniduck" className="w-6 h-6" />
            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} moniduck</span>
          </div>
          <p className="text-xs text-muted-foreground">For teams that can't afford to miss an incident.</p>
        </div>
      </footer>
    </div>
  );
}
