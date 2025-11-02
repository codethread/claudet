# 004 - Complete Vitest to Bun Test Migration

**Status**: Implemented
**Created**: 2025-11-02
**Last Updated**: 2025-11-02

## Overview

Complete the migration from Vitest to Bun's native test runner. The codebase already uses Bun test for 4 out of 5 unit test files, with only one integration test file (`claudeRunner.integration.test.ts`) still using Vitest. This specification covers migrating that remaining file and removing Vitest as a dependency.

## Context

**Current State:**
- 4 test files using Bun's native test runner (`bun:test`)
- 1 integration test file using Vitest
- Vitest v4.0.3 installed but largely unused
- No vitest.config.ts file
- E2E tests use Playwright (unchanged by this migration)

**Migration Scope:**
- Single file: `src/backend/claudeRunner.integration.test.ts`
- Remove Vitest dependency from package.json
- Ensure all tests continue to pass

## Functional Requirements

- **FR-1**: Migrate `src/backend/claudeRunner.integration.test.ts` from Vitest to Bun test
  - Replace `import { test, expect, describe } from 'vitest'` with `import { test, expect, describe } from 'bun:test'`
  - Ensure all test functionality remains identical
  - Preserve test timeout configuration (currently 35000ms)

- **FR-2**: Remove Vitest dependency from package.json
  - Remove `"vitest": "^4.0.3"` from devDependencies
  - Run `bun install` to update lockfile

- **FR-3**: Verify all tests pass after migration
  - Run `bun test` to verify all unit tests pass
  - Run `bun run test:e2e` to verify E2E tests still work
  - Run `bun run validate` to ensure full CI pipeline passes

## Non-Functional Requirements

- **NFR-1**: No breaking changes to test behavior
  - All existing tests must continue to pass with identical behavior
  - Test timeouts must be preserved
  - Integration test functionality must remain unchanged

- **NFR-2**: Maintain code simplicity
  - No additional testing dependencies should be added
  - Keep the testing approach consistent with existing Bun test patterns

- **NFR-3**: Documentation accuracy
  - Update architecture docs if they reference Vitest
  - Ensure CLAUDE.md reflects Bun-only testing approach

## Acceptance Criteria

- **AC-1**: `claudeRunner.integration.test.ts` imports from `bun:test` instead of `vitest`

- **AC-2**: Vitest package is removed from package.json devDependencies

- **AC-3**: All unit tests pass when running `bun test`

- **AC-4**: E2E tests pass when running `bun run test:e2e`

- **AC-5**: Full validation passes when running `bun run validate`

- **AC-6**: No references to Vitest remain in the codebase (except in spec documentation)

## Out of Scope

- Migrating E2E tests from Playwright (they will remain on Playwright)
- Adding new test frameworks or testing utilities
- Refactoring existing test patterns or structure
- Adding additional test coverage

## Dependencies

None - this is a straightforward dependency migration.

## Notes

- This migration is mostly complete; only one file needs updating
- The integration test has special requirements (35s timeout, requires Claude CLI installed)
- Bun's test runner supports the same timeout API as Vitest via `.timeout(ms)`
- This aligns with the project's Bun-first philosophy documented in docs/bun.md
