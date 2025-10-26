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

# Run unit tests
bun test

# Run specific test file
bun test path/to/test.ts

# Run tests matching pattern
bun test --test-name-pattern "pattern"

# E2E tests with Playwright
bun run test:e2e              # Run headless
bun run test:e2e:ui           # Run with Playwright UI
bun run test:e2e:headed       # Run with visible browser
npx playwright show-report    # View latest test report
```

## Architecture

### Server Architecture (src/backend/server.ts)

This is a **Bun-native full-stack application** using `Bun.serve()` with routing, WebSockets, and HTML imports:

1. **HTML Import Pattern**: Server imports `index.html` which includes `<script type="module" src="./frontend.tsx">`. Bun's bundler automatically transpiles and bundles React/TypeScript.

2. **Persistent Claude CLI Integration** (with Dependency Injection):
   - Spawns a long-running `claude` CLI process with streaming JSON I/O
   - **Abstraction Layer**: `ClaudeCodeService` interface allows swapping real vs. fake implementations
   - **Production**: Uses `RealClaudeCodeService` (spawns actual Claude CLI)
   - **Testing**: Uses `FakeClaudeCodeService` (mock with deterministic responses)
   - Maintains session state and request/response correlation via session IDs
   - API endpoint at `/api/chat` for sending messages to Claude
   - WebSocket endpoint at `/ws` for real-time log streaming to clients

3. **State Machine** (src/backend/claudeRunner.ts):
   - XState 5 state machine manages Claude process lifecycle
   - Factory pattern: `createClaudeRunnerMachine(service)` accepts injected service
   - Handles process startup, message sending, output parsing, and error recovery

4. **HTTPS Development Server**:
   - Uses TLS certificates in `./certs/` directory
   - Serves on `0.0.0.0:3000` for network access
   - Displays QR code on startup for easy mobile access

5. **Routes**:
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
├── backend/
│   ├── index.tsx                  # Production entry point
│   ├── index.test-server.tsx      # Test entry point (uses FakeClaudeCodeService)
│   ├── server.ts                  # Bun.serve + routes
│   ├── claudeRunner.ts            # XState machine for Claude process
│   ├── claudeRunner.test.ts       # Unit tests for state machine
│   ├── claudeRunner.integration.test.ts  # Integration tests with real CLI
│   └── services/
│       ├── index.ts                      # Service exports
│       ├── ClaudeCodeService.ts          # Interface definition
│       ├── RealClaudeCodeService.ts      # Production implementation
│       ├── FakeClaudeCodeService.ts      # Test mock implementation
│       └── FakeClaudeCodeService.test.ts # Mock unit tests
├── frontend/
│   ├── index.html             # HTML entry with React imports
│   ├── frontend.tsx           # React root component
│   ├── App.tsx                # Main application component
│   ├── APITester.tsx          # Claude API testing UI
│   ├── chatMachine.ts         # Frontend state machine
│   ├── chatMachine.test.ts    # Frontend tests
│   ├── components/ui/         # shadcn/ui components
│   ├── lib/utils.ts           # Utility functions (cn, etc.)
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service worker

tests/
├── chat.spec.ts           # Playwright E2E tests (use FakeClaudeCodeService)
└── screenshots/           # Test screenshots (committed to git)
    ├── desktop-chat.png
    └── mobile-iphone6-chat.png

scripts/
├── build.ts               # Production build script
└── generate-pwa-icons.js  # Icon generation from SVG

docs/
└── bun.md                 # Bun guidelines (important reference)

playwright.config.ts       # Playwright configuration
bunfig.toml               # Bun configuration (test exclusions)
```

## TypeScript Configuration

- **Strict mode enabled** with additional safety checks
- **Module**: "Preserve" with bundler resolution
- **JSX**: react-jsx (React 19)
- **Path alias**: `@/*` → `./src/*`
- Allows `.ts` imports for bundler compatibility

## Testing

### Unit Tests

Use `bun test` with the built-in test runner:

- Test files should use `.test.ts` suffix (in `src/` directory)
- Import from `bun:test`: `import { test, expect, describe } from "bun:test"`
- 5-second timeout per test (configurable with `--timeout`)
- Supports snapshots with `--update-snapshots`
- **Integration Tests**: `claudeRunner.integration.test.ts` tests real Claude CLI (requires claude CLI installed)

```bash
bun test                  # Run all unit tests (src/ directory only)
bun test path/to/test.ts  # Run specific test file
```

### E2E Tests with Playwright

E2E tests are located in `tests/` directory and use Playwright for browser automation.

**Configuration** (`playwright.config.ts`):
- HTTPS support for self-signed dev certificates
- Automatic dev server startup with **FakeClaudeCodeService** (no real Claude CLI needed!)
- HTML reporter for test results
- Screenshots saved to `tests/screenshots/`
- Test files use `.spec.ts` suffix (Playwright-specific)

**Writing UI Tests**:

1. **Test Structure**: Place tests in `tests/*.spec.ts` files
2. **Long Timeouts**: Use `test.setTimeout(120000)` for tests involving LLM responses
3. **Deterministic Prompts**: Use precise prompts to get predictable LLM responses
   ```typescript
   // Good: Precise, constrained prompt
   await input.fill('Please respond with exactly these three words: "Apple Banana Cherry"');

   // Bad: Open-ended prompt that may vary
   await input.fill('Tell me about fruits');
   ```

4. **Screenshots**: Capture screenshots for different viewports
   ```typescript
   // Mobile viewport (iPhone 6: 375x667)
   await page.setViewportSize({ width: 375, height: 667 });
   await page.screenshot({ path: 'tests/screenshots/mobile-feature.png' });

   // Desktop viewport
   await page.setViewportSize({ width: 1920, height: 1080 });
   await page.screenshot({ path: 'tests/screenshots/desktop-feature.png' });
   ```

5. **WebSocket Handling**: Wait for connection before interacting
   ```typescript
   await expect(page.getByText('Connected')).toBeVisible({ timeout: 10000 });
   ```

**Screenshot Management**:
- Screenshots in `tests/screenshots/` ARE committed to git (for visual documentation)
- Test reports in `playwright-report/` are gitignored
- Use consistent naming: `[viewport]-[feature].png`

**Verifying Changes**:
- After UI changes, run `bun run test:e2e` to regenerate screenshots
- Review screenshots visually to confirm layout improvements
- Use Playwright MCP tools during development for interactive testing

## PWA & Assets

- Icons are generated from `src/assets/icon.svg`
- Run `bun run generate:icons` to regenerate PNG variants
- Service worker handles offline caching and PWA installation
