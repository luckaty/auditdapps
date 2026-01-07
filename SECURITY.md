# Security Policy

## Reporting a vulnerability

If you discover a security issue, please do **not** open a public GitHub issue.

Instead, report it privately with:
- a clear description of the issue
- steps to reproduce
- potential impact, if known

Responsible disclosure is appreciated.

## Secrets and credentials

Never commit secrets into the repository, including:
- OpenAI API keys
- Supabase service role keys
- Stripe secret keys

All secrets must be provided via environment variables.
Local `.env` files should never be committed.

## Scope

This project includes:
- client-side code (React)
- Supabase authentication and database
- Supabase Edge Functions (Deno runtime)

Security issues may exist in any of these areas.
