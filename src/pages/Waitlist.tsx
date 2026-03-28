import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowRight, Check, ChevronDown, Copy, Linkedin, Sparkles,
  Globe, Cloud, Plug, Bell, Search, BarChart3, X, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import duckLogo from "@/assets/moniduck-logo.png";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

/* ── Waitlist count ───────────────────────────────── */

function useWaitlistCount() {
  const [count, setCount] = useState<number>(47);
  useEffect(() => {
    supabase
      .from("waitlist_signups")
      .select("*", { count: "exact", head: true })
      .then(({ count: c }) => { if (c && c > 0) setCount(c); });
  }, []);
  return count;
}

/* ── Confetti ─────────────────────────────────────── */
interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; size: number; rotation: number; rotationSpeed: number; life: number;
}
const CONFETTI_COLORS = [
  "hsl(161,93%,30%)", "hsl(38,92%,50%)", "hsl(217,91%,60%)",
  "hsl(160,84%,39%)", "hsl(280,70%,55%)", "hsl(350,80%,55%)",
];
function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef<number>();
  const fire = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width; canvas.height = rect.height;
    const cx = canvas.width / 2;
    for (let i = 0; i < 150; i++) {
      particles.current.push({
        x: cx + (Math.random() - 0.5) * 300, y: canvas.height * 0.3,
        vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 18 - 4,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: Math.random() * 7 + 3, rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 14, life: 1,
      });
    }
    const animate = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current = particles.current.filter(p => p.life > 0);
      for (const p of particles.current) {
        p.x += p.vx; p.vy += 0.35; p.y += p.vy;
        p.rotation += p.rotationSpeed; p.life -= 0.01;
        ctx.save(); ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (particles.current.length > 0) raf.current = requestAnimationFrame(animate);
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    animate();
  }, []);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);
  return { canvasRef, fire };
}

/* ── Animated Counter ─────────────────────────────── */
function AnimatedCounter({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);
  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);
  return <span>{count}</span>;
}

/* ── FAQ Item ─────────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left">
        <span className="font-medium text-foreground pr-4">{q}</span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-48 pb-5" : "max-h-0"}`}>
        <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

/* ── Waitlist Form ────────────────────────────────── */
function WaitlistForm({
  onSuccess, onEmailCapture, variant = "default", waitlistCount,
}: {
  onSuccess: () => void; onEmailCapture?: (email: string) => void;
  variant?: "default" | "compact"; waitlistCount: number;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    onEmailCapture?.(email.trim().toLowerCase());
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.from("waitlist_signups").insert({
        email: normalizedEmail,
        first_name: firstName.trim() || null,
        company: company.trim() || null,
      });
      if (error && error.code !== "23505") throw error;
      try {
        await supabase.functions.invoke("waitlist-welcome", {
          body: { email: normalizedEmail, firstName: firstName.trim() || null, company: company.trim() || null },
        });
      } catch { /* best-effort */ }
      onSuccess();
    } catch (err: any) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (variant === "compact") {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
        <Input type="email" placeholder="you@company.com" value={email}
          onChange={e => setEmail(e.target.value)} required className="h-12 text-base flex-1" />
        <Button type="submit" size="lg" className="h-12 px-8 shrink-0 group" disabled={loading}>
          {loading
            ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />Joining...</span>
            : <>Get early access <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></>}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input type="text" placeholder="First name" value={firstName}
        onChange={e => setFirstName(e.target.value)} className="h-12 text-base" maxLength={100} />
      <Input type="email" placeholder="you@company.com" value={email}
        onChange={e => setEmail(e.target.value)} required className="h-12 text-base" maxLength={255} />
      <Input type="text" placeholder="Company (optional)" value={company}
        onChange={e => setCompany(e.target.value)} className="h-12 text-base" maxLength={200} />
      <Button type="submit" size="lg" className="w-full h-12 text-base group relative overflow-hidden shimmer-btn" disabled={loading}>
        {loading
          ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />Joining...</span>
          : <>Get early access <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></>}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        🔥 <AnimatedCounter target={waitlistCount} /> founders on the list · Free during beta
      </p>
    </form>
  );
}

/* ── Success state ────────────────────────────────── */
function SuccessCard({ email }: { email: string }) {
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareOnLinkedIn = () => {
    const text = encodeURIComponent("Just joined the @moniduck waitlist — one dashboard to monitor your entire stack. Check it out 👇");
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}&summary=${text}`, "_blank");
  };
  const copyLink = () => { navigator.clipboard.writeText(pageUrl); toast.success("Link copied!"); };
  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-8 animate-scale-in text-center">
      <div className="text-5xl mb-4 animate-bounce">🦆</div>
      <p className="text-xl font-semibold mb-2">You're on the list!</p>
      <p className="text-sm text-muted-foreground mb-3">
        Confirmation sent to <span className="font-medium text-foreground">{email}</span>
      </p>
      <p className="text-xs text-muted-foreground mb-6">Help us grow — share with a founder who's tired of finding out about outages from their users.</p>
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="sm" onClick={shareOnLinkedIn} className="gap-2">
          <Linkedin className="w-4 h-4" /> Share on LinkedIn
        </Button>
        <Button variant="outline" size="sm" onClick={copyLink} className="gap-2">
          <Copy className="w-4 h-4" /> Copy link
        </Button>
      </div>
    </div>
  );
}

/* ── Pricing data ─────────────────────────────────── */

type PricingTier = {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  highlight: boolean;
  badge?: string;
  cta: string;
  features: { text: string; included: boolean }[];
};

const pricingTiers: PricingTier[] = [
  {
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "For personal projects and experimentation.",
    highlight: false,
    cta: "Get started free",
    features: [
      { text: "5 HTTP monitors", included: true },
      { text: "5-minute check interval", included: true },
      { text: "3 SaaS dependencies", included: true },
      { text: "Email alerts", included: true },
      { text: "7-day incident history", included: true },
      { text: "1 workspace member", included: true },
      { text: "Cloud resources", included: false },
      { text: "Slack alerts", included: false },
      { text: "Public status page", included: false },
      { text: "Monthly reports", included: false },
    ],
  },
  {
    name: "Starter",
    monthlyPrice: 29,
    annualPrice: 23,
    description: "For solo founders and small teams getting serious.",
    highlight: false,
    cta: "Join waitlist",
    features: [
      { text: "25 HTTP monitors", included: true },
      { text: "1-minute check interval", included: true },
      { text: "Unlimited SaaS dependencies", included: true },
      { text: "Email + Slack alerts", included: true },
      { text: "30-day incident history", included: true },
      { text: "3 workspace members", included: true },
      { text: "1 cloud account (AWS/GCP/Azure)", included: true },
      { text: "Public status page", included: true },
      { text: "Monthly reports", included: false },
      { text: "SLA breach exports", included: false },
    ],
  },
  {
    name: "Pro",
    monthlyPrice: 79,
    annualPrice: 63,
    description: "For teams that need full visibility across their entire stack.",
    highlight: true,
    badge: "Most popular",
    cta: "Join waitlist",
    features: [
      { text: "Unlimited HTTP monitors", included: true },
      { text: "1-minute check interval", included: true },
      { text: "Unlimited SaaS dependencies", included: true },
      { text: "Email + Slack + webhooks", included: true },
      { text: "90-day incident history", included: true },
      { text: "10 workspace members", included: true },
      { text: "Unlimited cloud accounts", included: true },
      { text: "Public status page", included: true },
      { text: "Monthly auto-reports", included: true },
      { text: "SLA breach exports (PDF)", included: true },
    ],
  },
];

/* ── Page data ────────────────────────────────────── */

const painPoints = [
  { stat: "62%", label: "of teams find out about outages from their users — not their tools" },
  { stat: "8+", label: "SaaS dependencies on average per startup, each with their own status page" },
  { stat: "99.9%", label: "SLA promised by vendors. Very few teams actually verify this number." },
];

const features = [
  { emoji: "📡", title: "Endpoint Monitoring", desc: "Add any URL and get alerted the moment it goes down.\nCheck intervals down to 1 minute.\nEvery incident logged with timestamps and duration." },
  { emoji: "☁️", title: "Cloud Resource Visibility", desc: "Connect AWS, GCP or Azure and see all your resources.\nEC2, Lambda, RDS, S3 — state, cost, and health.\nUpdated every 2 minutes." },
  { emoji: "🔌", title: "SaaS SLA Tracking", desc: "Monitor Stripe, GitHub, Vercel and 10+ others.\nWe cross-check their status page with our own pings.\nExport breach reports for contract renegotiations." },
  { emoji: "📊", title: "Reports & Dashboards", desc: "A monthly report sent automatically on the 1st.\nShare a public status page with your clients.\nTV mode for your office screen." },
];

const steps = [
  { n: "1", title: "Add your stack", desc: "Connect your services, cloud account, and SaaS tools. Takes under 5 minutes.", icon: Search },
  { n: "2", title: "We monitor everything", desc: "MoniDuck pings your endpoints, reads vendor status pages, and tracks cloud resources — continuously.", icon: Bell },
  { n: "3", title: "You get alerted first", desc: "Instant alerts via email or Slack. One dashboard. Stop finding out from a customer complaint.", icon: Zap },
];

const saasLogos = ["Stripe", "GitHub", "Vercel", "Slack", "Datadog", "Twilio", "Cloudflare", "Notion", "Linear", "SendGrid", "Resend", "Supabase"];

const faqs = [
  { q: "Is moniduck free during the beta?", a: "Yes. Every user who joins during beta gets full Pro-tier access for free. When we launch paid plans, you'll be offered an early-bird rate as a founding member." },
  { q: "What's the difference between SaaS monitoring and just checking their status page?", a: "We combine their official status page with our own HTTP pings. If they claim 'operational' but we can't reach them — you know. We also track their monthly uptime against the SLA they promised in their contract, and can generate a breach report." },
  { q: "How long does it take to set up?", a: "Under 5 minutes to connect your first service. Each additional integration takes about 2 minutes." },
  { q: "What cloud providers do you support?", a: "AWS is fully supported (EC2, Lambda, RDS, S3, and more). GCP and Azure support is in active development." },
  { q: "How does alerting work?", a: "Define thresholds per monitor. Get notified via email, Slack, or webhook. Downtime alerts fire within 1-2 minutes of detection." },
  { q: "Is my cloud data safe?", a: "MoniDuck only requires read-only access to your cloud accounts. We never write, modify, or delete anything. Credentials are encrypted at rest." },
  { q: "Can I cancel anytime?", a: "Yes, no lock-in. Cancel anytime from your settings. Your data is kept for 30 days after cancellation." },
];

/* ── Page ──────────────────────────────────────────── */

export default function Waitlist() {
  const [submitted, setSubmitted] = useState(false);
  const [capturedEmail, setCapturedEmail] = useState("");
  const [annual, setAnnual] = useState(false);
  const { canvasRef, fire } = useConfetti();
  const waitlistCount = useWaitlistCount();

  const heroRef = useScrollReveal({ delay: 100 });
  const painRef = useScrollReveal();
  const stepsRef = useScrollReveal();
  const featuresRef = useScrollReveal();
  const pricingRef = useScrollReveal();
  const faqRef = useScrollReveal();
  const finalCtaRef = useScrollReveal();

  const handleSuccess = () => { setSubmitted(true); fire(); };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{`
        .shimmer-btn::after {
          content:''; position:absolute; top:0; left:-100%; width:100%; height:100%;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent);
          animation:shimmer 3s infinite;
        }
        @keyframes shimmer { 0%{left:-100%} 30%{left:100%} 100%{left:100%} }
        .hero-grid {
          background-image:
            linear-gradient(hsl(var(--border)/0.4) 1px,transparent 1px),
            linear-gradient(90deg,hsl(var(--border)/0.4) 1px,transparent 1px);
          background-size:64px 64px;
          mask-image:radial-gradient(ellipse 70% 60% at 50% 40%,black 20%,transparent 100%);
          -webkit-mask-image:radial-gradient(ellipse 70% 60% at 50% 40%,black 20%,transparent 100%);
        }
      `}</style>

      <canvas ref={canvasRef} className="fixed inset-0 z-[100] pointer-events-none" style={{ width: "100%", height: "100%" }} />

      {/* ─── Nav ─────────────────────────────────── */}
      <nav className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={duckLogo} alt="moniduck" className="w-10 h-10" />
            <span className="font-semibold text-xl tracking-tight">moniduck</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#pricing" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#waitlist-form">
              <Button size="sm" className="h-9">Get early access</Button>
            </a>
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-grid pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 800px 500px at 30% 40%,hsl(160 84% 39%/0.06),transparent),radial-gradient(ellipse 600px 400px at 70% 30%,hsl(280 65% 60%/0.06),transparent)",
        }} />

        <div ref={heroRef} className="relative max-w-6xl mx-auto px-6 pt-20 pb-20 md:pt-32 md:pb-28">
          <div className="grid lg:grid-cols-[1fr_420px] gap-12 lg:gap-16 items-center">

            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-success/20 bg-success/5 text-xs font-medium mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-success">Early Access — Free during beta</span>
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
                Stop finding out
                <br />about outages
                <br /><span className="text-green-600">from your users.</span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-md">
                One dashboard for your HTTP services, cloud resources, and SaaS
                dependencies. Alerts you in under 2 minutes. Works out of the box.
              </p>

              <div className="flex flex-col gap-2.5 mb-10">
                {[
                  "HTTP endpoints checked every minute",
                  "SaaS vendors held to their SLA promises",
                  "Cloud resources visible at a glance",
                ].map(item => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-success" />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <a href="#waitlist-form">
                  <Button size="lg" className="h-12 px-8 group relative overflow-hidden shimmer-btn">
                    Get early access <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </a>
                <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
                  See pricing →
                </a>
              </div>
            </div>

            {/* Right: mini dashboard mockup */}
            <div className="hidden lg:block">
              <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden shadow-2xl">
                <div className="border-b border-border px-4 py-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                  <span className="text-xs text-muted-foreground ml-2">moniduck — dashboard</span>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    { name: "Payment API", status: "up", val: "99.94%", color: "text-success" },
                    { name: "Auth Service", status: "up", val: "100%", color: "text-success" },
                    { name: "Dashboard", status: "down", val: "Down 14 min", color: "text-destructive" },
                    { name: "Stripe", status: "warn", val: "SLA breach ⚠", color: "text-warning" },
                    { name: "GitHub", status: "up", val: "99.99%", color: "text-success" },
                    { name: "AWS us-east-1", status: "up", val: "Operational", color: "text-success" },
                  ].map(row => (
                    <div key={row.name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${row.status === "up" ? "bg-success" : row.status === "down" ? "bg-destructive" : "bg-warning"}`} />
                        <span className="text-foreground font-medium">{row.name}</span>
                      </div>
                      <span className={`text-xs font-medium ${row.color}`}>{row.val}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Last checked 42s ago</span>
                  <span className="text-xs text-destructive font-medium">1 incident · 1 SLA breach</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SaaS logos bar ──────────────────────── */}
      <section className="border-t border-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <p className="text-xs text-muted-foreground text-center mb-6 uppercase tracking-widest">Monitors your SaaS dependencies including</p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {saasLogos.map(name => (
              <span key={name} className="text-sm font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pain bar ────────────────────────────── */}
      <section className="border-t border-border">
        <div ref={painRef} className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid md:grid-cols-3 gap-8 md:divide-x divide-border">
            {painPoints.map(p => (
              <div key={p.stat} className="text-center md:px-8 first:pl-0 last:pr-0">
                <div className="text-4xl font-bold text-foreground mb-2">{p.stat}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────── */}
      <section className="border-t border-border bg-card/20">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div ref={stepsRef} className="text-center mb-16">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Up and running <span className="text-primary">in 5 minutes.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">No complex configuration. No DevOps degree required.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-border" />
            {steps.map(step => (
              <div key={step.n} className="flex flex-col items-center text-center relative">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 relative z-10">
                  <step.icon className="w-6 h-6 text-primary" />
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{step.n}</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ────────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div ref={featuresRef} className="text-center mb-16">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Features</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Your entire stack. <span className="text-primary">One place.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Most monitoring tools cover one layer. MoniDuck covers all three.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map(f => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors text-2xl">{f.emoji}</div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─────────────────────────────── */}
      <section id="pricing" className="border-t border-border bg-card/20">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div ref={pricingRef} className="text-center mb-12">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Simple pricing. <span className="text-primary">No surprises.</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Start free. Upgrade when you need more. Early access users get Pro for free during beta.
            </p>

            {/* Toggle */}
            <div className="inline-flex items-center gap-3 bg-muted rounded-full px-2 py-1.5">
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

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {pricingTiers.map(tier => (
              <div
                key={tier.name}
                className={`rounded-2xl border p-7 relative flex flex-col ${
                  tier.highlight
                    ? "border-primary bg-card shadow-[0_0_60px_-10px_hsl(160_84%_39%_/_0.15)] scale-[1.02]"
                    : "border-border bg-card"
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded-full">
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-1">{tier.name}</h3>
                  <p className="text-sm text-muted-foreground mb-5">{tier.description}</p>
                  <div className="flex items-end gap-1.5">
                    <span className="text-4xl font-bold text-foreground">
                      ${annual ? tier.annualPrice : tier.monthlyPrice}
                    </span>
                    {tier.monthlyPrice > 0 && (
                      <span className="text-muted-foreground text-sm mb-1.5">/mo{annual && " · billed annually"}</span>
                    )}
                    {tier.monthlyPrice === 0 && (
                      <span className="text-muted-foreground text-sm mb-1.5">forever</span>
                    )}
                  </div>
                  {annual && tier.monthlyPrice > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ${tier.annualPrice * 12}/year · saves ${(tier.monthlyPrice - tier.annualPrice) * 12}/year
                    </p>
                  )}
                </div>

                <a href="#waitlist-form" className="block mb-7">
                  <Button
                    size="lg"
                    className={`w-full h-11 ${tier.highlight ? "" : "variant-outline"}`}
                    variant={tier.highlight ? "default" : "outline"}
                  >
                    {tier.cta}
                  </Button>
                </a>

                <ul className="space-y-3 flex-1">
                  {tier.features.map(f => (
                    <li key={f.text} className={`flex items-center gap-3 text-sm ${f.included ? "text-foreground" : "text-muted-foreground/50"}`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${f.included ? "bg-success/10" : "bg-muted"}`}>
                        {f.included
                          ? <Check className="w-2.5 h-2.5 text-success" />
                          : <X className="w-2.5 h-2.5 text-muted-foreground/30" />
                        }
                      </span>
                      {f.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-primary/20 bg-primary/5 px-6 py-5 text-center max-w-2xl mx-auto">
            <p className="text-sm font-medium text-foreground mb-1">
              🎁 Early access = free Pro tier, forever
            </p>
            <p className="text-xs text-muted-foreground">
              Join now during beta and lock in Pro features at no cost. When paid plans launch, you'll get a founding member discount.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Product preview ─────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-12">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Preview</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">What your dashboard looks like.</h2>
          </div>

          <div className="space-y-10">
            {/* Services */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" /> HTTP Services
              </h3>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground text-left">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">URL</th>
                    <th className="px-5 py-3 font-medium text-right">Uptime</th>
                  </tr></thead>
                  <tbody>
                    {[
                      { name: "Payment API", url: "api.myapp.com", up: true, val: "99.94%" },
                      { name: "Auth Service", url: "auth.myapp.com", up: true, val: "100%" },
                      { name: "Dashboard", url: "app.myapp.com", up: false, val: "⚠ Down 14 min" },
                      { name: "Webhook Handler", url: "hooks.myapp.com", up: true, val: "99.71%" },
                    ].map(s => (
                      <tr key={s.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-foreground">{s.name}</td>
                        <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">{s.url}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`inline-flex items-center gap-1.5 font-medium ${s.up ? "text-success" : "text-destructive"}`}>
                            <span className={`w-2 h-2 rounded-full ${s.up ? "bg-success" : "bg-destructive"}`} />{s.val}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SaaS with SLA */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <Plug className="w-3.5 h-3.5" /> SaaS Dependencies — SLA tracking
              </h3>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground text-left">
                    <th className="px-5 py-3 font-medium">Provider</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">SLA promised</th>
                    <th className="px-5 py-3 font-medium text-right">Actual uptime</th>
                  </tr></thead>
                  <tbody>
                    {[
                      { name: "Stripe", status: "Operational", promised: "99.99%", actual: "99.71%", breach: true },
                      { name: "GitHub", status: "Operational", promised: "99.95%", actual: "99.99%", breach: false },
                      { name: "Vercel", status: "Degraded", promised: "99.99%", actual: "99.84%", breach: true },
                    ].map(s => (
                      <tr key={s.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-foreground">{s.name}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.status === "Operational" ? "text-success" : "text-warning"}`}>
                            <span className={`w-2 h-2 rounded-full ${s.status === "Operational" ? "bg-success" : "bg-warning"}`} />{s.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{s.promised}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`font-medium ${s.breach ? "text-warning" : "text-success"}`}>{s.actual} {s.breach && "⚠️"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                SLA breach = vendor uptime fell below their contractual promise. Export as PDF to renegotiate.
              </p>
            </div>

            {/* Cloud */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <Cloud className="w-3.5 h-3.5" /> Cloud Resources
              </h3>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground text-left">
                    <th className="px-5 py-3 font-medium">Resource</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Cost</th>
                  </tr></thead>
                  <tbody>
                    {[
                      { name: "web-prod-01", type: "EC2 · t3.medium", status: "Running", cost: "$47/mo" },
                      { name: "prod-db", type: "RDS · db.t3.micro", status: "Available", cost: "$89/mo" },
                      { name: "api-lambda", type: "Lambda", status: "Active", cost: "$3/mo" },
                    ].map(r => (
                      <tr key={r.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-foreground">{r.name}</td>
                        <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">{r.type}</td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-success text-xs font-medium">
                            <span className="w-2 h-2 rounded-full bg-success" />{r.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium text-foreground">{r.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────── */}
      <section className="border-t border-border bg-card/20">
        <div className="max-w-2xl mx-auto px-6 py-20 md:py-28">
          <h2 ref={faqRef} className="text-3xl md:text-4xl font-bold tracking-tight mb-12 text-center">Questions?</h2>
          {faqs.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────── */}
      <section id="waitlist-form" className="border-t border-border scroll-mt-16">
        <div ref={finalCtaRef} className="max-w-3xl mx-auto px-6 py-20 md:py-28 text-center">
          <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">Early access · Free</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Your users shouldn't be
            <br /><span className="text-primary">your monitoring system.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Join the waitlist. Get full Pro access free during beta. No credit card required.
          </p>
          {submitted
            ? <SuccessCard email={capturedEmail} />
            : (
              <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-7 shadow-[0_0_80px_-20px_hsl(160_84%_39%_/_0.08)] max-w-md mx-auto text-left">
                <div className="flex items-center gap-2 mb-5">
                  <Sparkles className="w-4 h-4 text-success" />
                  <span className="text-sm font-medium">Get early access</span>
                </div>
                <WaitlistForm onSuccess={handleSuccess} onEmailCapture={setCapturedEmail} waitlistCount={waitlistCount} />
              </div>
            )}
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={duckLogo} alt="moniduck" className="w-6 h-6" />
            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} moniduck</span>
          </div>
          <p className="text-xs text-muted-foreground">Made for teams who ship fast and sleep well.</p>
        </div>
      </footer>
    </div>
  );
}
