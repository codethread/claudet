# Architecture

This document provides a comprehensive overview of Claudet's architecture, technology stack, and organizational structure.

## Technology Stack

- **Runtime:** [Bun](https://bun.sh) - All-in-one JavaScript runtime (backend only)
- **Mobile:** [Expo](https://expo.dev/) / React Native (in `mobile/`) - Node.js + npm required (Bun lacks npm)
- **AI Integration:** Claude Code CLI - `--print` / `--resume` invocations for stateless message handling
- **Testing:** Bun test runner (unit tests for backend)

## Server Architecture

This is a **Bun-native HTTP API server** using `Bun.serve()` with simple routing.

### 1. Single HTTP Server (port 3001)

A plain HTTP server serves as the API for the React Native mobile client.

- **Port:** 3001 (HTTP, no TLS — avoids React Native dev cert friction)
- CORS headers on all responses (`Access-Control-Allow-Origin: *`)
- No frontend serving, no Socket.IO, no HTTPS

### 2. Claude CLI Integration (`src/backend/claude.ts`)

- Each message invokes `claude --print` as a one-shot process (no persistent processes)
- **First message in a session**: `claude --session-id <uuid> --model <model> --print "<message>"`
- **Subsequent messages**: `claude --resume <uuid> --print "<message>"`
- Session metadata (ID, model, createdAt, message count) stored in a simple in-memory Map
- **Testing**: Set `CLAUDE_TEST_FAKE=true` to skip real Claude CLI calls and return echo responses

## API Endpoints (HTTP, port 3001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/models` | GET | Returns `{ models: ['haiku', 'sonnet'], default: 'haiku' }` |
| `/api/sessions` | GET | Returns `{ sessions: [{ id, model, createdAt }] }` |
| `/api/sessions` | POST | Create session, body: `{ model? }`, returns `{ id, model, createdAt }` |
| `/api/chat` | POST | Send message, body: `{ message, sessionId }`, returns `{ response }` |

## Mobile App Architecture

Location: `mobile/`

The React Native Expo app is the primary client. It uses HTTP REST to communicate with the backend.

### File Structure

```
mobile/
├── App.tsx                # Main app component (state, layout, chat logic)
├── api.ts                 # API client (fetch wrappers for all endpoints)
├── types.ts               # Shared TypeScript types (Message, Session)
├── index.ts               # Expo entry point
├── app.json               # Expo config
├── package.json           # npm dependencies
├── components/
│   ├── ChatMessage.tsx    # Chat bubble with react-native-markdown-display
│   └── SettingsDrawer.tsx # Left-side modal drawer (model picker, sessions)
└── assets/                # Expo default assets
```

### App State (`App.tsx`)

- `sessions`: All known sessions (fetched from server on mount)
- `currentSessionId`: Active session
- `messagesBySession`: Per-session message history (`Map<sessionId, Message[]>`)
- `selectedModel`: Currently selected model ('haiku' | 'sonnet')
- `input`: Current text input
- `loading`: Whether a request is in flight
- `error`: Last error message
- `settingsOpen`: Whether the settings drawer is open
- `connected`: Whether the server is reachable

### App Lifecycle

1. On mount: fetch models + sessions in parallel
2. If sessions exist, select the first one; otherwise auto-create a session
3. Send: append user message optimistically → call `/api/chat` → append assistant response

### Layout

1. **Header**: Hamburger (opens settings) | Greeting | Plus (new session)
2. **Chat area**: `ScrollView` with `ChatMessage` bubbles, auto-scroll to bottom
3. **Input row**: Multiline `TextInput` + Send button
4. **SettingsDrawer**: Modal with slide animation — model picker, sessions list, new session button, connection status

### Features

| Feature | Status |
|---|---|
| Session management (create/list/switch) | ✅ |
| Model selection (haiku/sonnet) | ✅ |
| Markdown rendering (`react-native-markdown-display`) | ✅ |
| Chat UI (bubbles, loading, auto-scroll) | ✅ |
| Settings drawer | ✅ |
| Connection status | ✅ |
| Dark mode (`useColorScheme`) | ✅ |
| Voice dictation | ❌ (MediaRecorder is web-only) |
| PWA | ❌ (N/A for native) |

## Project Structure

```
src/
├── backend/
│   ├── index.tsx                  # Production entry point
│   ├── index.test-server.tsx      # Test entry point (sets CLAUDE_TEST_FAKE=true)
│   ├── server.ts                  # Bun.serve HTTP server on port 3001
│   ├── claude.ts                  # Claude CLI interface (--print / --resume)
│   ├── utils/
│   │   └── network.ts             # Local IP detection
│   └── audio/
│       └── transcription.ts       # Audio transcription via whisper (kept for future mobile audio)

mobile/                            # React Native Expo app (Node.js/npm, separate from Bun project)
├── App.tsx                        # Main application component
├── api.ts                         # HTTP API client
├── types.ts                       # Shared types
├── index.ts                       # Expo entry point
├── app.json                       # Expo config (HTTP allowed: ATS + cleartext)
├── package.json                   # npm dependencies
└── components/
    ├── ChatMessage.tsx            # Markdown chat bubble
    └── SettingsDrawer.tsx         # Settings modal drawer

docs/
├── bun.md                         # Bun guidelines (important reference)
└── architecture.md                # This file
```

## TypeScript Configuration

- Backend only — `tsconfig.json` includes `src/backend/**/*`
- `mobile/` has its own `tsconfig.json` (Expo-managed)
- Strict mode enabled with additional safety checks

## Testing

### Unit Tests

Use `bun test` with the built-in test runner:

- Test files use `.test.ts` suffix (in `src/` directory)
- Import from `bun:test`: `import { test, expect, describe } from "bun:test"`
- Set `CLAUDE_TEST_FAKE=true` to skip real Claude CLI calls

```bash
bun test        # Run all unit tests
```

## Development Commands

```bash
# Backend
bun dev                    # Start HTTP API server on port 3001 (hot reload)
bun run dev:test           # Start with fake Claude responses (CLAUDE_TEST_FAKE=true)
bun start                  # Production server

# Code quality
bun run format             # Format with Biome
bun run format:check       # Check formatting
bun run lint               # Lint with Biome
bun run type-check         # TypeScript check (backend only)
bun run validate           # Run all checks

# Mobile (in mobile/ directory, uses npm)
npm start                  # Start Expo dev server
npm run ios                # Open in iOS simulator
npm run android            # Open in Android emulator
```
