import { test, expect, describe } from "bun:test";
import { FakeClaudeCodeService } from "./FakeClaudeCodeService";

describe("FakeClaudeCodeService", () => {
  test("should spawn and provide readable streams", async () => {
    const service = new FakeClaudeCodeService();
    const handle = service.spawn("sonnet");

    expect(handle.stdin).toBeDefined();
    expect(handle.stdout).toBeDefined();
    expect(handle.stderr).toBeDefined();
    expect(typeof handle.stdin.write).toBe("function");
  });

  test("should emit system init message when message is sent", async () => {
    const service = new FakeClaudeCodeService();
    service.responseDelayMs = 0; // No delay for unit tests
    const handle = service.spawn("sonnet");

    const messages: string[] = [];
    const reader = handle.stdout.getReader();
    const decoder = new TextDecoder();

    // Start reading
    const readPromise = (async () => {
      let buffer = "";
      for (let i = 0; i < 3; i++) {
        // Read 3 messages
        const { value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim()) {
              messages.push(line);
            }
          }
        }
      }
    })();

    // Send a message
    const inputMessage = JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: "What is 2 + 2? Please respond with only the number, no explanation.",
      },
    });

    handle.stdin.write(inputMessage);

    // Wait for messages
    await readPromise;

    // Verify we got messages
    expect(messages.length).toBeGreaterThanOrEqual(3);

    // Parse and verify init message
    const initMsg = JSON.parse(messages[0]!);
    expect(initMsg.type).toBe("system");
    expect(initMsg.subtype).toBe("init");
    expect(initMsg.session_id).toBeDefined();

    // Parse and verify assistant message
    const assistantMsg = JSON.parse(messages[1]!);
    expect(assistantMsg.type).toBe("assistant");
    expect(assistantMsg.message.content[0].text).toBe("4");

    // Parse and verify result message
    const resultMsg = JSON.parse(messages[2]!);
    expect(resultMsg.type).toBe("result");
    expect(resultMsg.is_error).toBe(false);
    expect(resultMsg.result).toBe("4");

    reader.releaseLock();
    service.close();
  });

  test("should track received messages", () => {
    const service = new FakeClaudeCodeService();
    service.responseDelayMs = 0; // No delay for unit tests
    const handle = service.spawn("sonnet");

    const msg1 = '{"type":"user","message":{"content":"hello"}}';
    const msg2 = '{"type":"user","message":{"content":"world"}}';

    handle.stdin.write(msg1);
    handle.stdin.write(msg2);

    expect(service.receivedMessages).toEqual([msg1, msg2]);

    service.close();
  });
});
