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
- Format du titre : YYYY-MM-DD (ex: 2026-03-28)
- Toujours remplir la section "Commits du jour" avec les commits de la session

### Règles Feature
- Toujours mettre à jour le statut en fin de session
- Toujours dater les décisions prises
- Ne jamais effacer l'historique des décisions, seulement en ajouter