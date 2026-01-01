# AuditDApps
AI-Powered Security Self-Audit Platform for Web3 & Modern Applications

AuditDApps is a full-stack security platform that enables developers, startups, and organisations to evaluate the security posture of their applications through a guided self-audit, deterministic risk analysis, and AI-assisted security recommendations.

The project is built as a production-grade system, not a demo, with real authentication, persistent storage, secure backend logic, and payment handling.

Live site: https://auditdapps.com
Source code: This repository


## MOTIVATION

Security audits are often expensive, slow, and inaccessible to early-stage teams. As a result, many applications ship with avoidable vulnerabilities that later lead to exploits, financial loss, or reputational damage.

AuditDApps was created to:
- Make security assessment more accessible
- Encourage security-first thinking early in development
- Provide structured, repeatable audit workflows
- Bridge the gap between self-assessment and professional audits

The platform is designed to scale toward more advanced auditing, reporting, and certification workflows over time.


## CORE FEATURES

Authentication & Access Control
- Email/password authentication via Supabase
- Email verification flow with secure redirects
- Protected routes and role-based access
- Persistent user profiles and audit ownership
- Session-aware routing to prevent data loss

Guided Self-Audit Flow
- Step-by-step audit experience (one question at a time)
- Developer-specific and Organisation-specific audit paths
- Dynamic progress tracking
- Local persistence to prevent accidental loss before login

Deterministic Risk Analysis
- Non-AI baseline risk scoring engine
- Severity-weighted findings (Critical, High, Medium, Low)
- Transparent and explainable scoring model
- Aggregated risk analytics for dashboards and reports

AI-Assisted Recommendations
- AI used only on the server side
- Structured prompts generated from audit responses
- Human-readable security recommendations
- AI augments deterministic analysis rather than replacing it

Audit Persistence & History
- Audits saved per authenticated user
- Full audit history accessible via dashboard
- Individual audit detail pages
- Recommendation tracking and implementation status

Payments & Billing
- Live Stripe payment integration
- Payments handled entirely by Stripe
- Checkout sessions created server-side via Supabase Edge Functions
- No Stripe secrets exposed to the client


TECHNICAL ARCHITECTURE

Frontend
- React + TypeScript
- Vite
- Tailwind CSS
- React Router
- Zustand

Backend & Infrastructure
- Supabase (PostgreSQL, Auth)
- Row Level Security enforced
- Supabase Edge Functions (Deno)

Security by Design
- No secrets committed to source control
- Environment variables handled securely
- Privileged logic isolated server-side


## PROJECT STRUCTURE

src/
  components/
  pages/
  lib/
  utils/
  store/
  scoring/
  types/

supabase/
  functions/
  config.toml


## LOCAL DEVELOPMENT

1. Install dependencies
   npm install

2. Create environment file
   cp .env.example .env

3. Start development server
   npm run dev

API keys (Supabase, OpenAI, Stripe) are required via environment variables.


## ABOUT THE PROJECT & CONTRIBUTORS

AuditDApps is a founder-led security research initiative operationalised into a production SaaS platform for Web3 security self-audits.

The security research foundation, audit methodology, and risk models were developed by Henry Ajah (MSc Cyber Security) as part of an academic research project.

Blessed Ogechukwu served as Lead Engineer, responsible for translating this research into a secure, scalable, production-ready platform used by external developers and organisations.

## Lead Engineering Responsibilities

As Lead Engineer, Blessed Ogechukwu led the full engineering delivery of the platform, including:

System and frontend architecture using React and TypeScript

Secure authentication, routing, and session management

Audit logic implementation, persistence, and user ownership enforcement

Backend and database integration

Server-side AI-assisted recommendation workflows

Stripe-based billing and access control

Production deployment and scalability preparation

While the security research and methodology are founder-owned, this repository represents Blessed Ogechukwu’s independent engineering implementation and system delivery.

## LICENSE

MIT License
