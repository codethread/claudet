import { z } from "zod";
import { assign, fromPromise, setup } from "xstate";

// Zod Schemas for runtime validation
export const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  logs: z.array(z.string()).optional(),
});

export const SessionSchema = z.object({
  id: z.string(),
  model: z.string(),
  createdAt: z.string(),
});

export const WebSocketMessageSchema = z.object({
  type: z.string(),
  sessionId: z.string().optional(),
  data: z.string().optional(),
  sessions: z.array(SessionSchema).optional(),
});

export const ChatAPIResponseSchema = z.object({
  response: z.string(),
  logs: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
});

export const SessionsResponseSchema = z.object({
  sessions: z.array(SessionSchema),
});

// TypeScript types inferred from Zod schemas
export type Message = z.infer<typeof MessageSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type ChatAPIResponse = z.infer<typeof ChatAPIResponseSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// Machine context
export interface ChatMachineContext {
  sessions: Session[];
  currentSessionId: string | null;
  sessionChatHistories: Map<string, Message[]>;
  selectedMessageIndex: number | null;
  currentLogs: string[];
  selectedModel: string;
  error: string | null;
  reconnectAttempts: number;
}

// Machine events
export type ChatMachineEvent =
  | { type: "WEBSOCKET_CONNECTED" }
  | { type: "WEBSOCKET_DISCONNECTED" }
  | { type: "WEBSOCKET_RECONNECTING"; attempts: number }
  | { type: "WEBSOCKET_ERROR"; error: string }
  | { type: "WEBSOCKET_MESSAGE"; data: string }
  | { type: "SEND_MESSAGE"; message: string }
  | { type: "MESSAGE_SUCCESS"; response: ChatAPIResponse }
  | { type: "MESSAGE_ERROR"; error: string }
  | { type: "SELECT_MESSAGE"; index: number }
  | { type: "DESELECT_MESSAGE" }
  | { type: "CLEAR_ERROR" }
  | { type: "SELECT_MODEL"; model: string }
  | { type: "CREATE_SESSION" }
  | { type: "SESSION_CREATED"; session: Session }
  | { type: "SWITCH_SESSION"; sessionId: string }
  | { type: "SESSIONS_LOADED"; sessions: Session[] };

// Actor input for sending messages
export interface SendMessageInput {
  message: string;
  sessionId: string | null;
}

// Actor for sending messages to the API
const sendMessageActor = fromPromise<ChatAPIResponse, SendMessageInput>(
  async ({ input }) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.message,
        sessionId: input.sessionId,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return ChatAPIResponseSchema.parse(data);
  }
);

// Actor input for creating sessions
export interface CreateSessionInput {
  model?: string;
}

// Actor for creating new sessions
const createSessionActor = fromPromise<Session, CreateSessionInput>(
  async ({ input }) => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: input.model }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return SessionSchema.parse(data);
  }
);

// Actor for loading sessions
const loadSessionsActor = fromPromise<Session[], void>(
  async () => {
    const res = await fetch("/api/sessions");

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return SessionsResponseSchema.parse(data).sessions;
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
    createSession: createSessionActor,
    loadSessions: loadSessionsActor,
  },
}).createMachine({
  id: "chat",
  initial: "disconnected",
  context: ({ input }) => ({
    sessions: [],
    currentSessionId: null,
    sessionChatHistories: new Map(),
    selectedMessageIndex: null,
    currentLogs: [],
    selectedModel: "haiku",
    error: null,
    reconnectAttempts: 0,
    ...input,
  }),
  states: {
    disconnected: {
      on: {
        WEBSOCKET_CONNECTED: {
          target: "idle",
          actions: assign({
            error: null,
            reconnectAttempts: 0,
          }),
        },
        WEBSOCKET_RECONNECTING: {
          target: "reconnecting",
          actions: assign({
            reconnectAttempts: ({ event }) => event.attempts,
          }),
        },
        WEBSOCKET_MESSAGE: {
          actions: assign({
            sessions: ({ context, event }) => {
              try {
                const parsed = JSON.parse(event.data);
                const validated = WebSocketMessageSchema.parse(parsed);

                // If connection message includes sessions, update sessions
                if (validated.type === "connection" && validated.sessions) {
                  return validated.sessions;
                }
              } catch (e) {
                console.error("Failed to parse WebSocket message:", e);
              }
              return context.sessions;
            },
            currentSessionId: ({ context, event }) => {
              try {
                const parsed = JSON.parse(event.data);
                const validated = WebSocketMessageSchema.parse(parsed);

                // If connection message includes sessions, set current session
                if (validated.type === "connection" && validated.sessions) {
                  // Set current session to first available if not set
                  if (!context.currentSessionId && validated.sessions.length > 0) {
                    const firstSession = validated.sessions[0];
                    if (firstSession) {
                      return firstSession.id;
                    }
                  }
                }
              } catch (e) {
                console.error("Failed to parse WebSocket message:", e);
              }
              return context.currentSessionId;
            },
          }),
        },
        SESSIONS_LOADED: {
          actions: assign({
            sessions: ({ event }) => event.sessions,
            currentSessionId: ({ context, event }) => {
              // Set current session to first available if not set
              if (!context.currentSessionId && event.sessions.length > 0) {
                const firstSession = event.sessions[0];
                if (firstSession) {
                  return firstSession.id;
                }
              }
              return context.currentSessionId;
            },
          }),
        },
        WEBSOCKET_ERROR: {
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
    },
    reconnecting: {
      on: {
        WEBSOCKET_CONNECTED: {
          target: "idle",
          actions: assign({
            error: null,
            reconnectAttempts: 0,
          }),
        },
        WEBSOCKET_RECONNECTING: {
          actions: assign({
            reconnectAttempts: ({ event }) => event.attempts,
          }),
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
              sessionChatHistories: ({ context, event }) => {
                const sessionId = context.currentSessionId;
                console.log("[chatMachine] SEND_MESSAGE - currentSessionId:", sessionId);
                if (!sessionId) {
                  console.warn("[chatMachine] No currentSessionId, not storing user message");
                  return context.sessionChatHistories;
                }

                const history = context.sessionChatHistories.get(sessionId) || [];
                const updated = new Map(context.sessionChatHistories);
                updated.set(sessionId, [
                  ...history,
                  { role: "user" as const, content: event.message },
                ]);
                console.log("[chatMachine] Stored user message under session:", sessionId);
                return updated;
              },
            }),
          ],
        },
        SELECT_MODEL: {
          actions: assign({
            selectedModel: ({ event }) => event.model,
          }),
        },
        CREATE_SESSION: {
          target: "creatingSession",
        },
        SWITCH_SESSION: {
          actions: assign({
            currentSessionId: ({ event }) => event.sessionId,
            selectedMessageIndex: null,
          }),
        },
        WEBSOCKET_DISCONNECTED: {
          target: "reconnecting",
        },
        WEBSOCKET_RECONNECTING: {
          target: "reconnecting",
          actions: assign({
            reconnectAttempts: ({ event }) => event.attempts,
          }),
        },
        WEBSOCKET_ERROR: {
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
        WEBSOCKET_MESSAGE: {
          actions: assign({
            sessions: ({ context, event }) => {
              try {
                const parsed = JSON.parse(event.data);
                const validated = WebSocketMessageSchema.parse(parsed);

                // If connection message includes sessions, update sessions
                if (validated.type === "connection" && validated.sessions) {
                  console.log("[chatMachine] WEBSOCKET_MESSAGE - connection with sessions:", validated.sessions);
                  return validated.sessions;
                }
              } catch (e) {
                // Ignore parse errors (could be log messages)
              }
              return context.sessions;
            },
            currentSessionId: ({ context, event }) => {
              try {
                const parsed = JSON.parse(event.data);
                const validated = WebSocketMessageSchema.parse(parsed);

                // If connection message includes sessions, set current session
                if (validated.type === "connection" && validated.sessions) {
                  // Set current session to first available if not set
                  if (!context.currentSessionId && validated.sessions.length > 0) {
                    const firstSession = validated.sessions[0];
                    if (firstSession) {
                      console.log("[chatMachine] WEBSOCKET_MESSAGE - Setting currentSessionId to:", firstSession.id);
                      return firstSession.id;
                    }
                  }
                }
              } catch (e) {
                // Ignore parse errors (could be log messages)
              }
              return context.currentSessionId;
            },
          }),
        },
        SESSIONS_LOADED: {
          actions: assign({
            sessions: ({ event }) => {
              console.log("[chatMachine] SESSIONS_LOADED:", event.sessions);
              return event.sessions;
            },
            currentSessionId: ({ context, event }) => {
              // Set current session to first available if not set
              if (!context.currentSessionId && event.sessions.length > 0) {
                const firstSession = event.sessions[0];
                if (firstSession) {
                  console.log("[chatMachine] SESSIONS_LOADED - Setting currentSessionId to:", firstSession.id);
                  return firstSession.id;
                }
              }
              console.log("[chatMachine] SESSIONS_LOADED - Keeping currentSessionId as:", context.currentSessionId);
              return context.currentSessionId;
            },
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
    creatingSession: {
      invoke: {
        id: "createSession",
        src: "createSession",
        input: ({ context }) => ({ model: context.selectedModel }),
        onDone: {
          target: "idle",
          actions: [
            assign({
              sessions: ({ context, event }) => [
                ...context.sessions,
                event.output,
              ],
              currentSessionId: ({ event }) => event.output.id,
            }),
          ],
        },
        onError: {
          target: "idle",
          actions: assign({
            error: ({ event }) => `Failed to create session: ${event.error}`,
          }),
        },
      },
    },
    sending: {
      invoke: {
        id: "sendMessage",
        src: "sendMessage",
        input: ({ context, event }) => {
          if (event.type !== "SEND_MESSAGE") {
            throw new Error("Invalid event type");
          }
          return {
            message: event.message,
            sessionId: context.currentSessionId,
          };
        },
        onDone: {
          target: "idle",
          actions: [
            assign({
              sessionChatHistories: ({ context, event }) => {
                // Always use current session ID, not the one from API response
                const sessionId = context.currentSessionId;
                console.log("[chatMachine] onDone - currentSessionId:", sessionId);
                console.log("[chatMachine] onDone - API returned sessionId:", event.output.sessionId);
                if (!sessionId) return context.sessionChatHistories;

                const history = context.sessionChatHistories.get(sessionId) || [];
                const updated = new Map(context.sessionChatHistories);
                updated.set(sessionId, [
                  ...history,
                  {
                    role: "assistant" as const,
                    content: event.output.response,
                    logs: event.output.logs || [],
                  },
                ]);
                console.log("[chatMachine] Stored assistant message under session:", sessionId);
                console.log("[chatMachine] Updated history length:", updated.get(sessionId)?.length);
                return updated;
              },
              currentLogs: [],
            }),
          ],
        },
        onError: {
          target: "idle",
          actions: [
            assign({
              sessionChatHistories: ({ context, event }) => {
                const sessionId = context.currentSessionId;
                if (!sessionId) return context.sessionChatHistories;

                const history = context.sessionChatHistories.get(sessionId) || [];
                const updated = new Map(context.sessionChatHistories);
                updated.set(sessionId, [
                  ...history,
                  {
                    role: "assistant" as const,
                    content: `Error: ${event.error}`,
                    logs: [],
                  },
                ]);
                return updated;
              },
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
                const parsed = JSON.parse(event.data);
                const validated = WebSocketMessageSchema.parse(parsed);

                // Only add logs for the current session
                if (
                  validated.type === "log" &&
                  validated.sessionId === context.currentSessionId &&
                  validated.data
                ) {
                  return [...context.currentLogs, validated.data];
                }
                return context.currentLogs;
              } catch {
                return context.currentLogs;
              }
            },
          }),
        },
        WEBSOCKET_DISCONNECTED: {
          target: "reconnecting",
        },
        WEBSOCKET_RECONNECTING: {
          target: "reconnecting",
          actions: assign({
            reconnectAttempts: ({ event }) => event.attempts,
          }),
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
