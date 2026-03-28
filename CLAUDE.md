# MoniDuck — Claude Code Instructions

## 🚨 AVANT CHAQUE SESSION
Toujours vérifier que watch-lovable.sh tourne (Terminal 2).
Ne jamais coder sans être à jour avec origin/main.

## Stack
- Frontend: React/Vite — Lovable (localhost:8080)
- Backend: Supabase
- Agent: Go (/agent)
- GitHub sync: main branch

## 🔴 Zones LOVABLE ONLY — Ne pas toucher
- /src/pages/*
- /src/components/ui/*
- tailwind.config.ts
- index.html

## 🟢 Zones CLAUDE CODE
- /src/hooks/*
- /src/services/*
- /src/lib/*
- /agent/* (Go)
- /supabase/migrations/*

## 🟡 Zones mixtes (coordination nécessaire)
- /src/components/* (hors /ui)
- .env.local

## Conventions
- TypeScript strict, pas de `any`
- Supabase client → /src/lib/supabase.ts uniquement
- Jamais de credentials hardcodés
- Un commit = une feature atomique

## Commandes utiles
npm run dev          → preview localhost:8080
./watch-lovable.sh   → sync auto Lovable
git log --oneline -10 → voir les derniers commits Lovable
