# Releases

This project follows a lightweight release process.

## Versioning

Versions roughly follow semantic versioning:

- MAJOR — breaking changes
- MINOR — new features
- PATCH — bug fixes and internal improvements

Example:
- `0.1.0` initial public version
- `0.2.0` feature additions
- `0.2.1` bug fixes

## Release process

1. Features are merged into `main`
2. The changelog is updated
3. A release tag is created on GitHub
4. Production deployment follows

## Pre-release work

Before a release:
- Tests should pass
- CI should be green
- No secrets should exist in the repo
- Docs should reflect current behavior
