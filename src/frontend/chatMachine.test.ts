import { describe, expect, test } from "vitest";
import { createActor, fromPromise } from "xstate";
import {
  chatMachine,
  type ChatMachineContext,
  type ChatMachineEvent,
  type ChatAPIResponse,
} from "./chatMachine";

// Helper to create a test actor with optional initial context
function createTestActor(initialContext?: Partial<ChatMachineContext>) {
  const machine = chatMachine.provide({
    actors: {
      sendMessage: fromPromise<ChatAPIResponse, { message: string }>(
        async ({ input }) => {
          return {
            response: `Echo: ${input.message}`,
            logs: ["log1", "log2"],
          };
        }
      ),
    },
  });

  const actor = createActor(machine, {
    input: initialContext,
  });
  actor.start();

  return actor;
}

// Helper to create error actor for testing error scenarios
function createErrorActor(errorMessage: string) {
  const machine = chatMachine.provide({
    actors: {
      sendMessage: fromPromise<ChatAPIResponse, { message: string }>(
        async () => {
          throw new Error(errorMessage);
        }
      ),
    },
  });

  const actor = createActor(machine, { input: undefined });
  actor.start();

  return actor;
}

describe("chatMachine", () => {
  describe("initial state", () => {
    test("should start in disconnected state with empty context", () => {
      const actor = createTestActor();

      expect(actor.getSnapshot().value).toBe("disconnected");
      expect(actor.getSnapshot().context).toEqual({
        chatHistory: [],
        selectedMessageIndex: null,
        currentLogs: [],
        error: null,
      });

      actor.stop();
    });
  });

  describe("websocket connection transitions", () => {
    test.each([
      {
        name: "from disconnected to idle on WEBSOCKET_CONNECTED",
        initialState: "disconnected",
        event: { type: "WEBSOCKET_CONNECTED" } as const,
        expectedState: "idle",
        expectedError: null,
      },
      {
        name: "from idle to disconnected on WEBSOCKET_DISCONNECTED",
        initialState: "idle",
        event: { type: "WEBSOCKET_DISCONNECTED" } as const,
        expectedState: "disconnected",
        expectedError: null,
      },
      {
        name: "sets error on WEBSOCKET_ERROR in disconnected state",
        initialState: "disconnected",
        event: { type: "WEBSOCKET_ERROR", error: "Connection failed" } as const,
        expectedState: "disconnected",
        expectedError: "Connection failed",
      },
      {
        name: "sets error on WEBSOCKET_ERROR in idle state",
        initialState: "idle",
        event: { type: "WEBSOCKET_ERROR", error: "Connection lost" } as const,
        expectedState: "idle",
        expectedError: "Connection lost",
      },
    ] satisfies Array<{
      name: string;
      initialState: string;
      event: ChatMachineEvent;
      expectedState: string;
      expectedError: string | null;
    }>)(
      "$name",
      async ({ initialState, event, expectedState, expectedError }) => {
        const actor = createTestActor();

        // Navigate to initial state
        if (initialState === "idle") {
          actor.send({ type: "WEBSOCKET_CONNECTED" });
        }

        // Send event
        actor.send(event);

        expect(actor.getSnapshot().value).toBe(expectedState);
        expect(actor.getSnapshot().context.error).toBe(expectedError);

        actor.stop();
      }
    );
  });

  describe("message selection", () => {
    test.each([
      {
        name: "should select message by index",
        initialContext: {
          chatHistory: [
            { role: "user" as const, content: "Hello" },
            { role: "assistant" as const, content: "Hi", logs: ["log"] },
          ],
        },
        event: { type: "SELECT_MESSAGE", index: 1 } as const,
        expectedSelectedIndex: 1,
      },
      {
        name: "should deselect message",
        initialContext: {
          chatHistory: [
            { role: "user" as const, content: "Hello" },
            { role: "assistant" as const, content: "Hi", logs: ["log"] },
          ],
          selectedMessageIndex: 1,
        },
        event: { type: "DESELECT_MESSAGE" } as const,
        expectedSelectedIndex: null,
      },
    ] satisfies Array<{
      name: string;
      initialContext: Partial<ChatMachineContext>;
      event: ChatMachineEvent;
      expectedSelectedIndex: number | null;
    }>)("$name", ({ initialContext, event, expectedSelectedIndex }) => {
      const actor = createTestActor(initialContext);

      // Navigate to idle state
      actor.send({ type: "WEBSOCKET_CONNECTED" });

      // Send selection event
      actor.send(event);

      expect(actor.getSnapshot().context.selectedMessageIndex).toBe(
        expectedSelectedIndex
      );

      actor.stop();
    });
  });

  describe("sending messages", () => {
    test("should transition to sending state and back to idle on success", async () => {
      const actor = createTestActor();

      actor.send({ type: "WEBSOCKET_CONNECTED" });
      expect(actor.getSnapshot().value).toBe("idle");

      actor.send({ type: "SEND_MESSAGE", message: "Test message" });
      expect(actor.getSnapshot().value).toBe("sending");

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(actor.getSnapshot().value).toBe("idle");

      actor.stop();
    });

    test("should add user message to chat history immediately", () => {
      const actor = createTestActor();

      actor.send({ type: "WEBSOCKET_CONNECTED" });
      actor.send({ type: "SEND_MESSAGE", message: "Hello" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.chatHistory).toHaveLength(1);
      expect(snapshot.context.chatHistory[0]).toEqual({
        role: "user",
        content: "Hello",
      });

      actor.stop();
    });

    test("should add assistant response on successful completion", async () => {
      const actor = createTestActor();

      actor.send({ type: "WEBSOCKET_CONNECTED" });
      actor.send({ type: "SEND_MESSAGE", message: "Hello" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.chatHistory).toHaveLength(2);
      expect(snapshot.context.chatHistory[1]).toEqual({
        role: "assistant",
        content: "Echo: Hello",
        logs: ["log1", "log2"],
      });

      actor.stop();
    });

    test("should reset currentLogs when sending message", () => {
      const actor = createTestActor({
        currentLogs: ["old log 1", "old log 2"],
      });

      actor.send({ type: "WEBSOCKET_CONNECTED" });
      actor.send({ type: "SEND_MESSAGE", message: "Test" });

      expect(actor.getSnapshot().context.currentLogs).toEqual([]);

      actor.stop();
    });

    test("should handle error and add error message to chat", async () => {
      const actor = createErrorActor("API Error");

      actor.send({ type: "WEBSOCKET_CONNECTED" });
      actor.send({ type: "SEND_MESSAGE", message: "Test" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("idle");
      expect(snapshot.context.chatHistory).toHaveLength(2);
      expect(snapshot.context.chatHistory[1]!.content).toContain("API Error");
      expect(snapshot.context.error).toContain("API Error");

      actor.stop();
    });
  });

  describe("websocket messages during sending", () => {
    test("should collect websocket messages while sending", () => {
      const actor = createTestActor();

      actor.send({ type: "WEBSOCKET_CONNECTED" });
      actor.send({ type: "SEND_MESSAGE", message: "Test" });

      // Simulate websocket messages arriving
      actor.send({ type: "WEBSOCKET_MESSAGE", data: "log message 1" });
      actor.send({ type: "WEBSOCKET_MESSAGE", data: "log message 2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.currentLogs).toEqual([
        "log message 1",
        "log message 2",
      ]);

      actor.stop();
    });

    test("should clear currentLogs after successful response", async () => {
      const actor = createTestActor();

      actor.send({ type: "WEBSOCKET_CONNECTED" });
      actor.send({ type: "SEND_MESSAGE", message: "Test" });

      actor.send({ type: "WEBSOCKET_MESSAGE", data: "log 1" });
      expect(actor.getSnapshot().context.currentLogs).toHaveLength(1);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(actor.getSnapshot().context.currentLogs).toEqual([]);

      actor.stop();
    });
  });

  describe("state-based event handling", () => {
    test.each([
      {
        name: "should not handle SEND_MESSAGE in disconnected state",
        initialState: "disconnected",
        event: { type: "SEND_MESSAGE", message: "Test" } as const,
        shouldChangeState: false,
      },
      {
        name: "should handle SEND_MESSAGE in idle state",
        initialState: "idle",
        event: { type: "SEND_MESSAGE", message: "Test" } as const,
        shouldChangeState: true,
      },
    ] satisfies Array<{
      name: string;
      initialState: string;
      event: ChatMachineEvent;
      shouldChangeState: boolean;
    }>)("$name", ({ initialState, event, shouldChangeState }) => {
      const actor = createTestActor();

      if (initialState === "idle") {
        actor.send({ type: "WEBSOCKET_CONNECTED" });
      }

      const stateBefore = actor.getSnapshot().value;
      actor.send(event);
      const stateAfter = actor.getSnapshot().value;

      if (shouldChangeState) {
        expect(stateAfter).not.toBe(stateBefore);
      } else {
        expect(stateAfter).toBe(stateBefore);
      }

      actor.stop();
    });
  });

  describe("context preservation", () => {
    test("should preserve chat history across state transitions", async () => {
      const actor = createTestActor();

      actor.send({ type: "WEBSOCKET_CONNECTED" });
      actor.send({ type: "SEND_MESSAGE", message: "Message 1" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      actor.send({ type: "SEND_MESSAGE", message: "Message 2" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.chatHistory).toHaveLength(4); // 2 user + 2 assistant
      expect(snapshot.context.chatHistory[0]!.content).toBe("Message 1");
      expect(snapshot.context.chatHistory[2]!.content).toBe("Message 2");

      actor.stop();
    });
  });
});
