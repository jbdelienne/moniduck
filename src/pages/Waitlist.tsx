import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowRight, Check, ChevronDown, Copy, Linkedin,
  Sparkles,
  Globe, Cloud, Plug, Zap, Settings, Clock } from
"lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import duckLogo from "@/assets/moniduck-logo.png";
import { useScrollReveal, useStaggerReveal } from "@/hooks/use-scroll-reveal";

/* ── Solutions data ───────────────────────────────── */

const solutions = [
{
  emoji: "📡",
  title: "Endpoint Monitoring",
  desc: "Add any URL and get notified the moment it goes down.\nCheck intervals from 1 to 5 minutes.\nEvery incident logged with timestamps and duration."
},
{
  emoji: "☁️",
  title: "Cloud Auto-Discovery",
  desc: "Connect AWS and instantly see all your resources.\nEC2, Lambda, RDS, S3 — their state, cost, and health.\nUpdated every 2 minutes."
},
{
  emoji: "🔌",
  title: "SaaS Status Tracking",
  desc: "Monitor Stripe, GitHub, Vercel and more.\nTrack their real uptime against their promised SLA.\nExport proof for contract renegotiations."
},
{
  emoji: "📊",
  title: "Reports & Dashboards",
  desc: "A monthly report sent automatically on the 1st.\nCustomizable dashboards for your team.\nShare a public status page with your clients."
}];


const differentiators = [
{ text: "Ready in under 5 minutes", icon: Zap },
{ text: "Works out of the box", icon: Settings },
{ text: "2-minute setup per integration", icon: Clock }];


const faqs = [
{ q: "Is moniduck free during the beta?", a: "Yes. Early access users get the full product free during our beta period. No credit card required." },
{ q: "How long does it take to set up?", a: "It takes less than 2 minutes to set up each integration." },
{ q: "What can moniduck monitor?", a: "HTTP endpoints, AWS resources (EC2, Lambda, RDS, S3), SaaS providers, and Google Drive storage usage." },
{ q: "How does alerting work?", a: "You define thresholds and we notify you via email, Slack (incoming) or both. Downtime alerts are instant." },
{ q: "Is my AWS data safe?", a: "MoniDuck only requires read-only access to your AWS account. We never write, modify, or delete anything. Your credentials are encrypted at rest." },
{ q: "When will early access open?", a: "We're onboarding our first users progressively. Join the waitlist and you'll be among the first to know." }];


/* ── Confetti ─────────────────────────────────────── */
interface Particle {
  x: number;y: number;vx: number;vy: number;
  color: string;size: number;rotation: number;rotationSpeed: number;life: number;
}

const CONFETTI_COLORS = [
"hsl(161, 93%, 30%)", "hsl(38, 92%, 50%)", "hsl(217, 91%, 60%)",
"hsl(160, 84%, 39%)", "hsl(280, 70%, 55%)", "hsl(350, 80%, 55%)"];


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
        life: 1
      });
    }
    const animate = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current = particles.current.filter((p) => p.life > 0);
      for (const p of particles.current) {
        p.x += p.vx;p.vy += 0.35;p.y += p.vy;
        p.rotation += p.rotationSpeed;p.life -= 0.01;
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

  useEffect(() => () => {if (raf.current) cancelAnimationFrame(raf.current);}, []);
  return { canvasRef, fire };
}

/* ── Animated Counter ─────────────────────────────── */
function AnimatedCounter({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return <span ref={ref}>{count}</span>;
}

/* ── FAQ Item ─────────────────────────────────────── */
function FaqItem({ q, a }: {q: string;a: string;}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group">
        
        <span className="font-medium text-foreground pr-4">{q}</span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-40 pb-5" : "max-h-0"}`}>
        <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
      </div>
    </div>);

}

/* ── Waitlist Form ────────────────────────────────── */
function WaitlistForm({
  onSuccess,
  onEmailCapture,
  variant = "default"
}: {onSuccess: () => void;onEmailCapture?: (email: string) => void;variant?: "default" | "compact";}) {
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
        company: company.trim() || null
      });
      if (error && error.code !== "23505") {
        throw error;
      }
      try {
        await supabase.functions.invoke("waitlist-welcome", {
          body: { email: normalizedEmail, firstName: firstName.trim() || null, company: company.trim() || null }
        });
      } catch {/* best-effort */}
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
          className="h-12 text-base flex-1" />
        
        <Button type="submit" size="lg" className="h-12 px-8 shrink-0 group" disabled={loading}>
          {loading ?
          <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Joining...
            </span> :

          <>Join the waitlist <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></>
          }
        </Button>
      </form>);

  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="text"
        placeholder="First name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        className="h-12 text-base"
        maxLength={100} />
      
      <Input
        type="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="h-12 text-base"
        maxLength={255} />
      
      <Input
        type="text"
        placeholder="Company (optional)"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="h-12 text-base"
        maxLength={200} />
      
      <Button type="submit" size="lg" className="w-full h-12 text-base group relative overflow-hidden shimmer-btn" disabled={loading}>
        {loading ?
        <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Joining...
          </span> :

        <>Join the waitlist <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" /></>
        }
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        🔥 <AnimatedCounter target={12} /> people on the waitlist · Early access closes soon
      </p>
    </form>);

}

/* ── Success state ────────────────────────────────── */
function SuccessCard({ email }: {email: string;}) {
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  const shareOnLinkedIn = () => {
    const text = encodeURIComponent("Just joined the @moniduck waitlist — monitoring for modern tech stacks. Check it out 👇");
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
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="sm" onClick={shareOnLinkedIn} className="gap-2">
          <Linkedin className="w-4 h-4" /> Share on LinkedIn
        </Button>
        <Button variant="outline" size="sm" onClick={copyLink} className="gap-2">
          <Copy className="w-4 h-4" /> Copy link
        </Button>
      </div>
    </div>);

}

/* ── Page ──────────────────────────────────────────── */

export default function Waitlist() {
  const [submitted, setSubmitted] = useState(false);
  const [capturedEmail, setCapturedEmail] = useState("");
  const { canvasRef, fire } = useConfetti();

  // Scroll reveal refs
  const heroRef = useScrollReveal({ delay: 100 });
  const solutionsHeaderRef = useScrollReveal();
  const solutionsGridRef = useStaggerReveal(solutions.length, 120);
  const faqHeaderRef = useScrollReveal();
  const finalCtaRef = useScrollReveal();

  const handleSuccess = () => {
    setSubmitted(true);
    fire();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Shimmer CSS */}
      <style>{`
        .shimmer-btn::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.12),
            transparent
          );
          animation: shimmer 3s infinite;
        }
        @keyframes shimmer {
          0% { left: -100%; }
          30% { left: 100%; }
          100% { left: 100%; }
        }
      `}</style>

      {/* Confetti */}
      <canvas ref={canvasRef} className="fixed inset-0 z-[100] pointer-events-none" style={{ width: "100%", height: "100%" }} />

      {/* ─── Nav ─────────────────────────────────── */}
      <nav className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={duckLogo} alt="moniduck" className="w-12 h-12" />
            <span className="font-semibold text-2xl tracking-tight">moniduck</span>
          </div>
          <a href="#waitlist-form" className="hidden sm:inline-flex">
            <Button size="sm" className="h-9">
              Get Early Access
            </Button>
          </a>
        </div>
      </nav>

      {/* ─── Hero (centered, single column) ──────── */}
      <section className="relative max-w-6xl mx-auto px-6 pt-16 pb-16 md:pt-24 md:pb-24">
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 600px 400px at 50% 30%, rgba(146, 127, 191, 0.15), transparent)"
          }}
        />

        <div ref={heroRef} className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs text-primary font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Early Access — Limited Spots
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.08] mb-5 text-left">
            One platform for
            <br />
            <span className="text-green-600">full-stack visibility.</span>
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg mx-auto">
            Services, cloud, and SaaS — monitored from a single dashboard.
            Set up in 5 minutes. Works out of the box.
          </p>

          {/* Form */}
          <div id="waitlist-form" className="scroll-mt-24 max-w-[480px] mx-auto mb-8">
            {submitted ? <SuccessCard email={capturedEmail} /> :
            <div className="rounded-2xl border border-border bg-card p-6 shadow-lg hover:shadow-xl hover:border-primary/20 transition-all duration-500">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Get early access</span>
                </div>
                <WaitlistForm onSuccess={handleSuccess} onEmailCapture={setCapturedEmail} />
              </div>
            }
          </div>

          {/* Differentiators */}
          <div className="flex flex-wrap justify-center gap-4">
            {differentiators.map((d) => <div key={d.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <d.icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <span>{d.text}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Solutions ───────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div ref={solutionsHeaderRef} className="text-center mb-16">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Solutions</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Four problems. <span className="text-primary">One platform.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              moniduck doesn't just ping URLs. It solves real operational challenges for DevOps and Platform teams.
            </p>
          </div>

          <div ref={solutionsGridRef} className="grid md:grid-cols-2 gap-6">
            {solutions.map((sol) =>
            <div
              key={sol.title}
              className="rounded-xl border border-border bg-card p-6 hover:border-primary/30 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 group">
              
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors text-2xl">
                  {sol.emoji}
                </div>
                <h3 className="text-lg font-semibold mb-2">{sol.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{sol.desc}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Preview: Services ─────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-10">
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Preview</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              See what's inside.
            </h2>
          </div>

          {/* Services Table */}
          <div className="mb-12">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Services
            </h3>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">URL</th>
                    <th className="px-5 py-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "Payment API", url: "api.myapp.com", status: "up", uptime: "99.94%" },
                    { name: "Auth Service", url: "auth.myapp.com", status: "up", uptime: "100%" },
                    { name: "Dashboard", url: "app.myapp.com", status: "down", uptime: "Down 14 min" },
                    { name: "Webhook Handler", url: "hooks.myapp.com", status: "up", uptime: "99.71%" },
                  ].map((s) => (
                    <tr key={s.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-foreground">{s.name}</td>
                      <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">{s.url}</td>
                      <td className="px-5 py-3.5 text-right">
                        {s.status === "up" ? (
                          <span className="inline-flex items-center gap-1.5 text-success font-medium">
                            <span className="w-2 h-2 rounded-full bg-success" />
                            {s.uptime}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-destructive font-medium">
                            <span className="w-2 h-2 rounded-full bg-destructive" />
                            {s.uptime}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cloud Table */}
          <div className="mb-12">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
              <Cloud className="w-4 h-4" /> Cloud
            </h3>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="px-5 py-3 font-medium">Resource</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "web-prod-01", type: "EC2", status: "Running", instance: "t3.medium", cost: "$47/mo" },
                    { name: "prod-db", type: "RDS", status: "Available", instance: "—", cost: "$89/mo" },
                  ].map((r) => (
                    <tr key={r.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-foreground">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.type}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-success text-xs font-medium">
                          <span className="w-2 h-2 rounded-full bg-success" />
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">{r.instance}</td>
                      <td className="px-5 py-3.5 text-right font-medium text-foreground">{r.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SaaS Table */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
              <Plug className="w-4 h-4" /> SaaS
            </h3>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="px-5 py-3 font-medium">Provider</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "Stripe", status: "Operational", sla: "99.71%", warning: true },
                    { name: "GitHub", status: "Operational", sla: "99.99%", warning: false },
                  ].map((s) => (
                    <tr key={s.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-foreground">{s.name}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-success text-xs font-medium">
                          <span className="w-2 h-2 rounded-full bg-success" />
                          {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-medium text-foreground">{s.sla}</span>
                        {s.warning && <span className="ml-1.5 text-warning">⚠️</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-2xl mx-auto px-6 py-20 md:py-28">
          <h2 ref={faqHeaderRef} className="text-3xl md:text-4xl font-bold tracking-tight mb-12 text-center">
            Questions?
          </h2>
          <div>
            {faqs.map((f) =>
            <FaqItem key={f.q} q={f.q} a={f.a} />
            )}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────── */}
      <section className="border-t border-border bg-card/40">
        <div ref={finalCtaRef} className="max-w-3xl mx-auto px-6 py-20 md:py-28 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Early access. <span className="text-primary">Free to start.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Join the waitlist and be among the first to try moniduck. No credit card required.
          </p>
          {submitted ? <SuccessCard email={capturedEmail} /> :
          <WaitlistForm onSuccess={handleSuccess} onEmailCapture={setCapturedEmail} variant="compact" />
          }
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={duckLogo} alt="moniduck" className="w-6 h-6" />
            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} moniduck</span>
          </div>
        </div>
      </footer>
    </div>);

}
