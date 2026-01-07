# AuditDApps

**AuditDApps** is a security-focused platform that helps blockchain developers and teams identify risks in smart contracts through guided self-audits and AI-assisted analysis.

The platform is designed to encourage security thinking early in the development lifecycle, before formal third-party audits.

---

## Why AuditDApps exists

Smart contract vulnerabilities remain one of the leading causes of financial loss in Web3.

Many teams:
- deploy contracts without structured security reviews
- rely on late, expensive audits
- miss common issues that could be caught earlier

AuditDApps helps teams:
- think like auditors earlier
- identify high-risk patterns
- receive actionable remediation guidance

---

## Key features

- **Guided self-audit flow**  
  Step-by-step security questionnaires tailored for developers and organisations.

- **AI-assisted security analysis**  
  Structured summaries, risk scores, and findings with remediation guidance.

- **Severity-based findings**  
  Issues categorised as Critical, High, Medium, or Low.

- **User dashboard**  
  View previous audits, track progress, and manage reports.

- **Supabase-powered backend**  
  Authentication, database, and Edge Functions for scalable infrastructure.

---

## Tech stack

**Frontend**
- React
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion

**Backend**
- Supabase (Auth, Postgres, Edge Functions)
- Deno (for Edge Functions)

**AI**
- OpenAI (via Supabase Edge Functions)

**Testing & Tooling**
- ESLint
- Vitest
- GitHub Actions (CI)

---

## Architecture overview

AuditDApps follows a clean separation between frontend, backend, and AI execution.

High-level flow:
1. User completes a self-audit or submits a scan request
2. Answers are formatted into a structured prompt
3. The frontend calls a Supabase Edge Function
4. The Edge Function performs AI analysis
5. Structured results are returned and rendered in the UI
6. Results can be stored and accessed via the dashboard

More details:
- [Architecture](ARCHITECTURE.md)
- [Edge Functions](docs/EDGE_FUNCTIONS.md)

---

## Security & responsibility

Security is taken seriously in this project.

- Secrets are never exposed in frontend code
- AI keys and sensitive logic live only in Edge Functions
- Responsible disclosure is encouraged

See:
- [Security Policy](SECURITY.md)

---

## Roadmap

### Planned
- Slither integration for static smart-contract analysis
- PDF audit report export
- Improved risk scoring models
- Team and organisation workspaces

### In progress
- Scanner flow hardening
- Type-safety improvements
- Test coverage expansion

---

## Documentation

- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Release Process](RELEASE.md)
- [Changelog](CHANGELOG.md)

---

## Project status

AuditDApps is under active development.

Features are evolving, and feedback from developers and security practitioners is welcome.

---

## Leadership & contribution

AuditDApps is developed by the **Auditdapps** organisation.

**Technical leadership and core engineering** are led by  
**Blessed (luckaty)** — Lead Engineer.

---

## License

This project is licensed under the **MIT License**.  
See the [LICENSE](LICENSE) file for details.
