# Deployment

## Frontend (Vercel)

Typical deployment:
- Connect GitHub repo to Vercel
- Set environment variables in Vercel
- Deploy from `main`

Required env vars (example):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Supabase
- Database and Auth run inside Supabase
- Edge Functions run on Supabase (Deno runtime)

Deploy edge functions:
- Use Supabase CLI (recommended)
- Or deploy in Supabase dashboard

## Notes
- Never expose service-role keys in frontend code
- Keep OpenAI key only in Edge Functions environment
