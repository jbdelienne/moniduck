import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAddSaasDependency, KNOWN_SAAS } from '@/hooks/use-saas-dependencies';
import { useAddService } from '@/hooks/use-supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Search, Plus, Trash2, Loader2, ArrowRight, ArrowLeft, Rocket } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import duckLogo from '@/assets/moniduck-logo.png';

const STEPS = [
  { title: 'Ta stack SaaS', description: 'Quels outils SaaS utilises-tu ?' },
  { title: 'Tes services', description: 'Ajoute tes propres endpoints HTTP' },
  { title: 'Dépendances', description: 'Associe tes services à tes dépendances' },
  { title: 'Alertes', description: 'Configure tes notifications' },
];

interface NewService {
  name: string;
  url: string;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const addDep = useAddSaasDependency();
  const addService = useAddService();

  const [step, setStep] = useState(0);
  const [selectedSaas, setSelectedSaas] = useState<string[]>([]);
  const [saasSearch, setSaasSearch] = useState('');
  const [newServices, setNewServices] = useState<NewService[]>([{ name: '', url: '' }]);
  const [slackWebhook, setSlackWebhook] = useState('');
  const [alertEmail, setAlertEmail] = useState('');
  const [alertMode, setAlertMode] = useState<'immediate' | 'daily' | 'weekly'>('immediate');
  const [loading, setLoading] = useState(false);

  const toggleSaas = (key: string) => {
    setSelectedSaas(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const filteredSaas = Object.entries(KNOWN_SAAS).filter(([_, s]) =>
    !saasSearch || s.name.toLowerCase().includes(saasSearch.toLowerCase())
  );

  const addServiceRow = () => setNewServices(prev => [...prev, { name: '', url: '' }]);
  const removeServiceRow = (idx: number) => setNewServices(prev => prev.filter((_, i) => i !== idx));
  const updateService = (idx: number, field: keyof NewService, value: string) => {
    setNewServices(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      // Add SaaS dependencies
      for (const key of selectedSaas) {
        const saas = KNOWN_SAAS[key];
        if (!saas) continue;
        try {
          await addDep.mutateAsync({
            name: saas.name,
            url: saas.url,
            status_page_url: saas.statusPageUrl,
            icon: saas.icon,
            sla_promised: saas.defaultSla,
          });
        } catch (e) { /* skip duplicates */ }
      }

      // Add services
      for (const svc of newServices) {
        if (!svc.name.trim() || !svc.url.trim()) continue;
        try {
          await addService.mutateAsync({
            name: svc.name,
            url: svc.url,
            icon: '🌐',
            check_interval: 5,
          });
        } catch (e) { /* skip errors */ }
      }

      toast.success('MoniDuck est prêt ! 🎉');
      navigate('/dashboard');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return selectedSaas.length >= 1;
    return true;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={duckLogo} alt="moniduck" className="w-12 h-12" />
          <span className="text-xl font-bold text-foreground">moniduck</span>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i === step ? 'bg-primary text-primary-foreground' :
                i < step ? 'bg-success text-success-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 ${i < step ? 'bg-success' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Title */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-foreground">{STEPS[step].title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{STEPS[step].description}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          {/* Step 1: Select SaaS */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={saasSearch}
                  onChange={(e) => setSaasSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                {filteredSaas.map(([key, saas]) => {
                  const isSelected = selectedSaas.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleSaas(key)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <span className="text-2xl">{saas.icon}</span>
                      <span className="text-xs font-medium text-foreground">{saas.name}</span>
                      {isSelected && <Check className="w-3 h-3 text-primary" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {selectedSaas.length} sélectionné{selectedSaas.length > 1 ? 's' : ''} — minimum 1 requis
              </p>
            </div>
          )}

          {/* Step 2: Add Services */}
          {step === 1 && (
            <div className="space-y-3">
              {newServices.map((svc, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Nom (ex: API Backend)"
                    value={svc.name}
                    onChange={(e) => updateService(idx, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="https://api.example.com"
                    value={svc.url}
                    onChange={(e) => updateService(idx, 'url', e.target.value)}
                    className="flex-1"
                  />
                  {newServices.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => removeServiceRow(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addServiceRow} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Ajouter un service
              </Button>
              <p className="text-xs text-muted-foreground">Tu pourras passer cette étape et ajouter des services plus tard.</p>
            </div>
          )}

          {/* Step 3: Dependencies mapping */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cette étape sera disponible prochainement. Tu pourras associer tes services à leurs dépendances SaaS pour détecter les corrélations.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">🚧 Fonctionnalité en développement</p>
              </div>
            </div>
          )}

          {/* Step 4: Alerts */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Email pour les alertes</Label>
                <Input
                  type="email"
                  placeholder="team@company.com"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Slack Webhook (optionnel)</Label>
                <Input
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Mode d'alerte</Label>
                <div className="flex gap-2">
                  {([
                    { key: 'immediate' as const, label: 'Immédiat' },
                    { key: 'daily' as const, label: 'Digest quotidien' },
                    { key: 'weekly' as const, label: 'Digest hebdo' },
                  ]).map(mode => (
                    <button
                      key={mode.key}
                      onClick={() => setAlertMode(mode.key)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        alertMode === mode.key
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            onClick={() => step > 0 ? setStep(step - 1) : navigate('/dashboard')}
            className="gap-2 text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            {step === 0 ? 'Passer' : 'Retour'}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="gap-2 gradient-primary text-primary-foreground hover:opacity-90"
            >
              Suivant <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={loading}
              className="gap-2 gradient-primary text-primary-foreground hover:opacity-90"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              Lancer MoniDuck
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
