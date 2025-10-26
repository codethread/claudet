import { z } from "zod";
import { assign, fromPromise, setup } from "xstate";

// Zod Schemas for runtime validation
export const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  logs: z.array(z.string()).optional(),
});

export const WebSocketMessageSchema = z.string();

export const ChatAPIResponseSchema = z.object({
  response: z.string(),
  logs: z.array(z.string()).optional(),
});

// TypeScript types inferred from Zod schemas
export type Message = z.infer<typeof MessageSchema>;
export type ChatAPIResponse = z.infer<typeof ChatAPIResponseSchema>;

// Machine context
export interface ChatMachineContext {
  chatHistory: Message[];
  selectedMessageIndex: number | null;
  currentLogs: string[];
  error: string | null;
}

// Machine events
export type ChatMachineEvent =
  | { type: "WEBSOCKET_CONNECTED" }
  | { type: "WEBSOCKET_DISCONNECTED" }
  | { type: "WEBSOCKET_ERROR"; error: string }
  | { type: "WEBSOCKET_MESSAGE"; data: string }
  | { type: "SEND_MESSAGE"; message: string }
  | { type: "MESSAGE_SUCCESS"; response: ChatAPIResponse }
  | { type: "MESSAGE_ERROR"; error: string }
  | { type: "SELECT_MESSAGE"; index: number }
  | { type: "DESELECT_MESSAGE" }
  | { type: "CLEAR_ERROR" };

// Actor input for sending messages
export interface SendMessageInput {
  message: string;
}

// Actor for sending messages to the API
const sendMessageActor = fromPromise<ChatAPIResponse, SendMessageInput>(
  async ({ input }) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input.message }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return ChatAPIResponseSchema.parse(data);
  }
);

export const chatMachine = setup({
  types: {
    context: {} as ChatMachineContext,
    events: {} as ChatMachineEvent,
    input: {} as Partial<ChatMachineContext> | undefined,
  },
  actors: {
    sendMessage: sendMessageActor,
  },
}).createMachine({
  id: "chat",
  initial: "disconnected",
  context: ({ input }) => ({
    chatHistory: [],
    selectedMessageIndex: null,
    currentLogs: [],
    error: null,
    ...input,
  }),
  states: {
    disconnected: {
      on: {
        WEBSOCKET_CONNECTED: {
          target: "idle",
          actions: assign({ error: null }),
        },
        WEBSOCKET_ERROR: {
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
    },
    idle: {
      on: {
        SEND_MESSAGE: {
          target: "sending",
          actions: [
            assign({
              currentLogs: [],
              error: null,
              chatHistory: ({ context, event }) => [
                ...context.chatHistory,
                { role: "user" as const, content: event.message },
              ],
            }),
          ],
        },
        WEBSOCKET_DISCONNECTED: {
          target: "disconnected",
        },
        WEBSOCKET_ERROR: {
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
        SELECT_MESSAGE: {
          actions: assign({
            selectedMessageIndex: ({ event }) => event.index,
          }),
        },
        DESELECT_MESSAGE: {
          actions: assign({
            selectedMessageIndex: null,
          }),
        },
      },
    },
    sending: {
      invoke: {
        id: "sendMessage",
        src: "sendMessage",
        input: ({ event }) => {
          if (event.type !== "SEND_MESSAGE") {
            throw new Error("Invalid event type");
          }
          return { message: event.message };
        },
        onDone: {
          target: "idle",
          actions: [
            assign({
              chatHistory: ({ context, event }) => [
                ...context.chatHistory,
                {
                  role: "assistant" as const,
                  content: event.output.response,
                  logs: event.output.logs || [],
                },
              ],
              currentLogs: [],
            }),
          ],
        },
        onError: {
          target: "idle",
          actions: [
            assign({
              chatHistory: ({ context, event }) => [
                ...context.chatHistory,
                {
                  role: "assistant" as const,
                  content: `Error: ${event.error}`,
                  logs: [],
                },
              ],
              currentLogs: [],
              error: ({ event }) => String(event.error),
            }),
          ],
        },
      },
      on: {
        WEBSOCKET_MESSAGE: {
          actions: assign({
            currentLogs: ({ context, event }) => {
              try {
                const validated = WebSocketMessageSchema.parse(event.data);
                return [...context.currentLogs, validated];
              } catch {
                return context.currentLogs;
              }
            },
          }),
        },
        WEBSOCKET_DISCONNECTED: {
          target: "disconnected",
        },
        WEBSOCKET_ERROR: {
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
    },
  },
});

export type ChatMachine = typeof chatMachine;
