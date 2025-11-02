# Technical Implementation Notes for WebSocket Communication

**Date**: 2025-11-02
**Related Spec**: `specs/003-websocket-communication.md`

## Purpose

This document captures critical lessons learned and implementation guidance for the WebSocket communication refactor. **Read this before starting implementation.**

## Critical Testing Requirements

### 1. Verify Tests Actually Test WebSocket Communication

**Problem Discovered**: Previous attempts created tests that only verified UI state (DOM elements appearing/disappearing) without actually testing WebSocket message flow.

**Example of Bad Test**:
```typescript
// This only tests UI, NOT WebSocket communication
await sendButton.click();
await expect(page.getByText('Thinking...')).toBeVisible();
await expect(page.getByText('Thinking...')).not.toBeVisible({ timeout: 3000 });
```

**What This Fails To Test**:
- Whether `chat:send` event is actually emitted
- Whether server receives the message
- Whether `chat:response` event is received
- Whether requestId correlation works
- Whether message content is correct

**Solution**: Tests MUST verify actual WebSocket traffic using Playwright's WebSocket interception or by exposing the socket client to `window` for inspection.

### 2. E2E Test Reporter Configuration

**Critical**: The playwright config MUST use `'line'` reporter, not `'html'`:

```typescript
reporter: 'line', // Use line reporter for immediate feedback (html reporter can hang)
```

**Why**: The HTML reporter can hang/timeout, preventing you from seeing test failures in real-time. The line reporter provides immediate feedback on which tests pass/fail.

### 3. Run E2E Tests Frequently During Development

**DO NOT** wait until the end to run E2E tests. Run them after each major change:

```bash
bun run test:e2e
```

If tests start failing, you know the last change broke something. If you wait until the end, you'll have no idea what caused the break.

### 4. Use `bun run validate` Regularly

Run the full validation suite frequently:

```bash
bun run validate  # Runs: type-check, format, lint, test, test:e2e, build
```

This catches issues early before they compound.

## Implementation Pitfalls to Avoid

### Pitfall 1: Over-Mocking in Unit Tests

**Problem**: Creating mock implementations that replace entire actors prevents testing the real WebSocket code.

**Bad Example**:
```typescript
const machine = chatMachine.provide({
  actors: {
    sendMessage: fromPromise(async () => {
      return { response: 'fake response' }; // This NEVER tests Socket.IO
    }),
  },
});
```

**Solution**: Mock Socket.IO client behavior, not the actor implementation. Test the real actor code with a mocked socket.

### Pitfall 2: Socket Initialization Race Conditions

**Problem**: The Socket.IO client may not be available when the chatMachine initializes, causing null reference errors.

**Key Questions To Answer**:
- When is the socket created?
- When does it connect?
- How does the machine know when it's ready?
- What happens if user tries to send a message before socket is ready?

**Solution Approach**: Consider passing the socket to the machine as input, or using a loading state until the socket is ready.

### Pitfall 3: Incomplete Server Validation Tests

**Problem**: Creating "placeholder" tests that check object structure but don't actually invoke server handlers.

**Bad Example**:
```typescript
test('should reject invalid data', () => {
  const invalidData = { type: 'chat:send', payload: {} };
  expect(invalidData.payload).not.toHaveProperty('message'); // Useless
});
```

**Solution**: Tests must actually invoke Socket.IO handlers with test data and verify error events are emitted.

### Pitfall 4: requestId Correlation Not Tested

**Problem**: Implementing requestId in code but never verifying it actually correlates requests with responses.

**Solution**: E2E tests MUST verify that the requestId in the response matches the requestId in the request.

## Recommended Development Workflow

1. **Start with types**: Create `src/shared/messages.ts` with discriminated unions and Zod schemas
   ```bash
   bun run type-check  # Verify types compile
   ```

2. **Implement server handlers**: Add Socket.IO event handlers with runtime validation
   ```bash
   bun test src/backend/  # Run server unit tests
   ```

3. **Test server handlers**: Write tests that actually invoke handlers with mocked Socket.IO
   ```bash
   bun test src/backend/server.validation.test.ts
   ```

4. **Implement client actors**: Update chatMachine to use Socket.IO instead of fetch
   ```bash
   bun test src/frontend/  # Run frontend unit tests
   ```

5. **Manual testing**: Start dev server and test in browser
   ```bash
   bun dev
   # Open https://localhost:3000
   # Open DevTools → Network → WS tab
   # Send a message and verify WebSocket events
   ```

6. **E2E tests**: Add/update E2E tests to verify WebSocket communication
   ```bash
   bun run test:e2e
   ```

7. **Full validation**: Run complete validation suite
   ```bash
   bun run validate
   ```

## Type Safety Requirements

### Use Discriminated Unions Everywhere

```typescript
// Good: Discriminated union for capture results
type CaptureResult<T> =
  | { status: 'captured'; message: T; timestamp: number }
  | { status: 'timeout'; timeout: number }
  | { status: 'error'; error: string };

// Use exhaustive pattern matching
switch (result.status) {
  case 'captured':
    // TypeScript knows `message` exists here
    break;
  case 'timeout':
    // TypeScript knows `timeout` exists here
    break;
  case 'error':
    // TypeScript knows `error` exists here
    break;
  // No default needed - TypeScript enforces exhaustiveness
}
```

### Avoid `any` Types

**Exception**: When augmenting `window` object for testing, use `any` with a comment explaining why:

```typescript
if (navigator.webdriver) {
  (window as any).__socket = socket; // Expose for E2E tests
}
```

## Socket.IO Event Naming Conventions

Follow the `namespace:action` pattern consistently:

**Requests**:
- `chat:send`
- `session:list`
- `session:create`

**Responses**:
- `chat:response`
- `chat:error`
- `session:list` (response has same name as request)
- `session:created`
- `session:error`

**Rationale**: Specific event names are easier to test and debug than a single `'message'` event.

## Debugging Tips

### Check WebSocket Traffic in DevTools

1. Open DevTools → Network → WS tab
2. Click on the Socket.IO connection
3. Watch Messages tab to see events in real-time
4. Verify event names, payloads, and requestId values

### Enable Verbose Logging

Add debug logging to actors:

```typescript
const sendMessageActor = fromPromise(async ({ input }) => {
  console.log('[sendMessage] Emitting chat:send:', input);
  socket.emit('chat:send', { ...input });

  return new Promise((resolve, reject) => {
    socket.once('chat:response', (data) => {
      console.log('[sendMessage] Received chat:response:', data);
      resolve(data);
    });
  });
});
```

### Test Socket Availability

Before implementation, verify socket is accessible:

```typescript
useEffect(() => {
  if (socket) {
    console.log('Socket connected:', socket.connected);
    console.log('Socket id:', socket.id);
  }
}, [socket]);
```

## Common Error Messages and Solutions

### "Socket not available"
**Cause**: Machine tried to use socket before it was initialized
**Solution**: Ensure socket is passed to machine input, or add loading state

### "Thinking... never disappears"
**Cause**: `chat:response` event not being received
**Solution**: Check server handler is actually emitting the event with correct name

### "requestId mismatch"
**Cause**: Response contains different requestId than request
**Solution**: Verify server copies requestId from request to response

### "Tests pass but local testing fails"
**Cause**: Tests mock functionality instead of testing real implementation
**Solution**: Rewrite tests to actually verify WebSocket communication

## Success Criteria Checklist

Before considering the implementation complete, verify:

- [ ] `bun run validate` passes with no errors
- [ ] E2E tests verify actual WebSocket traffic (not just UI state)
- [ ] Manual testing in browser shows messages sending and receiving correctly
- [ ] DevTools WS tab shows correct event names and payloads
- [ ] requestId correlation works (verify in DevTools)
- [ ] Error handling works (try sending invalid data)
- [ ] Reconnection works (disconnect network, reconnect)
- [ ] All existing functionality still works (sessions, logs, etc.)

## Resources

- Socket.IO Client API: https://socket.io/docs/v4/client-api/
- Socket.IO Server API: https://socket.io/docs/v4/server-api/
- XState v5 Actors: https://stately.ai/docs/actors
- Playwright WebSocket Testing: https://playwright.dev/docs/network
- Zod Documentation: https://zod.dev/

## Final Notes

This refactor is **not trivial**. The key to success is:

1. **Test frequently** - Don't write all code then test
2. **Verify WebSocket traffic** - Don't trust UI state alone
3. **Use strong types** - Let TypeScript catch errors at compile time
4. **Manual testing** - Always verify in browser with DevTools open
5. **Read this document** - Don't skip the lessons learned

Good luck! 🚀
