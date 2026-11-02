# Contributing to AI CAGE

Thank you for your interest in contributing to AI CAGE.

## Contributor License Agreement (CLA)

**Before submitting any contribution (code, documentation, design, or other),
you must agree to the following terms:**

By submitting a Pull Request, Issue, or any other contribution to this
repository, you agree that:

1. **You assign all rights** to your contribution to the project author
   (Frikha, Tunisia). The author retains the right to use, modify, relicense,
   and commercially exploit your contribution without further compensation.

2. **You confirm** that you have the right to assign these rights — the
   contribution is your original work and does not infringe any third-party
   rights.

3. **You understand** that your contribution will be licensed under the same
   terms as the project (Business Source License 1.1).

4. **You waive** any moral rights to the extent permitted by law.

**If you do not agree to these terms, please do not submit a contribution.**

## How to Contribute

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run tests: `pnpm test` (must pass 202+ tests)
5. Run build: `pnpm build` (must pass with zero errors)
6. Submit a Pull Request

## Code Standards

- All new functions must have JSDoc comments
- All new features must have unit tests (Vitest)
- Zero network calls allowed in `packages/core/` or `packages/presidio-lite/`
- The security contract test must pass: `pnpm test`
- Follow existing code style (TypeScript strict mode)

## Security Contributions

If you find a security vulnerability, **do not open a public issue**.
Email: security@ai-cage.io

We respond within 48 hours and publish a fix within 7 days.

---

*AI CAGE — Use Monster AI. Leak Zero Data.*
*© 2026 Frikha, Tunisia. All rights reserved.*
