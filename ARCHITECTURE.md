# AuditDapps Architecture

This project is a React + TypeScript web app backed by Supabase (Auth, Postgres, and Edge Functions).

## Big picture

- Frontend: React + Vite + TypeScript + Tailwind
- Backend: Supabase (Auth + Database + Edge Functions)
- AI features: Supabase Edge Functions call OpenAI to generate audit recommendations or scanner analysis

## Main folders

- `src/` — frontend app code
- `src/pages/` — route pages (Dashboard, Scanner, SelfAudit, etc.)
- `src/components/` — reusable UI components
- `src/utils/` — helpers (API calls, formatting, adapters)
- `src/types/` — TypeScript types (includes Supabase generated types)
- `supabase/functions/` — Supabase Edge Functions (Deno runtime)

## How the app works (flow)

### Self-Audit flow
1. User answers security questions on the Self-Audit page
2. Answers are formatted into a prompt
3. The app calls a Supabase Edge Function
4. The Edge Function calls OpenAI
5. The response returns:
   - score (0–100)
   - summary markdown
   - findings list (severity, description, remediation)
6. Results are shown to the user and can be saved to Supabase for the dashboard

### Scanner flow
1. User submits a prompt or contract text
2. The app calls a Supabase Edge Function (scanner)
3. The function calls OpenAI and returns structured JSON
4. The UI renders a summary + findings

## Data model (high level)
The database stores:
- users (via Supabase Auth)
- profiles (user info / roles)
- audits (saved results per user)
- recommendations (optional, based on audits)
- payments/subscriptions (if enabled)

## Edge Functions (important)
Supabase Edge Functions run in Deno, not Node.js.
That’s why we include a `deno.json` inside the functions workspace so tooling and imports work correctly.

## Environments
- Local dev: Vite dev server + Supabase project config
- Production: Vercel (frontend) + Supabase (backend)

## Notes for contributors
- Keep commits small and focused
- Avoid mixing docs changes with code changes
- Prefer clear PR titles and descriptions
