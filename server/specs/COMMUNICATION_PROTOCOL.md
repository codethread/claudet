# Communication Protocol

This document defines standards for agent communication and specification references.

## Requirement Numbering

All requirements must be numbered for precise referencing:

- **Functional Requirements**: `FR-1`, `FR-2`, `FR-3`, etc.
- **Non-Functional Requirements**: `NFR-1`, `NFR-2`, `NFR-3`, etc.
- **Acceptance Criteria**: `AC-1`, `AC-2`, `AC-3`, etc.

## Specification References

When referencing specifications:
- Use the full spec path: `specs/001-feature-name.md`
- Reference specific requirements: `FR-3 from specs/001-feature-name.md`
- Reference acceptance criteria: `AC-2 from specs/001-feature-name.md`

## Agent Handover

When handing off work between agents:
1. Provide the spec file path
2. List specific requirement IDs to implement or test
3. Include any relevant context or constraints

Example:
```
Please implement FR-1, FR-2, and FR-5 from specs/002-biome-integration.md
```

## Testing References

When testing features:
1. Reference the spec: `specs/002-biome-integration.md`
2. List specific ACs to verify: `AC-1, AC-2, AC-3`
3. Report results per AC number
