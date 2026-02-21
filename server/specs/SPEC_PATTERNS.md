# Specification Patterns

This document defines the structure and naming conventions for feature specifications in this project.

## Naming Convention

Specifications should follow this pattern:
```
specs/<numerical-id>-<kebab-cased-feature>.md
```

Examples:
- `specs/001-user-authentication.md`
- `specs/002-biome-integration.md`
- `specs/003-api-rate-limiting.md`

## Specification Types

### Simple Features
For straightforward features that don't require extensive technical design:
- **SPEC only**: Documents the "WHAT" (requirements, acceptance criteria)
- Can proceed directly to implementation after user approval
- No separate TECH_SPEC needed

### Complex Features
For features requiring architectural decisions or technical design:
- **SPEC**: Documents the "WHAT" (requirements, acceptance criteria)
- **TECH_SPEC**: Documents the "HOW" (technical approach, architecture, implementation details)
- Requires technical design phase before implementation

## Document Structure

All specifications should include:
1. **Overview**: Brief description of the feature
2. **Functional Requirements (FR-X)**: Numbered requirements
3. **Non-Functional Requirements (NFR-X)**: Performance, security, etc.
4. **Acceptance Criteria (AC-X)**: Testable success criteria
5. **Out of Scope**: What this feature explicitly does not include
