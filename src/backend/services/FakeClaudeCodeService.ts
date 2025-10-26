import type {
  ClaudeCodeService,
  ClaudeProcessHandle,
  ClaudeModel,
} from "./ClaudeCodeService";

/**
 * FakeClaudeCodeService - Test implementation with controllable behavior
 *
 * Provides mock streams that can be programmatically controlled for testing.
 * Simulates the exact JSON streaming interface of the real Claude CLI.
 */
export class FakeClaudeCodeService implements ClaudeCodeService {
  private stdoutController?: ReadableStreamDefaultController<Uint8Array>;
  private stderrController?: ReadableStreamDefaultController<Uint8Array>;
  public receivedMessages: string[] = [];
  private currentModel?: ClaudeModel;

  /**
   * Delay in milliseconds before sending response (simulates API latency)
   * Default: 500ms to ensure UI "Thinking..." indicator appears
   */
  public responseDelayMs: number = 500;

  /**
   * Configure deterministic responses for specific prompts
   * This allows tests to have predictable outputs
   */
  private responseMap: Map<string, string> = new Map([
    [
      "Please respond with exactly these three words in order: \"Apple Banana Cherry\". Do not add any additional text, punctuation, or explanation.",
      "Apple Banana Cherry",
    ],
    [
      "Count from 1 to 5, outputting only the numbers separated by spaces. Example format: 1 2 3 4 5",
      "1 2 3 4 5",
    ],
    ["What is 2 + 2? Please respond with only the number, no explanation.", "4"],
  ]);

  spawn(model: ClaudeModel): ClaudeProcessHandle {
    this.currentModel = model;
    const encoder = new TextEncoder();

    // Create controllable stdout stream
    const stdout = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.stdoutController = controller;
      },
    });

    // Create controllable stderr stream (usually empty)
    const stderr = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.stderrController = controller;
      },
    });

    // Create writable stdin that triggers responses
    const stdin = {
      write: (data: string) => {
        this.receivedMessages.push(data);

        // Parse the incoming message
        try {
          const message = JSON.parse(data.trim());
          if (message.type === "user" && message.message?.content) {
            const userContent = message.message.content;
            this.handleUserMessage(userContent);
          }
        } catch (e) {
          console.error("FakeClaudeCodeService: Failed to parse input:", e);
        }
      },
    };

    return { stdin, stdout, stderr };
  }

  /**
   * Simulate Claude CLI's JSON streaming response
   */
  private async handleUserMessage(content: string) {
    if (!this.stdoutController) return;

    const encoder = new TextEncoder();
    const sessionId = crypto.randomUUID();

    // 1. Send system init message (immediately)
    const initMessage = {
      type: "system",
      subtype: "init",
      session_id: sessionId,
      uuid: crypto.randomUUID(),
      apiKeySource: "test",
      cwd: process.env.CLAUDE_DIR || "/fake/path",
      model: `claude-${this.currentModel}-fake`,
    };
    this.stdoutController.enqueue(
      encoder.encode(JSON.stringify(initMessage) + "\n"),
    );

    // 2. Determine response based on content
    const response =
      this.responseMap.get(content) || `Echo: ${content.substring(0, 50)}`;

    // Wait for configured delay (simulates API latency)
    if (this.responseDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseDelayMs));
    }

    // 3. Send assistant message
    const assistantMessage = {
      type: "assistant",
      uuid: crypto.randomUUID(),
      session_id: sessionId,
      message: {
        content: [
          {
            type: "text",
            text: response,
          },
        ],
      },
    };
    this.stdoutController.enqueue(
      encoder.encode(JSON.stringify(assistantMessage) + "\n"),
    );

    // 4. Send result message (final)
    const resultMessage = {
      type: "result",
      subtype: "success",
      uuid: crypto.randomUUID(),
      session_id: sessionId,
      duration_ms: this.responseDelayMs,
      duration_api_ms: this.responseDelayMs * 0.8,
      is_error: false,
      num_turns: 1,
      result: response,
      total_cost_usd: 0.0001,
      usage: {
        input_tokens: 10,
        output_tokens: 5,
      },
    };
    this.stdoutController.enqueue(
      encoder.encode(JSON.stringify(resultMessage) + "\n"),
    );
  }

  /**
   * Add custom response mapping for tests
   */
  addResponse(prompt: string, response: string) {
    this.responseMap.set(prompt, response);
  }

  /**
   * Helper to close streams (for cleanup in tests)
   */
  close() {
    this.stdoutController?.close();
    this.stderrController?.close();
  }
}
