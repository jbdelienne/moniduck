import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowRight, Check, ChevronDown, Copy, Linkedin,
  Sparkles, Globe, Cloud, Plug, Bell, Search, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import duckLogo from "@/assets/moniduck-logo.png";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

/* ── Waitlist count ────────────────────────────────── */

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
  "hsl(161, 93%, 30%)", "hsl(38, 92%, 50%)", "hsl(217, 91%, 60%)",
  "hsl(160, 84%, 39%)", "hsl(280, 70%, 55%)", "hsl(350, 80%, 55%)",
];

function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef<number>();

  const fire = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const cx = canvas.width / 2;
    for (let i = 0; i < 150; i++) {
      particles.current.push({
        x: cx + (Math.random() - 0.5) * 300,
        y: canvas.height * 0.3,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 18 - 4,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: Math.random() * 7 + 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 14,
        life: 1,
      });
    }
    const animate = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current = particles.current.filter((p) => p.life > 0);
      for (const p of particles.current) {
        p.x += p.vx; p.vy += 0.35; p.y += p.vy;
        p.rotation += p.rotationSpeed; p.life -= 0.01;
        ctx.save();
        ctx.translate(p.x, p.y);
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
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="font-medium text-foreground pr-4">{q}</span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-40 pb-5" : "max-h-0"}`}>
        <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

/* ── Waitlist Form ────────────────────────────────── */
function WaitlistForm({
  onSuccess,
  onEmailCapture,
  variant = "default",
  waitlistCount,
}: {
  onSuccess: () => void;
  onEmailCapture?: (email: string) => void;
  variant?: "default" | "compact";
  waitlistCount: number;
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (variant === "compact") {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
        <Input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-12 text-base flex-1"
        />
        <Button type="submit" size="lg" className="h-12 px-8 shrink-0 group" disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Joining...
            </span>
          ) : (
            <>Get early access <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></>
          )}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="text"
        placeholder="First name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        className="h-12 text-base"
        maxLength={100}
      />
      <Input
        type="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="h-12 text-base"
        maxLength={255}
      />
      <Input
        type="text"
        placeholder="Company (optional)"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="h-12 text-base"
        maxLength={200}
      />
      <Button type="submit" size="lg" className="w-full h-12 text-base group relative overflow-hidden shimmer-btn" disabled={loading}>
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Joining...
          </span>
        ) : (
          <>Get early access <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></>
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        🔥 <AnimatedCounter target={waitlistCount} /> founders already on the list · Free during beta
      </p>
    </form>
  );
}

/* ── Success state ────────────────────────────────── */
function SuccessCard({ email }: { email: string }) {
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  const shareOnLinkedIn = () => {
    const text = encodeURIComponent("Just joined the @moniduck waitlist — one dashboard to monitor your entire stack. Check it out 👇");
    const url = encodeURIComponent(pageUrl);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}&summary=${text}`, "_blank");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(pageUrl);
    toast.success("Link copied!");
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-8 animate-scale-in text-center">
      <div className="text-5xl mb-4 animate-bounce">🦆</div>
      <p className="text-xl font-semibold mb-2">You're on the list!</p>
      <p className="text-sm text-muted-foreground mb-6">
        Confirmation sent to <span className="font-medium text-foreground">{email}</span>
      </p>
      <p className="text-xs text-muted-foreground mb-6">
        Help us grow — share with a founder who's tired of finding out about outages from their users.
      </p>
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

/* ── Data ─────────────────────────────────────────── */

const painPoints = [
  {
    stat: "62%",
    label: "of teams find out about outages from their users — not their tools",
  },
  {
    stat: "8+",
    label: "SaaS dependencies on average per startup, each with their own status page",
  },
  {
    stat: "99.9%",
    label: "SLA promised. But who actually checks if vendors keep that promise?",
  },
];

const features = [
  {
    icon: Globe,
    emoji: "📡",
    title: "Endpoint Monitoring",
    desc: "Add any URL and get alerted the moment it goes down.\nCheck intervals from 1 to 5 minutes.\nEvery incident logged with timestamps and duration.",
  },
  {
    icon: Cloud,
    emoji: "☁️",
    title: "Cloud Resource Visibility",
    desc: "Connect AWS and instantly see all your resources.\nEC2, Lambda, RDS, S3 — their state, cost, and health.\nUpdated every 2 minutes.",
  },
  {
    icon: Plug,
    emoji: "🔌",
    title: "SaaS SLA Tracking",
    desc: "Monitor Stripe, GitHub, Vercel and more.\nWe cross-check their status page against our own pings.\nExport breach reports for contract renegotiations.",
  },
  {
    icon: BarChart3,
    emoji: "📊",
    title: "Reports & Dashboards",
    desc: "A monthly report sent automatically on the 1st.\nCustomizable dashboards for your team.\nShare a public status page with your clients.",
  },
];

const steps = [
  {
    n: "1",
    title: "Add your stack",
    desc: "Connect your services, cloud account, and SaaS tools. Takes under 5 minutes.",
    icon: Search,
  },
  {
    n: "2",
    title: "We monitor everything",
    desc: "moniduck pings your endpoints, reads vendor status pages, and tracks your cloud resources — continuously.",
    icon: Bell,
  },
  {
    n: "3",
    title: "You get alerted first",
    desc: "Instant alerts via email or Slack. One dashboard. No more finding out from a customer tweet.",
    icon: Check,
  },
];

const personas = [
  {
    emoji: "🧑‍💻",
    title: "Solo founders",
    desc: "You wear every hat. moniduck watches your infra so you can focus on the product.",
  },
  {
    emoji: "🏗️",
    title: "CTOs & tech leads",
    desc: "Give your team full visibility without a dedicated SRE. Ready in a morning.",
  },
  {
    emoji: "📦",
    title: "SaaS companies",
    desc: "Know when Stripe, GitHub or Vercel are the reason your product feels slow. Before your users notice.",
  },
];

const faqs = [
  { q: "Is moniduck free during the beta?", a: "Yes. Early access users get the full product free during our beta period. No credit card required." },
  { q: "How long does it take to set up?", a: "Under 5 minutes to connect your first service. Under 2 minutes per additional integration." },
  { q: "What exactly does moniduck monitor?", a: "HTTP endpoints, AWS resources (EC2, Lambda, RDS, S3), SaaS providers (Stripe, GitHub, Vercel and more), and cloud region statuses." },
  { q: "How is SaaS monitoring different from just checking their status page?", a: "We combine their status page data with our own HTTP pings. If they say operational but we can't reach them, you'll know. We also track uptime against the SLA they promised you." },
  { q: "How does alerting work?", a: "You define thresholds and we notify you via email, Slack, or both. Downtime alerts are instant." },
  { q: "Is my AWS data safe?", a: "moniduck only requires read-only access to your AWS account. We never write, modify, or delete anything. Your credentials are encrypted at rest." },
  { q: "When will early access open?", a: "We're onboarding our first users progressively. Join the waitlist and you'll be among the first." },
];

/* ── Page ──────────────────────────────────────────── */

export default function Waitlist() {
  const [submitted, setSubmitted] = useState(false);
  const [capturedEmail, setCapturedEmail] = useState("");
  const { canvasRef, fire } = useConfetti();
  const waitlistCount = useWaitlistCount();

  const heroRef = useScrollReveal({ delay: 100 });
  const painRef = useScrollReveal();
  const featuresHeaderRef = useScrollReveal();
  const stepsRef = useScrollReveal();
  const personasRef = useScrollReveal();
  const faqHeaderRef = useScrollReveal();
  const finalCtaRef = useScrollReveal();

  const handleSuccess = () => {
    setSubmitted(true);
    fire();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{`
        .shimmer-btn::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
          animation: shimmer 3s infinite;
        }
        @keyframes shimmer {
          0% { left: -100%; }
          30% { left: 100%; }
          100% { left: 100%; }
        }
        .hero-grid {
          background-image:
            linear-gradient(hsl(var(--border) / 0.4) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--border) / 0.4) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 100%);
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
          <a href="#waitlist-form" className="hidden sm:inline-flex">
            <Button size="sm" className="h-9">Get early access</Button>
          </a>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-grid pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 800px 500px at 30% 40%, hsl(160 84% 39% / 0.06), transparent), radial-gradient(ellipse 600px 400px at 70% 30%, hsl(280 65% 60% / 0.06), transparent)",
          }}
        />

        <div ref={heroRef} className="relative max-w-6xl mx-auto px-6 pt-20 pb-20 md:pt-32 md:pb-28">
          <div className="grid lg:grid-cols-[1fr_420px] gap-12 lg:gap-16 items-center">

            {/* Left: Copy */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-success/20 bg-success/5 text-xs font-medium mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-success">Early Access — Free during beta</span>
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
                Stop finding out
                <br />
                about outages
                <br />
                <span className="text-green-600">from your users.</span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-md">
                moniduck monitors your services, cloud resources, and SaaS
                dependencies — and alerts you before your customers notice anything.
              </p>

              <div className="flex flex-col gap-2.5">
                {[
                  "HTTP endpoints checked every minute",
                  "SaaS vendors held to their SLA promises",
                  "Cloud resources visible at a glance",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-success" />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Form */}
            <div id="waitlist-form" className="scroll-mt-24">
              {submitted ? (
                <SuccessCard email={capturedEmail} />
              ) : (
                <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-7 shadow-[0_0_80px_-20px_hsl(160_84%_39%_/_0.08)]">
                  <div className="flex items-center gap-2 mb-5">
                    <Sparkles className="w-4 h-4 text-success" />
                    <span className="text-sm font-medium text-foreground">Get early access</span>
                  </div>
                  <WaitlistForm
                    onSuccess={handleSuccess}
                    onEmailCapture={setCapturedEmail}
                    waitlistCount={waitlistCount}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pain bar ────────────────────────────── */}
      <section className="border-t border-border bg-card/40">
        <div ref={painRef} className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-3 gap-8 md:divide-x divide-border">
            {painPoints.map((p) => (
              <div key={p.stat} className="text-center md:px-8 first:pl-0 last:pr-0">
                <div className="text-4xl font-bold text-foreground mb-2">{p.stat}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div ref={stepsRef} className="text-center mb-16">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Up and running <span className="text-primary">in 5 minutes.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              No complex configuration. No DevOps degree required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-8 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-border" />

            {steps.map((step) => (
              <div key={step.n} className="flex flex-col items-center text-center relative">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 relative z-10">
                  <step.icon className="w-6 h-6 text-primary" />
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {step.n}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ────────────────────────────── */}
      <section className="border-t border-border bg-card/20">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div ref={featuresHeaderRef} className="text-center mb-16">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Features</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Your entire stack. <span className="text-primary">One place.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Most monitoring tools cover one layer. moniduck covers all three.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors text-2xl">
                  {f.emoji}
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Preview ─────────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-12">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Preview</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              What your dashboard looks like.
            </h2>
          </div>

          {/* Services */}
          <div className="mb-10">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" /> Services
            </h3>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">URL</th>
                    <th className="px-5 py-3 font-medium text-right">Uptime</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "Payment API", url: "api.myapp.com", status: "up", uptime: "99.94%" },
                    { name: "Auth Service", url: "auth.myapp.com", status: "up", uptime: "100%" },
                    { name: "Dashboard", url: "app.myapp.com", status: "down", uptime: "⚠ Down 14 min" },
                    { name: "Webhook Handler", url: "hooks.myapp.com", status: "up", uptime: "99.71%" },
                  ].map((s) => (
                    <tr key={s.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-foreground">{s.name}</td>
                      <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">{s.url}</td>
                      <td className="px-5 py-3.5 text-right">
                        {s.status === "up" ? (
                          <span className="inline-flex items-center gap-1.5 text-success font-medium">
                            <span className="w-2 h-2 rounded-full bg-success" />{s.uptime}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-destructive font-medium">
                            <span className="w-2 h-2 rounded-full bg-destructive" />{s.uptime}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cloud */}
          <div className="mb-10">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
              <Cloud className="w-3.5 h-3.5" /> Cloud resources
            </h3>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="px-5 py-3 font-medium">Resource</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "web-prod-01", type: "EC2 · t3.medium", status: "Running", cost: "$47/mo" },
                    { name: "prod-db", type: "RDS · db.t3.micro", status: "Available", cost: "$89/mo" },
                  ].map((r) => (
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

          {/* SaaS */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
              <Plug className="w-3.5 h-3.5" /> SaaS dependencies
            </h3>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="px-5 py-3 font-medium">Provider</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">SLA promised</th>
                    <th className="px-5 py-3 font-medium text-right">Actual uptime</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "Stripe", status: "Operational", slaPromised: "99.99%", actual: "99.71%", breach: true },
                    { name: "GitHub", status: "Operational", slaPromised: "99.95%", actual: "99.99%", breach: false },
                    { name: "Vercel", status: "Degraded", slaPromised: "99.99%", actual: "99.84%", breach: true },
                  ].map((s) => (
                    <tr key={s.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-foreground">{s.name}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.status === "Operational" ? "text-success" : "text-warning"}`}>
                          <span className={`w-2 h-2 rounded-full ${s.status === "Operational" ? "bg-success" : "bg-warning"}`} />
                          {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{s.slaPromised}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-medium ${s.breach ? "text-warning" : "text-success"}`}>
                          {s.actual} {s.breach && "⚠️"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              SLA breach = their uptime fell below what they promised you. Most teams never notice.
            </p>
          </div>
        </div>
      </section>

      {/* ─── For who ─────────────────────────────── */}
      <section className="border-t border-border bg-card/20">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
          <div ref={personasRef} className="text-center mb-14">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Who it's for</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Built for small teams <span className="text-primary">with high standards.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {personas.map((p) => (
              <div key={p.title} className="rounded-xl border border-border bg-card p-6 text-center">
                <div className="text-4xl mb-4">{p.emoji}</div>
                <h3 className="text-base font-semibold mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-2xl mx-auto px-6 py-20 md:py-28">
          <h2 ref={faqHeaderRef} className="text-3xl md:text-4xl font-bold tracking-tight mb-12 text-center">
            Questions?
          </h2>
          {faqs.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────── */}
      <section className="border-t border-border bg-card/40">
        <div ref={finalCtaRef} className="max-w-3xl mx-auto px-6 py-20 md:py-28 text-center">
          <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">Early access</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Your users shouldn't be
            <br />
            <span className="text-primary">your monitoring system.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Join the waitlist. Free during beta. No credit card required.
          </p>
          {submitted ? (
            <SuccessCard email={capturedEmail} />
          ) : (
            <WaitlistForm
              onSuccess={handleSuccess}
              onEmailCapture={setCapturedEmail}
              variant="compact"
              waitlistCount={waitlistCount}
            />
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
