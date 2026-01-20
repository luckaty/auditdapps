# AuditDapps

AuditDapps is a smart contract security platform that helps Web3 teams identify risks early through guided self-audits, deterministic static analysis, and AI-assisted review — before engaging in expensive third-party audits.

The goal is simple: reduce preventable vulnerabilities and improve security readiness for developers, startups, and protocols.

AuditDapps is designed to complement, not replace, professional security audits.

---

## Screenshots

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

AuditDapps addresses this gap by providing:
- a structured self-audit flow
- deterministic static analysis (Slither)
- AI-assisted explanation and remediation guidance
- consistent security baselines
- an audit trail teams can iterate on before formal audits

---

## Core Features

### Guided Self-Audit
A step-by-step checklist that adapts to developer vs organisation workflows, contract complexity, and security maturity.

### Static Analysis (Slither)
AuditDapps integrates Slither via an isolated backend service.  
Static analysis is fully implemented and available in local development; production deployment of the service is currently in progress.

Findings are deterministic, explainable, and displayed separately from AI output to preserve trust.

### AI-Assisted Analysis
AI is used only after deterministic analysis to summarise security posture, explain impact, and suggest remediation.

Static findings are passed to AI for explanation, while AI output is never treated as ground truth.

### Audit History & Tracking
Authenticated users can view previous audits, track implemented recommendations, and maintain a security improvement record over time.

---

## Tech Stack

**Frontend**
- React
- TypeScript
- Tailwind CSS
- Vite
- Framer Motion
- Vitest

**Backend & Platform**
- Supabase (Postgres, Auth, Storage)
- Supabase Edge Functions
- FastAPI (Python)
- Slither
- OpenAI API

---

## Documentation

The repository is organised with dedicated documentation for deeper technical and operational details:

- **Architecture overview:** [`ARCHITECTURE.md`](./ARCHITECTURE.md)  
- **Security & responsible disclosure:** [`SECURITY.md`](./SECURITY.md)  
- **Contributing guidelines:** [`CONTRIBUTING.md`](./CONTRIBUTING.md)  
- **Releases & versioning:** [`RELEASE.md`](./RELEASE.md)

These documents are intentionally kept separate to avoid duplication in the README.

---

## Project Status

### Available Today
- Guided self-audit flow
- Local deterministic static analysis (Slither)
- AI-assisted findings and summaries
- PDF audit report export
- Audit history for authenticated users

### Next
- Production deployment of static analysis service
- Rate limiting and abuse protection
- Scan timeouts and async job handling
- Improved report formatting and export reliability
- Contributor onboarding improvements

AuditDapps is currently in public beta and evolving based on user feedback.

---

## License

This project is licensed under the **MIT License**.  
See [`LICENSE`](./LICENSE) for details.

---

## Maintainers

AuditDapps is developed and maintained by the AuditDapps engineering team.

Lead Engineer: **Blessed (luckaty)**
