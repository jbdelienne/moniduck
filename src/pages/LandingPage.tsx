import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Check, ChevronDown, X, Globe, Cloud, Plug,
  Bell, Search, BarChart3, Zap, Shield, TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import duckLogo from "@/assets/moniduck-logo.png";

/* ── Pricing ──────────────────────────────────────── */

type Tier = {
  name: string;
  mo: number;
  annual: number;
  desc: string;
  popular: boolean;
  features: { text: string; ok: boolean }[];
};

const tiers: Tier[] = [
  {
    name: "Solo",
    mo: 49,
    annual: 39,
    desc: "Pour les founders qui gèrent tout seuls.",
    popular: false,
    features: [
      { text: "10 services HTTP", ok: true },
      { text: "Vérification toutes les 5 min", ok: true },
      { text: "5 dépendances SaaS", ok: true },
      { text: "Alertes email", ok: true },
      { text: "Historique 7 jours", ok: true },
      { text: "1 membre", ok: true },
      { text: "Ressources cloud", ok: false },
      { text: "Alertes Slack", ok: false },
      { text: "Page de statut publique", ok: false },
      { text: "Rapports SLA (PDF)", ok: false },
    ],
  },
  {
    name: "Startup",
    mo: 129,
    annual: 99,
    desc: "Pour les équipes qui ne peuvent pas se permettre de rater un incident.",
    popular: true,
    features: [
      { text: "50 services HTTP", ok: true },
      { text: "Vérification toutes les minutes", ok: true },
      { text: "SaaS illimités", ok: true },
      { text: "Email + Slack + webhooks", ok: true },
      { text: "Historique 30 jours", ok: true },
      { text: "5 membres", ok: true },
      { text: "2 comptes cloud (AWS/GCP/Azure)", ok: true },
      { text: "Page de statut publique", ok: true },
      { text: "Rapports SLA mensuels (PDF)", ok: true },
      { text: "API access", ok: false },
    ],
  },
  {
    name: "Scale",
    mo: 299,
    annual: 239,
    desc: "Pour les équipes avec une vraie infra et des SLA contractuels à défendre.",
    popular: false,
    features: [
      { text: "Services HTTP illimités", ok: true },
      { text: "Vérification toutes les minutes", ok: true },
      { text: "SaaS illimités", ok: true },
      { text: "Email + Slack + webhooks + API", ok: true },
      { text: "Historique 90 jours", ok: true },
      { text: "15 membres", ok: true },
      { text: "Comptes cloud illimités", ok: true },
      { text: "Page de statut white-label", ok: true },
      { text: "Exports SLA (PDF + CSV)", ok: true },
      { text: "Support prioritaire (réponse < 4h)", ok: true },
    ],
  },
];

/* ── FAQ data ─────────────────────────────────────── */

const faqs = [
  {
    q: "Pourquoi ne pas utiliser UptimeRobot ou Pingdom ?",
    a: "Ces outils pinguent vos URLs — c'est tout. MoniDuck fait ça, mais aussi : cross-check les status pages de vos SaaS avec nos propres pings, track l'uptime réel de Stripe/GitHub/Vercel contre leur SLA contractuel, surveille vos ressources cloud et leurs coûts. C'est la différence entre un thermomètre et un bilan de santé.",
  },
  {
    q: "Concrètement, c'est quoi un 'rapport SLA' ?",
    a: "Quand Stripe tombe 3 fois ce mois-ci et que leur uptime réel est à 99.71% au lieu des 99.99% contractuels, MoniDuck génère un PDF avec les dates, durées, et l'écart vs leur SLA. Vous l'envoyez à leur support et vous négociez des crédits. Un seul recours peut vous rembourser un an d'abonnement.",
  },
  {
    q: "En combien de temps je suis opérationnel ?",
    a: "Moins de 5 minutes pour le premier service. 2 minutes par intégration supplémentaire. Pas de configuration serveur, pas d'agent à installer.",
  },
  {
    q: "Mes credentials cloud sont-ils en sécurité ?",
    a: "MoniDuck n'utilise que des accès en lecture seule sur vos comptes cloud. Nous n'écrivons, modifions ou supprimons rien. Les credentials sont chiffrés au repos. Hébergement EU.",
  },
  {
    q: "Que se passe-t-il si je dépasse les limites de mon plan ?",
    a: "On vous prévient avant que vous les atteigniez. Jamais de coupure de service — vous avez 7 jours pour upgrader.",
  },
  {
    q: "Y a-t-il un engagement minimum ?",
    a: "Aucun. Résiliez à tout moment depuis vos paramètres. En annuel, vous êtes remboursé au prorata si vous résiliez dans les 30 premiers jours.",
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

  const cta = () => navigate("/waitlist");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{`
        .hero-grid {
          background-image:
            linear-gradient(hsl(var(--border)/0.35) 1px,transparent 1px),
            linear-gradient(90deg,hsl(var(--border)/0.35) 1px,transparent 1px);
          background-size:64px 64px;
          mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,black 20%,transparent 100%);
          -webkit-mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,black 20%,transparent 100%);
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
              Accès anticipé gratuit
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 hero-grid pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 900px 500px at 50% 0%,hsl(160 84% 39%/0.05),transparent)",
        }} />

        <div ref={heroRef} className="relative max-w-5xl mx-auto px-6 pt-24 pb-24 md:pt-36 md:pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-success/20 bg-success/5 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-success">Accès anticipé — Pro gratuit pendant la bêta</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-[72px] font-bold tracking-tight leading-[1.04] mb-7">
            Votre stack a des failles.
            <br />
            <span className="text-green-600">Vous devriez le savoir avant vos clients.</span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
            MoniDuck surveille vos services HTTP, vos ressources cloud et vos dépendances SaaS —
            et prouve quand vos fournisseurs ne respectent pas leur SLA.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-13 px-10 text-base shimmer group" onClick={cta}>
              Essayer gratuitement
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">
              Voir les tarifs →
            </a>
          </div>

          {/* Mini dashboard mockup */}
          <div className="mt-16 max-w-3xl mx-auto rounded-2xl border border-border bg-card/90 backdrop-blur-sm overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.25)]">
            <div className="border-b border-border px-5 py-3 flex items-center gap-2.5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/50" />
                <div className="w-3 h-3 rounded-full bg-warning/50" />
                <div className="w-3 h-3 rounded-full bg-success/50" />
              </div>
              <span className="text-xs text-muted-foreground ml-1">moniduck — incidents en cours</span>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-xs text-destructive font-medium">2 incidents actifs</span>
              </div>
            </div>
            <div className="divide-y divide-border">
              {[
                { dot: "bg-destructive", label: "🔴 Critique", name: "Dashboard app.mycompany.com", detail: "Down depuis 18 min · Impact: ~€290 de revenus", right: "En cours" },
                { dot: "bg-warning", label: "🟡 SLA Breach", name: "Stripe — uptime 99.71% vs 99.99% promis", detail: "Écart: −0.28% · Rapport PDF prêt à envoyer", right: "Ce mois-ci" },
                { dot: "bg-success", label: "✅ Opérationnel", name: "Auth Service · AWS us-east-1", detail: "100% uptime · 43ms avg", right: "Normal" },
              ].map(row => (
                <div key={row.name} className="flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-xs font-medium mt-0.5 shrink-0">{row.label}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{row.detail}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium shrink-0 ml-4 ${row.right === "En cours" ? "text-destructive" : row.right === "Ce mois-ci" ? "text-warning" : "text-success"}`}>
                    {row.right}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── ROI arguments ───────────────────────── */}
      <section className="border-b border-border bg-card/30">
        <div ref={roiRef} className="max-w-6xl mx-auto px-6 py-16">
          <p className="text-center text-xs text-muted-foreground uppercase tracking-widest mb-12">
            La vraie question n'est pas "est-ce que ça vaut le prix ?"
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: TrendingDown,
                stat: "~€500",
                label: "de revenus perdus par heure de downtime",
                sub: "pour une startup à €1M ARR. À €129/mois, MoniDuck se rembourse à la première heure d'incident évitée.",
                color: "text-destructive",
                bg: "bg-destructive/10",
              },
              {
                icon: Shield,
                stat: "1 recours",
                label: "SLA peut valoir des mois d'abonnement",
                sub: "Stripe à 99.71% au lieu de 99.99% ? Vous avez un argument en béton pour obtenir des crédits. MoniDuck génère le PDF.",
                color: "text-warning",
                bg: "bg-warning/10",
              },
              {
                icon: Zap,
                stat: "< 2 min",
                label: "pour détecter une panne, pas 14",
                sub: "La moyenne sans monitoring : 14 minutes. Votre client vous tweete avant que vous sachiez. C'est le scénario qu'on évite.",
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
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Ce que vous surveillez</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Trois couches. <span className="text-primary">Un seul dashboard.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              La plupart des outils de monitoring ne couvrent qu'une couche.
              Vos pannes, elles, peuvent venir des trois en même temps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Globe,
                emoji: "📡",
                title: "Services HTTP",
                bullets: [
                  "Ping toutes les minutes",
                  "Code HTTP, latence, durée d'incident",
                  "Alerte en < 2 min",
                  "Historique et graphes",
                ],
              },
              {
                icon: Cloud,
                emoji: "☁️",
                title: "Cloud & Ressources",
                bullets: [
                  "AWS, GCP, Azure connectés en lecture seule",
                  "État de chaque ressource (EC2, Lambda, RDS…)",
                  "Coûts mensuels visibles",
                  "Statut des régions cloud en temps réel",
                ],
              },
              {
                icon: Plug,
                emoji: "🔌",
                title: "SaaS & SLA",
                bullets: [
                  "Stripe, GitHub, Vercel, Slack et +10 autres",
                  "Cross-check status page + nos pings",
                  "Uptime réel vs SLA contractuel",
                  "Rapport de breach exportable",
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

          {/* How it works */}
          <div className="mt-16 grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-7 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-border" />
            {[
              { n: "1", icon: Search, title: "Connectez votre stack", desc: "URL, clé AWS, SaaS à surveiller. Moins de 5 minutes." },
              { n: "2", icon: Bell, title: "On surveille en continu", desc: "Pings HTTP, parsing status pages, lecture cloud — toutes les minutes." },
              { n: "3", icon: Zap, title: "Vous êtes alerté en premier", desc: "Email, Slack, ou webhook. Avant vos utilisateurs. Avant vos clients." },
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
            <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Tarifs</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Moins cher qu'une heure de downtime.
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Tous les plans incluent un accès complet pendant la bêta. Aucun engagement.
            </p>

            <div className="inline-flex items-center gap-2 bg-muted rounded-full px-2 py-1.5">
              <button
                onClick={() => setAnnual(false)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${!annual ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${annual ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
              >
                Annuel
                <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-semibold">−20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {tiers.map(tier => (
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
                      Le plus populaire
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-1">{tier.name}</p>
                  <p className="text-sm text-muted-foreground mb-5 min-h-[40px]">{tier.desc}</p>

                  <div className="flex items-end gap-1.5 mb-1">
                    <span className="text-5xl font-bold text-foreground">€{annual ? tier.annual : tier.mo}</span>
                    <span className="text-muted-foreground text-sm mb-2">/mois</span>
                  </div>
                  {annual && (
                    <p className="text-xs text-muted-foreground">
                      Facturé €{(annual ? tier.annual : tier.mo) * 12}/an · économisez €{(tier.mo - tier.annual) * 12}
                    </p>
                  )}
                </div>

                <Button
                  size="lg"
                  variant={tier.popular ? "default" : "outline"}
                  className="w-full h-11 mb-7"
                  onClick={cta}
                >
                  Rejoindre la liste d'attente
                </Button>

                <ul className="space-y-3 flex-1">
                  {tier.features.map(f => (
                    <li key={f.text} className={`flex items-center gap-3 text-sm ${f.ok ? "text-foreground" : "text-muted-foreground/40"}`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${f.ok ? "bg-success/10" : "bg-muted"}`}>
                        {f.ok
                          ? <Check className="w-2.5 h-2.5 text-success" />
                          : <X className="w-2.5 h-2.5 text-muted-foreground/25" />}
                      </span>
                      {f.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center max-w-2xl mx-auto">
            <p className="font-semibold text-foreground mb-1">🎁 Bêta = Pro complet, gratuit</p>
            <p className="text-sm text-muted-foreground">
              Les premiers utilisateurs accèdent à toutes les fonctionnalités Pro sans rien payer.
              À l'ouverture commerciale, vous bénéficiez d'un tarif fondateur verrouillé.
            </p>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────── */}
      <section id="faq" className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 py-20 md:py-28">
          <h2 ref={faqRef} className="text-3xl md:text-4xl font-bold tracking-tight mb-12 text-center">Questions fréquentes</h2>
          {faqs.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────── */}
      <section>
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            La prochaine panne, vous la saurez
            <br />
            <span className="text-primary">avant vos utilisateurs.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Accès anticipé gratuit. Pro inclus pendant toute la bêta. Aucun engagement.
          </p>
          <Button size="lg" className="h-13 px-12 text-base shimmer group" onClick={cta}>
            Accéder gratuitement
            <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
          <p className="text-xs text-muted-foreground mt-4">Pas de carte de crédit · Hébergement EU · RGPD compliant</p>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={duckLogo} alt="moniduck" className="w-6 h-6" />
            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} moniduck</span>
          </div>
          <p className="text-xs text-muted-foreground">Pour les équipes qui ne peuvent pas se permettre de rater un incident.</p>
        </div>
      </footer>
    </div>
  );
}
