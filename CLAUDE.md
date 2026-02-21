# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## [MAIN AGENT ONLY] Using Claude Code Agents

When working on features, leverage specialized agents to maximize efficiency:

- **Before coding**: Use researcher agents to identify best practices and helpful libraries for new features without existing codebase patterns
- **During development**: Make liberal use of subagents to maximize token efficiency as per workflow guidelines below

### Workflow Selection

**Use Complex Workflow when:**
- Implementing new features without existing codebase patterns
- Making architectural changes
- Performing multi-file refactoring

**Use Simple Workflow when:**
- Simple refactoring (extracting helpers, DRY improvements)
- Bug fixes
- Small improvements or cleanup

### Complex Workflow (Full Process)

Use for new features without existing patterns, architectural changes, and multi-file refactoring.

1. **Explore**: Use Explore agent to understand codebase structure, locate relevant files, and identify existing patterns
2. **Plan**: Always create a concrete, detailed implementation plan and verify with user before proceeding. The more specific the plan, the better.
3. **Build**: Use tdd-developer agent to implement features with test-driven development methodology
4. **Validate**: Use verification-runner agent to verify all CI checks pass (type-check, tests, build)
   - If checks fail, return to tdd-developer agent to fix issues
5. **Review**: Use codebase-health-reviewer agent to check code quality and adherence to project standards
6. **Test against spec**: Use qa-spec-tester agent to verify implementation meets specification requirements (when specs exist)

### Simple Workflow (Streamlined)

Use for bug fixes, simple refactoring, and small improvements.

Skip steps 1-2 and 6 from the Complex Workflow. Proceed directly to:
- **Build** → **Validate** → **Review** (optional for trivial changes like typos or formatting)

## [ALL AGENTS] Rules

- ALWAYS update [docs/architecture.md](./docs/architecture.md) with up-to-date information after architectural changes
- Use `npm` for all package management operations (run from within `server/` or `mobile/`)
- Follow test-driven development when writing code

## Documentation

- **[docs/architecture.md](./docs/architecture.md)** - Complete architecture, project structure, and technology stack (**ALWAYS read before starting any work.**)
- **[README.md](./README.md)** - User-facing documentation with getting started guide

## Repository Structure

```
server/   — Node.js/Express API server (npm, tsx, vitest)
mobile/   — Expo/React Native app (npm)
Makefile  — Convenience targets delegating into server/ and mobile/
```

## Runtime & Tooling

- **Server:** Node.js via `tsx`, npm, Express v5, better-sqlite3, Vitest
- **Mobile:** Expo / React Native, npm
- Run server commands from `server/`, mobile commands from `mobile/`, or use `make` from root

## Quick Reference: Development Commands

```bash
# From root (via Makefile)
make dev          # Start server (port 3001, hot reload)
make dev-test     # Start server with fake Claude responses
make test         # Run unit tests
make validate     # Run all checks
make mobile       # Start Expo dev server

# From server/
npm run dev
npm test
npm run validate

# From mobile/
npx expo start
```
