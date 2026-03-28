# MoniDuck — Claude Code Instructions

## 🚨 AVANT CHAQUE SESSION
Vérifier que watch-lovable.sh tourne (Terminal 2).
Ne jamais coder sans être à jour avec origin/main.

## Stack
- Frontend: React/Vite + shadcn/ui + Tailwind
- Backend: Supabase (auth + DB + realtime)
- Package manager: Bun (`bun install`, pas `npm install`)
- GitHub sync: main branch

## 🔴 Zones LOVABLE ONLY — Ne pas toucher
- /src/pages/*
- /src/components/ui/*
- tailwind.config.ts
- index.html

## 🟢 Zones CLAUDE CODE
- /src/hooks/*
- /src/lib/*
- /src/types/*
- /src/contexts/*
- /supabase/migrations/*

## 🟡 Zones mixtes (coordination nécessaire)
- /src/components/* (hors /ui)
- /src/integrations/supabase/*

## Features du produit
- Dashboard (+ TV mode)
- HTTP Services
- Cloud Resources + AWS Costs
- SaaS Status
- Stack Monitoring
- Integrations
- Alerts (Supabase realtime)
- Incidents
- Reports (public + privé)
- Settings / Onboarding

## Commandes
bun install      → installer les dépendances
bun run dev      → preview localhost

## Convention de commits
feat(zone): nouvelle fonctionnalité
fix(zone): correction de bug
refactor(zone): restructuration
chore(zone): maintenance / config

## 🔴 FIN DE CHAQUE SESSION — OBLIGATOIRE

### Étape 1 — Créer le journal du jour
```
python3 scripts/anytype.py journal
```

### Étape 2 — Remplir le journal
```
python3 scripts/anytype.py journal update "## Qui a travaillé\n- [x] Claude Code\n- [ ] Lovable\n## Résumé de la session\n[2-3 phrases]\n---\n## Ce qui a été fait\n### Claude Code\n- ...\n### Lovable\n- ...\n## Fichiers modifiés\n- ...\n## Décisions prises aujourd'hui\n- ...\n## Problèmes rencontrés\n- ...\n## Ce qui est prévu pour la prochaine session\n- ...\n---\n## Commits du jour\n[résultat de : git log --oneline -10]"
```

### Étape 3 — Mettre à jour les features impactées
Pour chaque feature touchée pendant la session :
```
python3 scripts/anytype.py feature update "Nom" "## Statut\n✅ Terminé\n## Description\n[2-3 phrases non-tech]\n---\n## Ce qui est fait\n- ...\n## Ce qui reste à faire\n- ...\n## Bugs connus\n- ...\n---\n## Détail technique\n### Fichiers clés\n| Fichier | Rôle |\n|:--------|:-----|\n| ... | ... |\n### Hooks utilisés\n| Hook | Ce qu'il fait |\n|:-----|:--------------|\n| ... | ... |\n### Tables Supabase impliquées\n| Table | Rôle |\n|:------|:-----|\n| ... | ... |\n### Edge cases gérés\n- ...\n### Edge cases non gérés (dette)\n- ...\n---\n## Décisions prises\n| Date | Décision | Pourquoi |\n|:-----|:---------|:---------|\n| ... | ... | ... |\n## Dernière mise à jour\nJJ/MM/AAAA — par Claude Code"
```

Features disponibles : Dashboard, HTTP Services Monitoring, Cloud Resources, Cloud Regions, Stack SaaS, Intégrations, Reports, Alertes, Incidents, Overview / Health Score, Settings & Team, Onboarding, Landing page, Waitlist

## Règles Anytype

### Ce que tu peux faire
- Mettre à jour les pages Features (statut, ce qui est fait, ce qui reste, décisions)
- Créer une nouvelle page Feature depuis le template si une nouvelle feature est ajoutée
- Créer une entrée Journal de bord à chaque fin de session

### Ce que tu ne touches jamais
- Vision & Produit → source de vérité, modifiée par JB uniquement
- Onboarding Dev → modifié par JB uniquement

### Règles Journal de bord
- Une entrée par session, jamais modifiée après création
- Format du titre : Journal — YYYY-MM-DD
- Toujours remplir la section "Commits du jour" avec les commits de la session

### Règles Feature
- Toujours mettre à jour le statut en fin de session
- Toujours dater les décisions prises
- Ne jamais effacer l'historique des décisions, seulement en ajouter