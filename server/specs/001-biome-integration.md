# 001 - Biome Integration

**Status**: Implemented
**Created**: 2025-11-01
**Last Updated**: 2025-11-01

## Overview

Add Biome as the formatting and linting tool for the Claudet project. Biome is a fast, modern toolchain that provides formatting and linting for JavaScript, TypeScript, JSX, and JSON files. This will ensure consistent code style and catch potential issues early in development.

## Functional Requirements

- **FR-1**: Install Biome as a dev dependency via `bun add -D @biomejs/biome`
- **FR-2**: Create a `biome.json` configuration file with sensible defaults for React/TypeScript projects
- **FR-3**: Add bun scripts for formatting and linting:
  - `format`: Format all supported files
  - `format:check`: Check formatting without modifying files
  - `lint`: Run linting on all supported files
  - `lint:fix`: Apply safe automatic fixes
- **FR-4**: Configure Biome to work with the existing project structure (src/, tests/, scripts/)
- **FR-5**: Apply Biome formatting to all existing files in the codebase
- **FR-6**: Fix all linting issues reported by Biome
- **FR-7**: Integrate format checking into the `validate` script to ensure CI/CD compliance

## Non-Functional Requirements

- **NFR-1**: Biome configuration should align with existing TypeScript strict mode settings
- **NFR-2**: Formatting should preserve existing code functionality (no breaking changes)
- **NFR-3**: Biome should use recommended defaults for React 19 and TypeScript 5.9+
- **NFR-4**: Configuration should be compatible with Bun runtime and build system
- **NFR-5**: Linting rules should catch common bugs without being overly strict

## Acceptance Criteria

- **AC-1**: `bun add -D @biomejs/biome` successfully installs Biome
- **AC-2**: `biome.json` exists in project root with configuration for:
  - Indentation style (tabs or spaces)
  - Line width
  - Quote style
  - JSX formatting
  - Linting rules enabled
- **AC-3**: Running `bun run format` formats all TypeScript, JavaScript, JSX, and JSON files
- **AC-4**: Running `bun run lint` checks all files and reports issues
- **AC-5**: All existing files pass `bun run format:check` after formatting
- **AC-6**: All existing files pass `bun run lint` with zero errors (warnings acceptable)
- **AC-7**: Running `bun run validate` includes format checking and passes
- **AC-8**: All existing tests still pass after formatting changes
- **AC-9**: Project builds successfully with `bun run build`

## Out of Scope

- Migration from other tools (no ESLint or Prettier to remove)
- Custom linting rules beyond Biome's recommended set
- Git hooks for automatic formatting (can be added later)
- Editor integration configuration (developers configure their own editors)
- Formatting for non-standard file types (CSS, Markdown, etc.)

## Dependencies

None - this is a new addition to the project.

## Notes

### Why Biome?

1. **Speed**: Biome is written in Rust and is significantly faster than ESLint/Prettier
2. **All-in-one**: Combines formatting and linting in a single tool
3. **Bun-friendly**: Works well with modern JavaScript runtimes like Bun
4. **Zero config**: Works out of the box with sensible defaults
5. **React support**: First-class support for React and JSX

### Configuration Considerations

- Use tab indentation to match project conventions
- Line width: 100 characters (readable on modern displays)
- Single quotes for consistency with existing code style
- Semicolons: enabled (TypeScript/JavaScript best practice)
- JSX quotes: double quotes (React convention)

### Files to Format

Include:
- `src/**/*.{ts,tsx,js,jsx,json}`
- `tests/**/*.{ts,tsx,js,jsx}`
- `scripts/**/*.{ts,js,mjs}`
- `*.{ts,tsx,js,json}` (root config files)

Exclude:
- `dist/`
- `node_modules/`
- `.git/`
- `certs/`
- Generated files in `src/frontend/assets/gen/`
