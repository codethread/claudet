# 003 - WebSocket-Based Communication

**Status**: Draft
**Created**: 2025-11-02
**Last Updated**: 2025-11-02

## Overview

Refactor the frontend-backend communication to use a unified WebSocket-based messaging system via Socket.IO, replacing the current hybrid approach of REST API endpoints (`/api/chat`, `/api/sessions`) with typed WebSocket messages. The audio transcription endpoint will remain REST-based as it requires file upload capabilities.

## Functional Requirements

- **FR-1**: All chat message exchanges must use WebSocket messages instead of POST `/api/chat`
- **FR-2**: Session management operations (list, create, switch) must use WebSocket messages instead of GET/POST `/api/sessions`
- **FR-3**: A shared types file must define all message interfaces for compile-time type safety between client and server
- **FR-4**: The audio transcription endpoint (`POST /api/transcribe`) must remain as a REST endpoint (unchanged)
- **FR-5**: WebSocket messages must use a structured format with `type` discriminator for different message kinds
- **FR-6**: All existing functionality (session management, chat, logs, reconnection) must continue to work identically from the user's perspective

## Non-Functional Requirements

- **NFR-1**: Type safety must be enforced at compile time for all WebSocket messages exchanged between client and server
- **NFR-2**: The existing Socket.IO infrastructure (reconnection, heartbeat, iOS Safari support) must be preserved
- **NFR-3**: The migration must not break existing tests (unit tests, E2E tests)
- **NFR-4**: Code duplication must be minimized by using shared type definitions
- **NFR-5**: The solution must maintain compatibility with Bun's TypeScript support and bundler
- **NFR-6**: Error handling for WebSocket messages must be robust with proper validation

## Acceptance Criteria

- **AC-1**: A `src/shared/messages.ts` file exists containing all WebSocket message type definitions using discriminated unions
- **AC-2**: The `/api/chat` POST endpoint is removed and chat messages are sent via `socket.emit('chat:send', message)` with typed payloads
- **AC-3**: The `/api/sessions` GET/POST endpoints are removed and session operations use WebSocket messages (e.g., `socket.emit('session:list')`, `socket.emit('session:create')`)
- **AC-4**: The `/api/transcribe` POST endpoint remains unchanged and continues to work
- **AC-5**: The client's `chatMachine.ts` uses the shared types from `messages.ts` for all WebSocket interactions
- **AC-6**: The server's Socket.IO handlers use the shared types from `messages.ts` for type-safe message handling
- **AC-7**: All existing E2E tests pass (with modifications to use WebSocket where appropriate)
- **AC-8**: Runtime validation using Zod schemas ensures type safety at runtime in addition to compile-time checks
- **AC-9**: Socket.IO event names follow a consistent naming convention (e.g., `namespace:action` format)
- **AC-10**: E2E tests verify actual WebSocket traffic (not just UI state) and validate requestId correlation
- **AC-11**: Manual testing confirms that messages send and receive correctly in local development

## Out of Scope

- Changing the audio transcription endpoint from REST to WebSocket
- Adding new features beyond the communication refactor
- Migrating to a different WebSocket library (Socket.IO will remain)
- Changes to the UI/UX or visual appearance
- Modifications to the PWA service worker or offline capabilities

## Proposed Architecture

### Shared Types (`src/shared/messages.ts`)
All WebSocket messages will use discriminated unions with a `type` field:

```typescript
// Client → Server messages
export type ClientMessage =
  | { type: 'chat:send'; payload: { message: string; sessionId: string; requestId: string } }
  | { type: 'session:list'; payload: { requestId: string } }
  | { type: 'session:create'; payload: { model?: string; requestId: string } };

// Server → Client messages
export type ServerMessage =
  | { type: 'chat:response'; payload: { response: string; logs: string[]; sessionId: string; requestId: string } }
  | { type: 'chat:error'; payload: { message: string; code?: string; requestId: string } }
  | { type: 'session:list'; payload: { sessions: Session[]; requestId: string } }
  | { type: 'session:created'; payload: Session & { requestId: string } }
  | { type: 'session:error'; payload: { message: string; code?: string; requestId: string } }
  | { type: 'log'; payload: { sessionId: string; data: string } }
  | { type: 'connection'; payload: { status: string; sessions: Session[] } };
```

### Socket.IO Events
Each message type has its own event name following the `namespace:action` pattern:

**Client → Server:**
- `socket.emit('chat:send', { message, sessionId, requestId })`
- `socket.emit('session:list', { requestId })`
- `socket.emit('session:create', { model?, requestId })`

**Server → Client:**
- `socket.emit('chat:response', { response, logs, sessionId, requestId })`
- `socket.emit('chat:error', { message, code?, requestId })`
- `socket.emit('session:list', { sessions, requestId })`
- `socket.emit('session:created', { ...session, requestId })`
- `socket.emit('session:error', { message, code?, requestId })`
- `socket.emit('log', { sessionId, data })`
- `socket.emit('connection', { status, sessions })`

### Implementation Guidelines

1. **Request/Response Correlation**: All request/response pairs must include a `requestId` (UUID) for correlation
2. **Separate Events**: Use separate request/response events (not Socket.IO acknowledgements) for better testability
3. **Error Handling**: Each operation namespace has its own error event type (`chat:error`, `session:error`)
4. **Runtime Validation**: Use Zod schemas to validate all incoming messages on the server
5. **Type Safety**: Use discriminated unions and exhaustive pattern matching throughout

## Migration Path

1. Create `src/shared/messages.ts` with all type definitions and Zod schemas
2. Update server Socket.IO handlers to use typed messages with runtime validation
3. Update client chatMachine actors to use Socket.IO instead of fetch
4. Remove REST endpoints for chat and sessions (keep transcribe)
5. Update/add E2E tests to verify WebSocket communication
6. Perform manual testing to verify end-to-end functionality

## Dependencies

- Socket.IO client and server (already installed)
- Zod for runtime validation (already used in chatMachine)
- XState for state management (already used)

## Critical Implementation Notes

**See TECH_NOTES.md for detailed implementation guidance and lessons learned from previous attempts.**

Key points:
- Verify tests actually test WebSocket communication, not just UI state
- Use discriminated unions to prevent impossible states
- Ensure strong typing throughout (no `any` types)
- Test locally frequently to catch issues early
- Use `bun run validate` regularly during development
