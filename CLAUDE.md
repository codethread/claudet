# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Processes

- ALWAYS update [docs/architecture.md](./docs/architecture.md) with up-to-date information after architectural changes

## Using Claude Code Agents

When working on features, leverage specialized agents to maximize efficiency:

- **Before coding**: Use researcher agents to identify best practices and helpful libraries for new features without existing codebase patterns
- **During development**: Make liberal use of subagents to maximize token efficiency

### Recommended Workflow

1. **Explore**: Use Explore agent to understand codebase structure, locate relevant files, and identify existing patterns
2. **Plan**: Always create a concrete, detailed implementation plan and verify with user before proceeding. The more specific the plan, the better.
3. **Build**: Use tdd-developer agent to implement features with test-driven development methodology
4. **Validate**: Use verification-runner agent to verify all CI checks pass (type-check, tests, build)
   - If checks fail, return to tdd-developer agent to fix issues
5. **Review**: Use codebase-health-reviewer agent to check code quality and adherence to project standards
6. **Test against spec**: Use qa-spec-tester agent to verify implementation meets specification requirements (when specs exist)

## Documentation

- **[docs/architecture.md](./docs/architecture.md)** - Complete architecture, project structure, and technology stack (**ALWAYS read before starting any work.**)
- **[README.md](./README.md)** - User-facing documentation with getting started guide

## Runtime & Tooling

This project uses **Bun** as the runtime.

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
bun run dev:test                  # Start dev server with test backend
bun start                         # Production server
bun run build                     # Build for production

# Code Quality
bun run format                    # Format code with Biome
bun run format:check              # Check code formatting
bun run lint                      # Lint code with Biome
bun run lint:fix                  # Lint and fix issues
bun run type-check                # TypeScript type checking

# Testing
bun test                          # Run unit tests
bun run test:e2e                  # E2E tests (headless)

# Final Validation
bun run validate                  # Run all checks (type-check, format:check, lint, test, test:e2e, build)
```
