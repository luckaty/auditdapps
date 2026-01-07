# Contributing

Thanks for your interest in contributing to this project.

## Getting started

1. Clone the repository

2. Install dependencies:

```bash
npm install
```

3. Create a local environment file:

```bash
cp .env.example .env
```

4. Start the development server:

```bash
npm run dev
```

## Available scripts

- `npm run dev` — start the app in development mode
- `npm run build` — build production output
- `npm run lint` — run ESLint
- `npm test` — run tests (if configured)

## Branching

- Create feature branches from `main`
- Keep pull requests small and focused
- Use clear branch names, for example:
  - `docs-architecture`
  - `scanner-cleanup`
  - `feature-dashboard`

## Commit style

Use simple, descriptive commit messages:

- `feat:` new feature
- `fix:` bug fix
- `chore(dev):` tooling or dev changes
- `docs:` documentation only

## Code style

- Prefer readable code over clever code
- Avoid `any` unless there is a clear reason
- If you must use `any`, leave a short comment explaining why

## Reporting issues

If something is broken, open an issue with:
- what you expected
- what happened instead
- steps to reproduce
- screenshots or logs if possible
