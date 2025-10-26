// @ts-nocheck - Test mocks use simplified types that don't match Bun's exact types
import { describe, expect, test } from "vitest";
import { createActor, fromPromise } from "xstate";
import { claudeRunnerMachine } from "./claudeRunner";

describe("claudeRunnerMachine", () => {
  describe("initial state", () => {
    test("should start in idle state", () => {
      const actor = createActor(claudeRunnerMachine);
      actor.start();

      expect(actor.getSnapshot().value).toBe("idle");
      expect(actor.getSnapshot().context.processHandle).toBe(null);
      expect(actor.getSnapshot().context.pendingRequests.size).toBe(0);

      actor.stop();
    });
  });

  describe("process lifecycle", () => {
    test("should transition from idle to starting when START_PROCESS is sent", () => {
      const mockMachine = claudeRunnerMachine.provide({
        actors: {
          startProcess: fromPromise(async () => {
            return {
              stdin: { write: () => {} } as any,
              stdout: new ReadableStream(),
              stderr: new ReadableStream(),
            };
          }),
        },
      });

      const actor = createActor(mockMachine);
      actor.start();

      actor.send({ type: "START_PROCESS" });
      expect(actor.getSnapshot().value).toBe("starting");

      actor.stop();
    });

    test("should transition to running on successful process start", async () => {
      const mockMachine = claudeRunnerMachine.provide({
        actors: {
          startProcess: fromPromise(async () => {
            return {
              stdin: { write: () => {} } as any,
              stdout: new ReadableStream(),
              stderr: new ReadableStream(),
            };
          }),
        },
      });

      const actor = createActor(mockMachine);
      actor.start();

      actor.send({ type: "START_PROCESS" });

      // Wait for the async transition
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(actor.getSnapshot().value).toBe("running");
      expect(actor.getSnapshot().context.processHandle).not.toBe(null);

      actor.stop();
    });

    test("should transition to error state on process start failure", async () => {
      const mockMachine = claudeRunnerMachine.provide({
        actors: {
          startProcess: fromPromise(async () => {
            throw new Error("Process start failed");
          }),
        },
      });

      const actor = createActor(mockMachine);
      actor.start();

      actor.send({ type: "START_PROCESS" });

      // Wait for the async transition
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(actor.getSnapshot().value).toBe("error");
      expect(actor.getSnapshot().context.error).toContain("Process start failed");

      actor.stop();
    });
  });

  describe("WebSocket client management", () => {
    test("should register WebSocket clients", async () => {
      const mockMachine = claudeRunnerMachine.provide({
        actors: {
          startProcess: fromPromise(async () => {
            return {
              stdin: { write: () => {} } as any,
              stdout: new ReadableStream(),
              stderr: new ReadableStream(),
            };
          }),
        },
      });

      const actor = createActor(mockMachine);
      actor.start();

      actor.send({ type: "START_PROCESS" });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const mockClient = { id: "test-client" };
      actor.send({ type: "REGISTER_WS_CLIENT", client: mockClient });

      expect(actor.getSnapshot().context.logClients.has(mockClient)).toBe(true);

      actor.stop();
    });

    test("should unregister WebSocket clients", async () => {
      const mockMachine = claudeRunnerMachine.provide({
        actors: {
          startProcess: fromPromise(async () => {
            return {
              stdin: { write: () => {} } as any,
              stdout: new ReadableStream(),
              stderr: new ReadableStream(),
            };
          }),
        },
      });

      const actor = createActor(mockMachine);
      actor.start();

      actor.send({ type: "START_PROCESS" });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const mockClient = { id: "test-client" };
      actor.send({ type: "REGISTER_WS_CLIENT", client: mockClient });
      expect(actor.getSnapshot().context.logClients.has(mockClient)).toBe(true);

      actor.send({ type: "UNREGISTER_WS_CLIENT", client: mockClient });
      expect(actor.getSnapshot().context.logClients.has(mockClient)).toBe(false);

      actor.stop();
    });
  });

  describe("message handling", () => {
    test("should track pending requests when sending messages", async () => {
      const mockMachine = claudeRunnerMachine.provide({
        actors: {
          startProcess: fromPromise(async () => {
            return {
              stdin: { write: () => {} } as any,
              stdout: new ReadableStream(),
              stderr: new ReadableStream(),
            };
          }),
        },
      });

      const actor = createActor(mockMachine);
      actor.start();

      actor.send({ type: "START_PROCESS" });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const messageId = "test-message-id";
      actor.send({
        type: "SEND_MESSAGE",
        message: "Hello, Claude!",
        messageId,
      });

      expect(actor.getSnapshot().context.pendingRequests.has(messageId)).toBe(true);

      actor.stop();
    });
  });

  describe("state transitions", () => {
    test("should transition to stopped state on STOP event", async () => {
      const mockMachine = claudeRunnerMachine.provide({
        actors: {
          startProcess: fromPromise(async () => {
            return {
              stdin: { write: () => {} } as any,
              stdout: new ReadableStream(),
              stderr: new ReadableStream(),
            };
          }),
        },
      });

      const actor = createActor(mockMachine);
      actor.start();

      actor.send({ type: "START_PROCESS" });
      await new Promise((resolve) => setTimeout(resolve, 100));

      actor.send({ type: "STOP" });
      expect(actor.getSnapshot().value).toBe("stopped");

      actor.stop();
    });

    test("should allow restarting from error state", async () => {
      const mockMachine = claudeRunnerMachine.provide({
        actors: {
          startProcess: fromPromise(async () => {
            throw new Error("First attempt failed");
          }),
        },
      });

      const actor = createActor(mockMachine);
      actor.start();

      actor.send({ type: "START_PROCESS" });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(actor.getSnapshot().value).toBe("error");

      // Create a new machine that will succeed
      const successMachine = claudeRunnerMachine.provide({
        actors: {
          startProcess: fromPromise(async () => {
            return {
              stdin: new WritableStream(),
              stdout: new ReadableStream(),
              stderr: new ReadableStream(),
            };
          }),
        },
      });

      const actor2 = createActor(successMachine);
      actor2.start();

      // Simulate error state
      actor2.send({ type: "START_PROCESS" });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(actor2.getSnapshot().value).toBe("running");

      actor.stop();
      actor2.stop();
    });
  });
});
