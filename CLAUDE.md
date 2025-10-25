# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Processes

- ALWAYS update CLAUDE.md with up-to-date architecture and project structure after changes
- ALWAYS verify final changes at appropriate points with `curl` or playwright MCP as appropriate
- ALWAYS spawn several researcher agents to outline any best practices, or helpful libraries when starting new features without existing patterns in the codebase

## Runtime & Tooling

This project uses **Bun** as the runtime. See [docs/bun.md](./docs/bun.md) for comprehensive Bun-specific guidelines.

Key points:

- Use `bun` instead of `node`, `npm`, `pnpm`, or `vite`
- Use `bun test` for testing (not Jest or Vitest)
- Bun automatically loads `.env` files (no dotenv package needed)
- Prefer Bun APIs: `Bun.serve()`, `Bun.file()`, `bun:sqlite`, etc.

## Development Commands

```bash
# Install dependencies
bun install

# Development server with hot reload (port 3000, HTTPS)
bun dev

# Production server
bun start

# Build for production
bun run build

# Generate PWA icons (requires ImageMagick: brew install imagemagick)
bun run generate:icons

# Run tests
bun test

# Run specific test file
bun test path/to/test.ts

# Run tests matching pattern
bun test --test-name-pattern "pattern"
```

## Architecture

### Server Architecture (src/index.tsx)

This is a **Bun-native full-stack application** using `Bun.serve()` with routing, WebSockets, and HTML imports:

1. **HTML Import Pattern**: Server imports `index.html` which includes `<script type="module" src="./frontend.tsx">`. Bun's bundler automatically transpiles and bundles React/TypeScript.

2. **Persistent Claude CLI Integration**:
   - Spawns a long-running `claude` CLI process with streaming JSON I/O
   - Maintains session state and request/response correlation via session IDs
   - API endpoint at `/api/chat` for sending messages to Claude
   - WebSocket endpoint at `/ws` for real-time log streaming to clients

3. **HTTPS Development Server**:
   - Uses TLS certificates in `./certs/` directory
   - Serves on `0.0.0.0:3000` for network access
   - Displays QR code on startup for easy mobile access

4. **Routes**:
   - `/*` - Serves index.html (SPA fallback)
   - `/api/chat` - POST endpoint for Claude interactions
   - `/api/hello`, `/api/hello/:name` - Example API endpoints
   - `/ws` - WebSocket upgrade endpoint
   - PWA assets: `/manifest.json`, `/sw.js`, icons

### Frontend Architecture

- **React 19** with TypeScript
- **Tailwind CSS 4** for styling (uses `bun-plugin-tailwind`)
- **shadcn/ui** components in `src/components/ui/`
- **PWA Support**: Service worker, manifest, and icon generation
- Path alias: `@/*` maps to `./src/*`

### Build System (scripts/build.ts)

Custom build script with:

- HTML entry point discovery via glob patterns
- Tailwind CSS integration via plugin
- CLI argument parsing for build customization
- Production optimizations (minify, sourcemap, etc.)

## Project Structure

```
src/
├── index.tsx              # Server entry point (Bun.serve + routes)
├── index.html             # HTML entry with React imports
├── frontend.tsx           # React root component
├── App.tsx                # Main application component
├── APITester.tsx          # Claude API testing UI
├── components/ui/         # shadcn/ui components
├── lib/utils.ts           # Utility functions (cn, etc.)
├── manifest.json          # PWA manifest
└── sw.js                  # Service worker

scripts/
├── build.ts               # Production build script
└── generate-pwa-icons.js  # Icon generation from SVG

docs/
└── bun.md                 # Bun guidelines (important reference)
```

## TypeScript Configuration

- **Strict mode enabled** with additional safety checks
- **Module**: "Preserve" with bundler resolution
- **JSX**: react-jsx (React 19)
- **Path alias**: `@/*` → `./src/*`
- Allows `.ts` imports for bundler compatibility

## Testing

Use `bun test` with the built-in test runner:

- Test files should use `.test.ts` or `.spec.ts` suffix
- Import from `bun:test`: `import { test, expect, describe } from "bun:test"`
- 5-second timeout per test (configurable with `--timeout`)
- Supports snapshots with `--update-snapshots`

## PWA & Assets

- Icons are generated from `src/assets/icon.svg`
- Run `bun run generate:icons` to regenerate PNG variants
- Service worker handles offline caching and PWA installation
