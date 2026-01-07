# AuditDapps

AuditDapps is a smart contract security platform that helps Web3 teams identify risks early through guided self-audits and AI-assisted analysis — before expensive third-party audits.

The goal is simple: **reduce preventable vulnerabilities and improve security readiness** for developers, startups, and protocols.

---

## Screenshots

> A quick visual overview of the product and self-audit experience.

### Landing Page
![Landing page](docs/screenshots/landing.png)

### Self-Audit Flow
![Self audit flow](docs/screenshots/self-audit.png)

### Results & Findings
![Audit results](docs/screenshots/reports.png)

---

## Why AuditDapps

Many security issues are not caused by advanced attacks, but by:
- missed best-practice checks
- rushed deployments
- lack of structured internal review
- limited access to early security expertise

AuditDapps provides:
- a structured self-audit flow
- consistent security baselines
- actionable findings and remediation guidance
- an audit trail teams can iterate on before formal audits

---

## Core Features

### Guided Self-Audit
A step-by-step checklist that adapts to:
- developer vs organisation workflows
- contract complexity
- security maturity level

### AI-Assisted Analysis
Security findings are generated using:
- predefined audit rubrics
- Solidity security best practices
- contextual analysis of user inputs

The output includes:
- risk score
- executive summary
- categorized findings (Critical / High / Medium / Low)
- concrete remediation guidance

### Audit History & Tracking
Authenticated users can:
- view previous audits
- track implemented recommendations
- maintain a security improvement record over time

### Supabase-Backed Infrastructure
- authentication
- persistence
- edge functions
- role-based access

---

## Tech Stack

### Frontend
- React
- TypeScript
- Tailwind CSS
- Vite
- Framer Motion
- Vitest (testing)

### Backend & Platform
- Supabase (Postgres, Auth, Storage)
- Supabase Edge Functions (Deno)
- OpenAI API (analysis generation)

### Architecture
- client-side SPA
- serverless edge execution
- strict TypeScript boundaries
- environment-based configuration

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for a deeper breakdown.

---

## Repository Structure

```
.
├── src/
│   ├── components/
│   ├── pages/
│   ├── routes/
│   ├── scoring/
│   ├── utils/
│   └── services/
├── supabase/
│   └── functions/
├── docs/
├── ARCHITECTURE.md
├── CONTRIBUTING.md
├── SECURITY.md
├── RELEASE.md
└── README.md
```

---

## Getting Started (Local Development)

### Prerequisites
- Node.js 18+
- npm
- Supabase project (for full functionality)

### Setup
```bash
git clone https://github.com/Auditdapps/auditdapps.git
cd auditdapps
npm install
cp .env.example .env
npm run dev
```

---

## Security

If you discover a security issue, **do not open a public issue**.

Please see [`SECURITY.md`](./SECURITY.md) for responsible disclosure instructions.

---

## Contributing

Contributions are welcome.

Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for:
- branching strategy
- commit conventions
- development guidelines

---

## Releases

Release history and versioning notes are documented in [`RELEASE.md`](./RELEASE.md).

---

## License

This project is licensed under the **MIT License**.  
See [`LICENSE`](./LICENSE) for details.

---

## Project Status

AuditDapps is under active development.

Planned improvements include:
- static analysis integration (e.g. Slither)
- richer risk scoring models
- exportable audit reports
- organisation dashboards

---

## Maintainers

AuditDapps is developed and maintained by the AuditDapps engineering team.

Lead Engineer: **Blessed (luckaty)**
