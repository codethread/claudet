# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT: Read Architecture Documentation First

**ALWAYS read [docs/architecture.md](./docs/architecture.md) before starting any work.** This file contains:
- Complete project structure and file organization
- Server and frontend architecture details
- Dark mode implementation
- PWA implementation (service worker, offline support, updates)
- Testing strategies and best practices
- Technology stack and configuration

Without reading the architecture docs, you will lack critical context about the codebase organization and patterns.

## Processes

- ALWAYS update CLAUDE.md and [docs/architecture.md](./docs/architecture.md) with up-to-date information after architectural changes
- ALWAYS verify final changes with `bun run validate`, which is an alias for the various linting/testing scripts (see [package.json](./package.json) for further details)

## Main agent

- ALWAYS spawn several researcher agents to outline any best practices, or helpful libraries when starting new features without existing patterns in the codebase
- ALWAYS make liberal use of your subagents to maximise token effeciency.
- Follow the general flow of explore -> plan -> build -> validate -> review -> test:
  - **explore**: Use Explore agent to understand codebase structure, locate relevant files, and identify existing patterns
  - **plan**: Create structured todo list and outline implementation approach before writing code
  - **build**: Use tdd-developer agent to implement features with test-driven development methodology
  - **validate**: Use verification-runner agent to check all CI passes locally (type-check, tests, build); bounce back to tdd-developer if anything fails
  - **review**: Use codebase-health-reviewer agent to check code quality and adherence to project standards
  - **test**: Use qa-spec-tester agent to verify implementation meets specification requirements

## Documentation

- **[docs/architecture.md](./docs/architecture.md)** - Complete architecture, project structure, and technology stack
- **[docs/bun.md](./docs/bun.md)** - Comprehensive Bun-specific development guidelines and best practices
- **[README.md](./README.md)** - User-facing documentation with getting started guide

## Runtime & Tooling

This project uses **Bun** as the runtime. See [docs/bun.md](./docs/bun.md) for comprehensive Bun-specific guidelines.

Key points:

- Use `bun` instead of `node`, `npm`, `pnpm`, or `vite`
- Use `bun test` for testing (not Jest or Vitest)
- Bun automatically loads `.env` files (no dotenv package needed)
- Prefer Bun APIs: `Bun.serve()`, `Bun.file()`, `bun:sqlite`, etc.

## Quick Reference: Development Commands

```bash
# Setup (first time or when assets need regenerating)
bun run setup                     # Generate certs + PWA icons

# Development
bun dev                           # Start dev server (HTTPS port 3000)
bun start                         # Production server
bun run build                     # Build for production

# Testing
bun test                          # Run unit tests
bun run test:e2e                  # E2E tests (headless)
bun run test:e2e:ui              # E2E tests (with UI)
bun run validate                  # Run all checks (type-check, test, test:e2e, build)

# Assets (generated, see src/frontend/assets/gen/)
bun run generate:icons            # Generate PWA icons
bun run generate:certs            # Generate HTTPS certificates
```
