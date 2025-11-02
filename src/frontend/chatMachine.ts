import { z } from 'zod';
import { assign, fromPromise, setup } from 'xstate';
import type { Socket } from 'socket.io-client';
import type { Session, ServerMessage } from '../shared/messages';

// Zod Schemas for runtime validation
export const MessageSchema = z.object({
	role: z.enum(['user', 'assistant']),
	content: z.string(),
	logs: z.array(z.string()).optional(),
});

// TypeScript types inferred from Zod schemas
export type Message = z.infer<typeof MessageSchema>;

// Re-export Session type from shared messages
export type { Session };

// Machine context
export interface ChatMachineContext {
	socket: Socket | null;
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
	| { type: 'WEBSOCKET_CONNECTED' }
	| { type: 'WEBSOCKET_DISCONNECTED' }
	| { type: 'WEBSOCKET_RECONNECTING'; attempts: number }
	| { type: 'WEBSOCKET_ERROR'; error: string }
	| { type: 'WEBSOCKET_MESSAGE'; data: string }
	| { type: 'SEND_MESSAGE'; message: string }
	| { type: 'MESSAGE_ERROR'; error: string }
	| { type: 'SELECT_MESSAGE'; index: number }
	| { type: 'DESELECT_MESSAGE' }
	| { type: 'CLEAR_ERROR' }
	| { type: 'SELECT_MODEL'; model: string }
	| { type: 'CREATE_SESSION' }
	| { type: 'SESSION_CREATED'; session: Session }
	| { type: 'SWITCH_SESSION'; sessionId: string }
	| { type: 'SESSIONS_LOADED'; sessions: Session[] };

// Actor input for sending messages
export interface SendMessageInput {
	socket: Socket;
	message: string;
	sessionId: string;
}

// Actor output for sending messages
export interface SendMessageOutput {
	response: string;
	logs: string[];
	sessionId: string;
}

// Actor for sending messages via Socket.IO
const sendMessageActor = fromPromise<SendMessageOutput, SendMessageInput>(async ({ input }) => {
	const { socket, message, sessionId } = input;
	const requestId = crypto.randomUUID();

	console.log('[sendMessage] Emitting chat:send with requestId:', requestId);

	return new Promise<SendMessageOutput>((resolve, reject) => {
		// Set up response listener
		const handleResponse = (data: unknown) => {
			console.log('[sendMessage] Received chat:response:', data);
			try {
				const msg = data as ServerMessage;
				if (msg.type === 'chat:response' && msg.payload.requestId === requestId) {
					socket.off('chat:response', handleResponse);
					socket.off('chat:error', handleError);
					resolve({
						response: msg.payload.response,
						logs: msg.payload.logs,
						sessionId: msg.payload.sessionId,
					});
				}
			} catch (error) {
				console.error('[sendMessage] Error parsing chat:response:', error);
			}
		};

		const handleError = (data: unknown) => {
			console.log('[sendMessage] Received chat:error:', data);
			try {
				const msg = data as ServerMessage;
				if (msg.type === 'chat:error' && msg.payload.requestId === requestId) {
					socket.off('chat:response', handleResponse);
					socket.off('chat:error', handleError);
					reject(new Error(msg.payload.message));
				}
			} catch (error) {
				console.error('[sendMessage] Error parsing chat:error:', error);
			}
		};

		socket.on('chat:response', handleResponse);
		socket.on('chat:error', handleError);

		// Emit the message
		socket.emit('chat:send', {
			message,
			sessionId,
			requestId,
		});

		// Timeout after 60 seconds
		setTimeout(() => {
			socket.off('chat:response', handleResponse);
			socket.off('chat:error', handleError);
			reject(new Error('Request timeout'));
		}, 60000);
	});
});

// Actor input for creating sessions
export interface CreateSessionInput {
	socket: Socket;
	model?: string;
}

// Actor for creating new sessions via Socket.IO
const createSessionActor = fromPromise<Session, CreateSessionInput>(async ({ input }) => {
	const { socket, model } = input;
	const requestId = crypto.randomUUID();

	console.log('[createSession] Emitting session:create with requestId:', requestId);

	return new Promise<Session>((resolve, reject) => {
		// Set up response listener
		const handleCreated = (data: unknown) => {
			console.log('[createSession] Received session:created:', data);
			try {
				const msg = data as ServerMessage;
				if (msg.type === 'session:created' && msg.payload.requestId === requestId) {
					socket.off('session:created', handleCreated);
					socket.off('session:error', handleError);
					resolve({
						id: msg.payload.id,
						model: msg.payload.model,
						createdAt: msg.payload.createdAt,
					});
				}
			} catch (error) {
				console.error('[createSession] Error parsing session:created:', error);
			}
		};

		const handleError = (data: unknown) => {
			console.log('[createSession] Received session:error:', data);
			try {
				const msg = data as ServerMessage;
				if (msg.type === 'session:error' && msg.payload.requestId === requestId) {
					socket.off('session:created', handleCreated);
					socket.off('session:error', handleError);
					reject(new Error(msg.payload.message));
				}
			} catch (error) {
				console.error('[createSession] Error parsing session:error:', error);
			}
		};

		socket.on('session:created', handleCreated);
		socket.on('session:error', handleError);

		// Emit the request
		socket.emit('session:create', {
			model,
			requestId,
		});

		// Timeout after 30 seconds
		setTimeout(() => {
			socket.off('session:created', handleCreated);
			socket.off('session:error', handleError);
			reject(new Error('Request timeout'));
		}, 30000);
	});
});

// Actor input for loading sessions
export interface LoadSessionsInput {
	socket: Socket;
}

// Actor for loading sessions via Socket.IO
const loadSessionsActor = fromPromise<Session[], LoadSessionsInput>(async ({ input }) => {
	const { socket } = input;
	const requestId = crypto.randomUUID();

	console.log('[loadSessions] Emitting session:list with requestId:', requestId);

	return new Promise<Session[]>((resolve, reject) => {
		// Set up response listener
		const handleList = (data: unknown) => {
			console.log('[loadSessions] Received session:list:', data);
			try {
				const msg = data as ServerMessage;
				if (msg.type === 'session:list' && msg.payload.requestId === requestId) {
					socket.off('session:list', handleList);
					socket.off('session:error', handleError);
					resolve(msg.payload.sessions);
				}
			} catch (error) {
				console.error('[loadSessions] Error parsing session:list:', error);
			}
		};

		const handleError = (data: unknown) => {
			console.log('[loadSessions] Received session:error:', data);
			try {
				const msg = data as ServerMessage;
				if (msg.type === 'session:error' && msg.payload.requestId === requestId) {
					socket.off('session:list', handleList);
					socket.off('session:error', handleError);
					reject(new Error(msg.payload.message));
				}
			} catch (error) {
				console.error('[loadSessions] Error parsing session:error:', error);
			}
		};

		socket.on('session:list', handleList);
		socket.on('session:error', handleError);

		// Emit the request
		socket.emit('session:list', {
			requestId,
		});

		// Timeout after 30 seconds
		setTimeout(() => {
			socket.off('session:list', handleList);
			socket.off('session:error', handleError);
			reject(new Error('Request timeout'));
		}, 30000);
	});
});

export const chatMachine = setup({
	types: {
		context: {} as ChatMachineContext,
		events: {} as ChatMachineEvent,
		input: {} as { socket: Socket },
	},
	actors: {
		sendMessage: sendMessageActor,
		createSession: createSessionActor,
		loadSessions: loadSessionsActor,
	},
}).createMachine({
	id: 'chat',
	initial: 'disconnected',
	context: ({ input }) => ({
		socket: input.socket,
		sessions: [],
		currentSessionId: null,
		sessionChatHistories: new Map(),
		selectedMessageIndex: null,
		currentLogs: [],
		selectedModel: 'haiku',
		error: null,
		reconnectAttempts: 0,
	}),
	states: {
		disconnected: {
			on: {
				WEBSOCKET_CONNECTED: {
					target: 'idle',
					actions: assign({
						error: null,
						reconnectAttempts: 0,
					}),
				},
				WEBSOCKET_RECONNECTING: {
					target: 'reconnecting',
					actions: assign({
						reconnectAttempts: ({ event }) => event.attempts,
					}),
				},
				WEBSOCKET_MESSAGE: {
					actions: assign({
						sessions: ({ context, event }) => {
							try {
								const msg = JSON.parse(event.data) as ServerMessage;

								// If connection message includes sessions, update sessions
								if (msg.type === 'connection' && msg.payload.sessions) {
									return msg.payload.sessions;
								}
							} catch (e) {
								console.error('Failed to parse WebSocket message:', e);
							}
							return context.sessions;
						},
						currentSessionId: ({ context, event }) => {
							try {
								const msg = JSON.parse(event.data) as ServerMessage;

								// If connection message includes sessions, set current session
								if (msg.type === 'connection' && msg.payload.sessions) {
									// Set current session to first available if not set
									if (!context.currentSessionId && msg.payload.sessions.length > 0) {
										const firstSession = msg.payload.sessions[0];
										if (firstSession) {
											return firstSession.id;
										}
									}
								}
							} catch (e) {
								console.error('Failed to parse WebSocket message:', e);
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
					target: 'idle',
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
					target: 'sending',
					actions: [
						assign({
							currentLogs: [],
							error: null,
							sessionChatHistories: ({ context, event }) => {
								const sessionId = context.currentSessionId;
								console.log('[chatMachine] SEND_MESSAGE - currentSessionId:', sessionId);
								if (!sessionId) {
									console.warn('[chatMachine] No currentSessionId, not storing user message');
									return context.sessionChatHistories;
								}

								const history = context.sessionChatHistories.get(sessionId) || [];
								const updated = new Map(context.sessionChatHistories);
								updated.set(sessionId, [
									...history,
									{ role: 'user' as const, content: event.message },
								]);
								console.log('[chatMachine] Stored user message under session:', sessionId);
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
					target: 'creatingSession',
				},
				SWITCH_SESSION: {
					actions: assign({
						currentSessionId: ({ event }) => event.sessionId,
						selectedMessageIndex: null,
					}),
				},
				WEBSOCKET_DISCONNECTED: {
					target: 'reconnecting',
				},
				WEBSOCKET_RECONNECTING: {
					target: 'reconnecting',
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
								const msg = JSON.parse(event.data) as ServerMessage;

								// If connection message includes sessions, update sessions
								if (msg.type === 'connection' && msg.payload.sessions) {
									console.log(
										'[chatMachine] WEBSOCKET_MESSAGE - connection with sessions:',
										msg.payload.sessions,
									);
									return msg.payload.sessions;
								}
							} catch (_e) {
								// Ignore parse errors (could be log messages)
							}
							return context.sessions;
						},
						currentSessionId: ({ context, event }) => {
							try {
								const msg = JSON.parse(event.data) as ServerMessage;

								// If connection message includes sessions, set current session
								if (msg.type === 'connection' && msg.payload.sessions) {
									// Set current session to first available if not set
									if (!context.currentSessionId && msg.payload.sessions.length > 0) {
										const firstSession = msg.payload.sessions[0];
										if (firstSession) {
											console.log(
												'[chatMachine] WEBSOCKET_MESSAGE - Setting currentSessionId to:',
												firstSession.id,
											);
											return firstSession.id;
										}
									}
								}
							} catch (_e) {
								// Ignore parse errors (could be log messages)
							}
							return context.currentSessionId;
						},
					}),
				},
				SESSIONS_LOADED: {
					actions: assign({
						sessions: ({ event }) => {
							console.log('[chatMachine] SESSIONS_LOADED:', event.sessions);
							return event.sessions;
						},
						currentSessionId: ({ context, event }) => {
							// Set current session to first available if not set
							if (!context.currentSessionId && event.sessions.length > 0) {
								const firstSession = event.sessions[0];
								if (firstSession) {
									console.log(
										'[chatMachine] SESSIONS_LOADED - Setting currentSessionId to:',
										firstSession.id,
									);
									return firstSession.id;
								}
							}
							console.log(
								'[chatMachine] SESSIONS_LOADED - Keeping currentSessionId as:',
								context.currentSessionId,
							);
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
				id: 'createSession',
				src: 'createSession',
				input: ({ context }) => {
					if (!context.socket) {
						throw new Error('Socket not available');
					}
					return {
						socket: context.socket,
						model: context.selectedModel,
					};
				},
				onDone: {
					target: 'idle',
					actions: [
						assign({
							sessions: ({ context, event }) => [...context.sessions, event.output],
							currentSessionId: ({ event }) => event.output.id,
						}),
					],
				},
				onError: {
					target: 'idle',
					actions: assign({
						error: ({ event }) => `Failed to create session: ${event.error}`,
					}),
				},
			},
		},
		sending: {
			invoke: {
				id: 'sendMessage',
				src: 'sendMessage',
				input: ({ context, event }) => {
					if (event.type !== 'SEND_MESSAGE') {
						throw new Error('Invalid event type');
					}
					if (!context.socket) {
						throw new Error('Socket not available');
					}
					if (!context.currentSessionId) {
						throw new Error('No current session');
					}
					return {
						socket: context.socket,
						message: event.message,
						sessionId: context.currentSessionId,
					};
				},
				onDone: {
					target: 'idle',
					actions: [
						assign({
							sessionChatHistories: ({ context, event }) => {
								// Always use current session ID, not the one from API response
								const sessionId = context.currentSessionId;
								console.log('[chatMachine] onDone - currentSessionId:', sessionId);
								console.log(
									'[chatMachine] onDone - API returned sessionId:',
									event.output.sessionId,
								);
								if (!sessionId) return context.sessionChatHistories;

								const history = context.sessionChatHistories.get(sessionId) || [];
								const updated = new Map(context.sessionChatHistories);
								updated.set(sessionId, [
									...history,
									{
										role: 'assistant' as const,
										content: event.output.response,
										logs: event.output.logs || [],
									},
								]);
								console.log('[chatMachine] Stored assistant message under session:', sessionId);
								console.log(
									'[chatMachine] Updated history length:',
									updated.get(sessionId)?.length,
								);
								return updated;
							},
							currentLogs: [],
						}),
					],
				},
				onError: {
					target: 'idle',
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
										role: 'assistant' as const,
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
								const msg = JSON.parse(event.data) as ServerMessage;

								// Only add logs for the current session
								if (
									msg.type === 'log' &&
									msg.payload.sessionId === context.currentSessionId &&
									msg.payload.data
								) {
									return [...context.currentLogs, msg.payload.data];
								}
								return context.currentLogs;
							} catch {
								return context.currentLogs;
							}
						},
					}),
				},
				WEBSOCKET_DISCONNECTED: {
					target: 'reconnecting',
				},
				WEBSOCKET_RECONNECTING: {
					target: 'reconnecting',
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
