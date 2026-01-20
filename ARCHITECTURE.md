# AuditDapps Architecture

AuditDapps is a React + TypeScript web application backed by Supabase (Auth + Postgres + Edge Functions), with an optional local static-analysis service used during development.

This document describes **what the codebase does today** and **what is explicitly in progress**, to avoid overclaiming.

---

## Big picture

- **Frontend:** React + Vite + TypeScript + Tailwind
- **Backend platform:** Supabase (Auth + Database + Edge Functions)
- **AI features:** Supabase Edge Functions call OpenAI for structured summaries and recommendations
- **Static analysis (local/dev):** a Dockerised FastAPI service (`services/slither-api`) that runs Slither and returns deterministic findings

---

## Main folders

- `src/` — frontend application code
- `src/pages/` — route pages (Dashboard, Scanner, SelfAudit, etc.)
- `src/components/` — reusable UI components
- `src/utils/` — helpers (formatting, adapters)
- `src/services/` — client-side API/service wrappers (Supabase, AI, Slither)
- `src/types/` — TypeScript types
- `supabase/functions/` — Supabase Edge Functions (Deno runtime)
- `services/slither-api/` — local static-analysis service (FastAPI + Slither)

---

## How the app works (flows)

### Self-Audit flow (AI-assisted)
1. User answers security questions on the Self-Audit page
2. Answers are formatted into a structured payload
3. The app calls a Supabase Edge Function
4. The Edge Function calls OpenAI
5. The response returns:
   - score (0–100)
   - summary markdown
   - findings list (severity, description, remediation)
6. Results are displayed and can be saved to Supabase for the dashboard/audit history

### Scanner flow (current behaviour: Slither + AI run separately)
1. User submits Solidity source code (paste or upload)
2. **Slither runs first (local/dev)** via `src/services/slither.ts` → `services/slither-api`
   - deterministic findings are returned and shown as **Static Findings**
   - if Slither fails, the scanner continues (non-blocking)
3. The app then runs **AI analysis** via the scanner Edge Function and shows **AI Findings** separately
4. The UI renders:
   - a score + summary
   - AI findings (structured)
   - static findings (Slither), kept separate for transparency

> Note: **Static findings are not yet fed into the AI prompt in the current implementation.**  
> The intended next step is to pass deterministic findings into the AI layer for explanation/prioritisation while still keeping the outputs distinguishable.

---

## Data model (high level)

The database stores:
- users (via Supabase Auth)
- profiles (user metadata / roles)
- audits (saved results per user)
- recommendations/findings (linked to audits)
- payments/subscriptions (Stripe, via Supabase Edge Functions)

Billing and subscription logic is implemented using Stripe and handled through
Supabase Edge Functions. Payment functionality is intentionally kept separate
from the core audit and security analysis flows.


---

## Edge Functions (important)

Supabase Edge Functions run in **Deno**, not Node.js.
That’s why the functions workspace includes Deno config to keep imports/tooling consistent.

Edge Functions are responsible for:
- validating input
- orchestrating AI calls
- returning structured JSON
- persisting results (where applicable) with access control

---

## Billing & Payments

AuditDapps uses Stripe for payments and subscriptions.
All billing-related operations (checkout, customer portal, webhooks)
are handled via Supabase Edge Functions.

This keeps payment logic isolated from the core audit and analysis workflows.

---

## Environments

- **Local development**
  - Vite dev server
  - Supabase project configuration
  - Optional local static analysis service (`slither-api`) via Docker Compose

- **Production**
  - Frontend hosted on a managed web hosting provider
  - Backend services provided by Supabase (Auth, Database, Edge Functions)

The static analysis service is currently used in local development.
Production deployment of this service is in progress and not yet treated as production-available.

---

## Notes for contributors

- Keep commits small and focused
- Avoid mixing docs changes with functional changes
- Prefer clear PR titles and descriptions
- Preserve the deterministic-first principle: verifiable signals first, AI explanation second
