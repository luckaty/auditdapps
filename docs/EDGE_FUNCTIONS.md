# Supabase Edge Functions

Edge Functions live in:
- `supabase/functions/`

They run on Deno (not Node).

## Why `deno.json` exists
Deno uses a different module system than Node.
A `deno.json` file helps:
- editor tooling
- import resolution
- consistent developer experience

## Local development
You can develop functions locally using the Supabase CLI.

Common functions in this project:
- `scanner-*` functions for AI scanning
- `generate-recommendations` for audit recommendations
- `create-checkout-session` for payments (if enabled)
