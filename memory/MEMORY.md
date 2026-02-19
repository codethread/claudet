# Claudet Project Memory

## Architecture (post-refactor)
- Backend chat uses `claude --print` / `claude --resume <id> --print` as one-shot processes
- Session store: simple in-memory Map in `src/backend/claude.ts`
- No XState on backend; no persistent Claude processes
- E2E test fake mode: `CLAUDE_TEST_FAKE=true` (set in `index.test-server.tsx`)
- Frontend still uses XState chatMachine for UI state; no logs tracking

## Key files
- `src/backend/claude.ts` — createSession, sendMessage (one-shot CLI invocations)
- `src/backend/socket/handlers.ts` — Socket.IO events: chat:send, session:list, session:create
- `src/frontend/chatMachine.ts` — frontend XState machine (no logs)

## Test commands
- `bun test src/` — unit tests only (avoids Playwright spec file)
- `bun run type-check` — TypeScript check
