# MoniDuck 🦆

Monitoring app for modern tech stacks. End-to-end visibility for engineering teams using hybrid infrastructures.

**Lovable project URL**: https://lovable.dev/projects/a958943c-1b40-48c5-8678-5000e2e54b1a

---

## Prerequisites

- [Bun](https://bun.sh) — package manager
- [Python 3](https://python.org) — for Anytype scripts
- [Claude Code](https://claude.ai/code) — AI coding assistant
- [Git](https://git-scm.com)
- [Anytype](https://anytype.io) — local documentation

---

## Getting Started

```bash
# Step 1: Clone the repository
git clone https://github.com/jbdelienne/saas-guardian.git

# Step 2: Navigate to the project directory
cd saas-guardian

# Step 3: Install dependencies
bun install

# Step 4: Start the development server
bun run dev
```

---

## How to edit this project

**Use Lovable**
Simply visit the [Lovable Project](https://lovable.dev/projects/a958943c-1b40-48c5-8678-5000e2e54b1a) and start prompting.
Changes made via Lovable will be committed automatically to this repo.

**Use Claude Code (recommended for logic & integrations)**
See the architecture and code ownership sections below.

**Edit directly in GitHub**
Navigate to the desired file, click the pencil icon, make your changes and commit.

**Use GitHub Codespaces**
Click the green "Code" button → "Codespaces" tab → "New codespace".

---

## Architecture

```
Lovable (UI generation)
      │
      ▼ auto push
   GitHub (saas-guardian) ◄──────────┐
      │                               │
      ▼ auto pull (watch-lovable.sh)  │
   Mac local (Claude Code) ───────────┘
      │
      ▼ end of session
   Anytype (documentation)
```

---

## Running Locally

Open 3 terminals:

| Terminal | Purpose | Command |
|:---------|:--------|:--------|
| 1 | Claude Code | `claude` |
| 2 | Lovable watcher | `./watch-lovable.sh` |
| 3 | Local preview | `bun run dev` |

---

## Tech Stack

- Vite + React + TypeScript
- shadcn-ui + Tailwind CSS
- Supabase (auth + DB + realtime)
- Bun (package manager)

---

## Code Ownership

| Zone | Owner | Paths |
|:-----|:------|:------|
| 🔴 Lovable only | Lovable | `/src/pages/*`, `/src/components/ui/*`, `tailwind.config.ts`, `index.html` |
| 🟢 Claude Code | Claude Code | `/src/hooks/*`, `/src/lib/*`, `/src/types/*`, `/src/contexts/*`, `/supabase/migrations/*` |
| 🟡 Shared | Coordination needed | `/src/components/*` (excl. `/ui`), `/src/integrations/supabase/*` |

---

## Key Files

| File | Purpose |
|:-----|:--------|
| `watch-lovable.sh` | Auto-pulls when Lovable pushes to GitHub |
| `.gitattributes` | Prevents merge conflicts on Lovable files |
| `CLAUDE.md` | Permanent instructions for Claude Code |
| `scripts/anytype.py` | Auto-documentation script to Anytype |
| `scripts/anytype-ids.json` | Feature name → Anytype page ID mapping |
| `.env.anytype` | Anytype API key (not committed) |

---

## Environment Variables

Create a `.env.anytype` file at the root (never commit this):

```
ANYTYPE_API_KEY=your_key_here
```

---

## Commit Convention

```
feat(zone): new feature
fix(zone): bug fix
refactor(zone): restructuring
chore(zone): maintenance / config
```

---

## Anytype Documentation Scripts

```bash
# Create today's journal entry
python3 scripts/anytype.py journal

# Fill in the journal
python3 scripts/anytype.py journal update "content"

# Update (or create) a feature page
python3 scripts/anytype.py feature update "Feature Name" "content"
```

> See `CLAUDE.md` for the full end-of-session workflow.

---

## Deploy

Open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click **Share → Publish**.

To connect a custom domain: Project → Settings → Domains → Connect Domain.
[Read more](https://docs.lovable.dev/features/custom-domain#custom-domain)

---

## Product Features

- Dashboard (+ TV mode)
- HTTP Services Monitoring
- Cloud Resources + AWS Costs
- SaaS Status
- Stack Monitoring
- Integrations
- Alerts (Supabase realtime)
- Incidents
- Reports (public + private)
- Settings / Onboarding
