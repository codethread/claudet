import { describe, expect, test } from 'bun:test';
import { createActor, fromPromise } from 'xstate';
import type { Socket } from 'socket.io-client';
import {
	chatMachine,
	type ChatMachineContext,
	type ChatMachineEvent,
	type SendMessageInput,
	type SendMessageOutput,
	type CreateSessionInput,
	type Session,
} from './chatMachine';

const TEST_SESSION_ID = 'test-session-123';

// Create a mock Socket.IO socket for testing
function createMockSocket(): Socket {
	const mockSocket: Partial<Socket> = {
		connected: true,
		id: 'mock-socket-id',
	};

	mockSocket.emit = function (this: Socket) {
		return this;
	};

	mockSocket.on = function (this: Socket, ev?: string, listener?: (...args: any[]) => void) {
		if (ev === undefined || listener === undefined) {
			return this;
		}
		return this;
	};

	mockSocket.off = function (this: Socket, ev?: string, listener?: (...args: any[]) => void) {
		if (ev === undefined) {
			return this;
		}
		return this;
	};

	return mockSocket as Socket;
}

// Helper to create a test actor with optional delay
function createTestActor(_initialContext?: Partial<ChatMachineContext>, delay: number = 0) {
	const mockSocket = createMockSocket();

	const machine = chatMachine.provide({
		actors: {
			sendMessage: fromPromise<SendMessageOutput, SendMessageInput>(async ({ input }) => {
				if (delay > 0) {
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
				return {
					response: `Echo: ${input.message}`,
					sessionId: input.sessionId,
				};
			}),
		},
	});

	const actor = createActor(machine, {
		input: { socket: mockSocket },
	});
	actor.start();

	return actor;
}

// Helper to create error actor for testing error scenarios
function createErrorActor(errorMessage: string) {
	const mockSocket = createMockSocket();

	const machine = chatMachine.provide({
		actors: {
			sendMessage: fromPromise<SendMessageOutput, SendMessageInput>(async () => {
				throw new Error(errorMessage);
			}),
		},
	});

	const actor = createActor(machine, {
		input: { socket: mockSocket },
	});
	actor.start();

	return actor;
}

describe('chatMachine', () => {
	describe('initial state', () => {
		test('should start in disconnected state with empty context', () => {
			const actor = createTestActor();

			expect(actor.getSnapshot().value).toBe('disconnected');
			const context = actor.getSnapshot().context;
			expect(context.sessions).toHaveLength(0);
			expect(context.currentSessionId).toBe(null);
			expect(context.sessionChatHistories.size).toBe(0);
			expect(context.error).toBe(null);

			actor.stop();
		});
	});

	describe('websocket connection transitions', () => {
		test.each([
			{
				name: 'from disconnected to idle on WEBSOCKET_CONNECTED',
				initialState: 'disconnected',
				event: { type: 'WEBSOCKET_CONNECTED' } as const,
				expectedState: 'idle',
				expectedError: null,
			},
			{
				name: 'from idle to reconnecting on WEBSOCKET_DISCONNECTED',
				initialState: 'idle',
				event: { type: 'WEBSOCKET_DISCONNECTED' } as const,
				expectedState: 'reconnecting',
				expectedError: null,
			},
			{
				name: 'sets error on WEBSOCKET_ERROR in disconnected state',
				initialState: 'disconnected',
				event: { type: 'WEBSOCKET_ERROR', error: 'Connection failed' } as const,
				expectedState: 'disconnected',
				expectedError: 'Connection failed',
			},
			{
				name: 'sets error on WEBSOCKET_ERROR in idle state',
				initialState: 'idle',
				event: { type: 'WEBSOCKET_ERROR', error: 'Connection lost' } as const,
				expectedState: 'idle',
				expectedError: 'Connection lost',
			},
		] satisfies Array<{
			name: string;
			initialState: string;
			event: ChatMachineEvent;
			expectedState: 'idle' | 'disconnected' | 'reconnecting' | 'sending' | 'creatingSession';
			expectedError: string | null;
		}>)('$name', async ({ initialState, event, expectedState, expectedError }) => {
			const actor = createTestActor();

			if (initialState === 'idle') {
				actor.send({ type: 'WEBSOCKET_CONNECTED' });
			}

			actor.send(event);

			expect(actor.getSnapshot().value).toBe(expectedState);
			expect(actor.getSnapshot().context.error).toBe(expectedError);

			actor.stop();
		});
	});

	describe('sending messages', () => {
		test('should transition to sending state and back to idle on success', async () => {
			const actor = createTestActor();

			actor.send({ type: 'WEBSOCKET_CONNECTED' });
			expect(actor.getSnapshot().value).toBe('idle');

			actor.send({
				type: 'SESSIONS_LOADED',
				sessions: [{ id: TEST_SESSION_ID, model: 'haiku', createdAt: new Date().toISOString() }],
			});

			actor.send({ type: 'SEND_MESSAGE', message: 'Test message' });
			expect(actor.getSnapshot().value).toBe('sending');

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(actor.getSnapshot().value).toBe('idle');

			actor.stop();
		});

		test('should add user message to chat history immediately', () => {
			const actor = createTestActor();

			actor.send({ type: 'WEBSOCKET_CONNECTED' });

			actor.send({
				type: 'SESSIONS_LOADED',
				sessions: [{ id: TEST_SESSION_ID, model: 'haiku', createdAt: new Date().toISOString() }],
			});

			actor.send({ type: 'SEND_MESSAGE', message: 'Hello' });

			const snapshot = actor.getSnapshot();
			const chatHistory = snapshot.context.sessionChatHistories.get(TEST_SESSION_ID) || [];
			expect(chatHistory).toHaveLength(1);
			expect(chatHistory[0]).toEqual({ role: 'user', content: 'Hello' });

			actor.stop();
		});

		test('should add assistant response on successful completion', async () => {
			const actor = createTestActor();

			actor.send({ type: 'WEBSOCKET_CONNECTED' });

			actor.send({
				type: 'SESSIONS_LOADED',
				sessions: [{ id: TEST_SESSION_ID, model: 'haiku', createdAt: new Date().toISOString() }],
			});

			actor.send({ type: 'SEND_MESSAGE', message: 'Hello' });

			await new Promise((resolve) => setTimeout(resolve, 100));

			const snapshot = actor.getSnapshot();
			const chatHistory = snapshot.context.sessionChatHistories.get(TEST_SESSION_ID) || [];
			expect(chatHistory).toHaveLength(2);
			expect(chatHistory[1]).toEqual({ role: 'assistant', content: 'Echo: Hello' });

			actor.stop();
		});

		test('should handle error and add error message to chat', async () => {
			const actor = createErrorActor('API Error');

			actor.send({ type: 'WEBSOCKET_CONNECTED' });

			actor.send({
				type: 'SESSIONS_LOADED',
				sessions: [{ id: TEST_SESSION_ID, model: 'haiku', createdAt: new Date().toISOString() }],
			});

			actor.send({ type: 'SEND_MESSAGE', message: 'Test' });

			await new Promise((resolve) => setTimeout(resolve, 100));

			const snapshot = actor.getSnapshot();
			const chatHistory = snapshot.context.sessionChatHistories.get(TEST_SESSION_ID) || [];
			expect(snapshot.value).toBe('idle');
			expect(chatHistory).toHaveLength(2);
			expect(chatHistory[1]!.content).toContain('API Error');
			expect(snapshot.context.error).toContain('API Error');

			actor.stop();
		});
	});

	describe('state-based event handling', () => {
		test.each([
			{
				name: 'should not handle SEND_MESSAGE in disconnected state',
				initialState: 'disconnected',
				event: { type: 'SEND_MESSAGE', message: 'Test' } as const,
				shouldChangeState: false,
			},
			{
				name: 'should handle SEND_MESSAGE in idle state',
				initialState: 'idle',
				event: { type: 'SEND_MESSAGE', message: 'Test' } as const,
				shouldChangeState: true,
			},
		] satisfies Array<{
			name: string;
			initialState: string;
			event: ChatMachineEvent;
			shouldChangeState: boolean;
		}>)('$name', ({ initialState, event, shouldChangeState }) => {
			const actor = createTestActor();

			if (initialState === 'idle') {
				actor.send({ type: 'WEBSOCKET_CONNECTED' });
				if (event.type === 'SEND_MESSAGE') {
					actor.send({
						type: 'SESSIONS_LOADED',
						sessions: [
							{ id: TEST_SESSION_ID, model: 'haiku', createdAt: new Date().toISOString() },
						],
					});
				}
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

	describe('context preservation', () => {
		test('should preserve chat history across state transitions', async () => {
			const actor = createTestActor();

			actor.send({ type: 'WEBSOCKET_CONNECTED' });

			actor.send({
				type: 'SESSIONS_LOADED',
				sessions: [{ id: TEST_SESSION_ID, model: 'haiku', createdAt: new Date().toISOString() }],
			});

			actor.send({ type: 'SEND_MESSAGE', message: 'Message 1' });
			await new Promise((resolve) => setTimeout(resolve, 100));

			actor.send({ type: 'SEND_MESSAGE', message: 'Message 2' });
			await new Promise((resolve) => setTimeout(resolve, 100));

			const snapshot = actor.getSnapshot();
			const chatHistory = snapshot.context.sessionChatHistories.get(TEST_SESSION_ID) || [];
			expect(chatHistory).toHaveLength(4); // 2 user + 2 assistant
			expect(chatHistory[0]!.content).toBe('Message 1');
			expect(chatHistory[2]!.content).toBe('Message 2');

			actor.stop();
		});
	});

	describe('session creation', () => {
		describe('AC-1: createSessionActor tests', () => {
			test('should resolve with session data when socket emits session:created with correct requestId', async () => {
				const mockSocket = createMockSocket();
				let capturedRequestId: string | null = null;

				mockSocket.emit = (event: string, data: unknown) => {
					if (event === 'session:create') {
						const payload = data as { requestId: string; model?: string };
						capturedRequestId = payload.requestId;

						setTimeout(() => {
							const listeners = (mockSocket as any)._listeners?.['session:created'] || [];
							listeners.forEach((listener: Function) => {
								listener({
									type: 'session:created',
									payload: {
										requestId: capturedRequestId,
										id: 'new-session-123',
										model: 'haiku',
										createdAt: new Date().toISOString(),
									},
								});
							});
						}, 10);
					}
					return mockSocket;
				};

				const listeners: Record<string, Function[]> = {};
				mockSocket.on = (event?: string, handler?: Function) => {
					if (event && handler) {
						if (!listeners[event]) listeners[event] = [];
						listeners[event]!.push(handler);
						(mockSocket as any)._listeners = listeners;
					}
					return mockSocket;
				};

				mockSocket.off = (event?: string, handler?: Function) => {
					if (event && handler && listeners[event]) {
						listeners[event] = listeners[event]!.filter((h) => h !== handler);
					}
					return mockSocket;
				};

				const machine = chatMachine.provide({});

				const actor = createActor(machine, { input: { socket: mockSocket } });
				actor.start();

				actor.send({ type: 'WEBSOCKET_CONNECTED' });
				actor.send({ type: 'CREATE_SESSION' });

				await new Promise((resolve) => setTimeout(resolve, 100));

				const snapshot = actor.getSnapshot();
				expect(snapshot.value).toBe('idle');
				expect(snapshot.context.sessions).toHaveLength(1);
				expect(snapshot.context.sessions[0]!.id).toBe('new-session-123');
				expect(snapshot.context.currentSessionId).toBe('new-session-123');

				actor.stop();
			});

			test('should reject with error message when socket emits session:error with correct requestId', async () => {
				const mockSocket = createMockSocket();
				let capturedRequestId: string | null = null;

				mockSocket.emit = (event: string, data: unknown) => {
					if (event === 'session:create') {
						const payload = data as { requestId: string; model?: string };
						capturedRequestId = payload.requestId;

						setTimeout(() => {
							const listeners = (mockSocket as any)._listeners?.['session:error'] || [];
							listeners.forEach((listener: Function) => {
								listener({
									type: 'session:error',
									payload: {
										requestId: capturedRequestId,
										message: 'Database connection failed',
									},
								});
							});
						}, 10);
					}
					return mockSocket;
				};

				const listeners: Record<string, Function[]> = {};
				mockSocket.on = (event?: string, handler?: Function) => {
					if (event && handler) {
						if (!listeners[event]) listeners[event] = [];
						listeners[event]!.push(handler);
						(mockSocket as any)._listeners = listeners;
					}
					return mockSocket;
				};

				mockSocket.off = (event?: string, handler?: Function) => {
					if (event && handler && listeners[event]) {
						listeners[event] = listeners[event]!.filter((h) => h !== handler);
					}
					return mockSocket;
				};

				const machine = chatMachine.provide({});

				const actor = createActor(machine, { input: { socket: mockSocket } });
				actor.start();

				actor.send({ type: 'WEBSOCKET_CONNECTED' });
				actor.send({ type: 'CREATE_SESSION' });

				await new Promise((resolve) => setTimeout(resolve, 100));

				const snapshot = actor.getSnapshot();
				expect(snapshot.value).toBe('idle');
				expect(snapshot.context.error).toContain('Database connection failed');
				expect(snapshot.context.sessions).toHaveLength(0);

				actor.stop();
			});

			test('should reject with timeout error when no response within 30 seconds', async () => {
				const mockSocket = createMockSocket();

				mockSocket.emit = () => mockSocket;

				const listeners: Record<string, Function[]> = {};
				mockSocket.on = (event?: string, handler?: Function) => {
					if (event && handler) {
						if (!listeners[event]) listeners[event] = [];
						listeners[event]!.push(handler);
						(mockSocket as any)._listeners = listeners;
					}
					return mockSocket;
				};

				mockSocket.off = (event?: string, handler?: Function) => {
					if (event && handler && listeners[event]) {
						listeners[event] = listeners[event]!.filter((h) => h !== handler);
					}
					return mockSocket;
				};

				// Speed up the timeout for testing
				const machine = chatMachine.provide({
					actors: {
						createSession: fromPromise<Session, CreateSessionInput>(async ({ input }) => {
							const { socket, model } = input;
							const requestId = crypto.randomUUID();

							return new Promise<Session>((resolve, reject) => {
								const handleCreated = (data: unknown) => {
									const msg = data as any;
									if (msg.type === 'session:created' && msg.payload.requestId === requestId) {
										socket.off('session:created', handleCreated);
										socket.off('session:error', handleError);
										resolve({
											id: msg.payload.id,
											model: msg.payload.model,
											createdAt: msg.payload.createdAt,
										});
									}
								};

								const handleError = (data: unknown) => {
									const msg = data as any;
									if (msg.type === 'session:error' && msg.payload.requestId === requestId) {
										socket.off('session:created', handleCreated);
										socket.off('session:error', handleError);
										reject(new Error(msg.payload.message));
									}
								};

								socket.on('session:created', handleCreated);
								socket.on('session:error', handleError);

								socket.emit('session:create', { model, requestId });

								// Short timeout for testing
								setTimeout(() => {
									socket.off('session:created', handleCreated);
									socket.off('session:error', handleError);
									reject(new Error('Request timeout'));
								}, 100);
							});
						}),
					},
				});

				const actor = createActor(machine, { input: { socket: mockSocket } });
				actor.start();

				actor.send({ type: 'WEBSOCKET_CONNECTED' });
				actor.send({ type: 'CREATE_SESSION' });

				await new Promise((resolve) => setTimeout(resolve, 200));

				const snapshot = actor.getSnapshot();
				expect(snapshot.value).toBe('idle');
				expect(snapshot.context.error).toContain('Request timeout');

				actor.stop();
			});

			test('should ignore response with wrong requestId and continue waiting', async () => {
				const mockSocket = createMockSocket();
				let capturedRequestId: string | null = null;

				mockSocket.emit = (event: string, data: unknown) => {
					if (event === 'session:create') {
						const payload = data as { requestId: string; model?: string };
						capturedRequestId = payload.requestId;

						setTimeout(() => {
							const listeners = (mockSocket as any)._listeners?.['session:created'] || [];
							listeners.forEach((listener: Function) => {
								listener({
									type: 'session:created',
									payload: {
										requestId: 'wrong-request-id',
										id: 'wrong-session',
										model: 'haiku',
										createdAt: new Date().toISOString(),
									},
								});
							});

							setTimeout(() => {
								listeners.forEach((listener: Function) => {
									listener({
										type: 'session:created',
										payload: {
											requestId: capturedRequestId,
											id: 'correct-session-123',
											model: 'haiku',
											createdAt: new Date().toISOString(),
										},
									});
								});
							}, 10);
						}, 10);
					}
					return mockSocket;
				};

				const listeners: Record<string, Function[]> = {};
				mockSocket.on = (event?: string, handler?: Function) => {
					if (event && handler) {
						if (!listeners[event]) listeners[event] = [];
						listeners[event]!.push(handler);
						(mockSocket as any)._listeners = listeners;
					}
					return mockSocket;
				};

				mockSocket.off = (event?: string, handler?: Function) => {
					if (event && handler && listeners[event]) {
						listeners[event] = listeners[event]!.filter((h) => h !== handler);
					}
					return mockSocket;
				};

				const machine = chatMachine.provide({});

				const actor = createActor(machine, { input: { socket: mockSocket } });
				actor.start();

				actor.send({ type: 'WEBSOCKET_CONNECTED' });
				actor.send({ type: 'CREATE_SESSION' });

				await new Promise((resolve) => setTimeout(resolve, 100));

				const snapshot = actor.getSnapshot();
				expect(snapshot.value).toBe('idle');
				expect(snapshot.context.sessions).toHaveLength(1);
				expect(snapshot.context.sessions[0]!.id).toBe('correct-session-123');
				expect(snapshot.context.currentSessionId).toBe('correct-session-123');

				actor.stop();
			});

			test('should emit session:create with specified model parameter', async () => {
				const mockSocket = createMockSocket();
				let emittedModel: string | undefined;

				mockSocket.emit = (event: string, data: unknown) => {
					if (event === 'session:create') {
						const payload = data as { requestId: string; model?: string };
						emittedModel = payload.model;

						setTimeout(() => {
							const listeners = (mockSocket as any)._listeners?.['session:created'] || [];
							listeners.forEach((listener: Function) => {
								listener({
									type: 'session:created',
									payload: {
										requestId: payload.requestId,
										id: 'sonnet-session',
										model: payload.model || 'haiku',
										createdAt: new Date().toISOString(),
									},
								});
							});
						}, 10);
					}
					return mockSocket;
				};

				const listeners: Record<string, Function[]> = {};
				mockSocket.on = (event?: string, handler?: Function) => {
					if (event && handler) {
						if (!listeners[event]) listeners[event] = [];
						listeners[event]!.push(handler);
						(mockSocket as any)._listeners = listeners;
					}
					return mockSocket;
				};

				mockSocket.off = (event?: string, handler?: Function) => {
					if (event && handler && listeners[event]) {
						listeners[event] = listeners[event]!.filter((h) => h !== handler);
					}
					return mockSocket;
				};

				const machine = chatMachine.provide({});

				const actor = createActor(machine, { input: { socket: mockSocket } });
				actor.start();

				actor.send({ type: 'WEBSOCKET_CONNECTED' });
				actor.send({ type: 'SELECT_MODEL', model: 'sonnet' });
				actor.send({ type: 'CREATE_SESSION' });

				await new Promise((resolve) => setTimeout(resolve, 100));

				expect(emittedModel).toBe('sonnet');
				const snapshot = actor.getSnapshot();
				expect(snapshot.context.sessions[0]!.model).toBe('sonnet');

				actor.stop();
			});
		});

		describe('AC-2: state machine CREATE_SESSION event tests', () => {
			test('should transition from idle to creatingSession when CREATE_SESSION is sent', () => {
				const actor = createTestActor();

				actor.send({ type: 'WEBSOCKET_CONNECTED' });
				expect(actor.getSnapshot().value).toBe('idle');

				actor.send({ type: 'CREATE_SESSION' });
				expect(actor.getSnapshot().value).toBe('creatingSession');

				actor.stop();
			});

			test('should add new session to context.sessions on successful creation', async () => {
				const mockSocket = createMockSocket();

				mockSocket.emit = (event: string, data: unknown) => {
					if (event === 'session:create') {
						const payload = data as { requestId: string };
						setTimeout(() => {
							const listeners = (mockSocket as any)._listeners?.['session:created'] || [];
							listeners.forEach((listener: Function) => {
								listener({
									type: 'session:created',
									payload: {
										requestId: payload.requestId,
										id: 'new-session-456',
										model: 'haiku',
										createdAt: new Date().toISOString(),
									},
								});
							});
						}, 10);
					}
					return mockSocket;
				};

				const listeners: Record<string, Function[]> = {};
				mockSocket.on = (event?: string, handler?: Function) => {
					if (event && handler) {
						if (!listeners[event]) listeners[event] = [];
						listeners[event]!.push(handler);
						(mockSocket as any)._listeners = listeners;
					}
					return mockSocket;
				};

				mockSocket.off = (event?: string, handler?: Function) => {
					if (event && handler && listeners[event]) {
						listeners[event] = listeners[event]!.filter((h) => h !== handler);
					}
					return mockSocket;
				};

				const machine = chatMachine.provide({});

				const actor = createActor(machine, { input: { socket: mockSocket } });
				actor.start();

				actor.send({ type: 'WEBSOCKET_CONNECTED' });
				actor.send({
					type: 'SESSIONS_LOADED',
					sessions: [
						{ id: 'existing-session', model: 'haiku', createdAt: new Date().toISOString() },
					],
				});

				const beforeSessions = actor.getSnapshot().context.sessions.length;
				actor.send({ type: 'CREATE_SESSION' });

				await new Promise((resolve) => setTimeout(resolve, 100));

				const snapshot = actor.getSnapshot();
				expect(snapshot.context.sessions.length).toBe(beforeSessions + 1);
				expect(snapshot.context.sessions.some((s) => s.id === 'new-session-456')).toBe(true);

				actor.stop();
			});

			test('should set context.currentSessionId to new session ID on successful creation', async () => {
				const mockSocket = createMockSocket();

				mockSocket.emit = (event: string, data: unknown) => {
					if (event === 'session:create') {
						const payload = data as { requestId: string };
						setTimeout(() => {
							const listeners = (mockSocket as any)._listeners?.['session:created'] || [];
							listeners.forEach((listener: Function) => {
								listener({
									type: 'session:created',
									payload: {
										requestId: payload.requestId,
										id: 'newly-created-session',
										model: 'haiku',
										createdAt: new Date().toISOString(),
									},
								});
							});
						}, 10);
					}
					return mockSocket;
				};

				const listeners: Record<string, Function[]> = {};
				mockSocket.on = (event?: string, handler?: Function) => {
					if (event && handler) {
						if (!listeners[event]) listeners[event] = [];
						listeners[event]!.push(handler);
						(mockSocket as any)._listeners = listeners;
					}
					return mockSocket;
				};

				mockSocket.off = (event?: string, handler?: Function) => {
					if (event && handler && listeners[event]) {
						listeners[event] = listeners[event]!.filter((h) => h !== handler);
					}
					return mockSocket;
				};

				const machine = chatMachine.provide({});

				const actor = createActor(machine, { input: { socket: mockSocket } });
				actor.start();

				actor.send({ type: 'WEBSOCKET_CONNECTED' });
				actor.send({ type: 'CREATE_SESSION' });

				await new Promise((resolve) => setTimeout(resolve, 100));

				expect(actor.getSnapshot().context.currentSessionId).toBe('newly-created-session');

				actor.stop();
			});

			test('should store error in context.error on failed creation', async () => {
				const mockSocket = createMockSocket();

				mockSocket.emit = (event: string, data: unknown) => {
					if (event === 'session:create') {
						const payload = data as { requestId: string };
						setTimeout(() => {
							const listeners = (mockSocket as any)._listeners?.['session:error'] || [];
							listeners.forEach((listener: Function) => {
								listener({
									type: 'session:error',
									payload: {
										requestId: payload.requestId,
										message: 'Server is overloaded',
									},
								});
							});
						}, 10);
					}
					return mockSocket;
				};

				const listeners: Record<string, Function[]> = {};
				mockSocket.on = (event?: string, handler?: Function) => {
					if (event && handler) {
						if (!listeners[event]) listeners[event] = [];
						listeners[event]!.push(handler);
						(mockSocket as any)._listeners = listeners;
					}
					return mockSocket;
				};

				mockSocket.off = (event?: string, handler?: Function) => {
					if (event && handler && listeners[event]) {
						listeners[event] = listeners[event]!.filter((h) => h !== handler);
					}
					return mockSocket;
				};

				const machine = chatMachine.provide({});

				const actor = createActor(machine, { input: { socket: mockSocket } });
				actor.start();

				actor.send({ type: 'WEBSOCKET_CONNECTED' });
				actor.send({ type: 'CREATE_SESSION' });

				await new Promise((resolve) => setTimeout(resolve, 100));

				expect(actor.getSnapshot().context.error).toContain('Server is overloaded');

				actor.stop();
			});

			test('should return to idle state after successful creation', async () => {
				const mockSocket = createMockSocket();

				mockSocket.emit = (event: string, data: unknown) => {
					if (event === 'session:create') {
						const payload = data as { requestId: string };
						setTimeout(() => {
							const listeners = (mockSocket as any)._listeners?.['session:created'] || [];
							listeners.forEach((listener: Function) => {
								listener({
									type: 'session:created',
									payload: {
										requestId: payload.requestId,
										id: 'test-session',
										model: 'haiku',
										createdAt: new Date().toISOString(),
									},
								});
							});
						}, 10);
					}
					return mockSocket;
				};

				const listeners: Record<string, Function[]> = {};
				mockSocket.on = (event?: string, handler?: Function) => {
					if (event && handler) {
						if (!listeners[event]) listeners[event] = [];
						listeners[event]!.push(handler);
						(mockSocket as any)._listeners = listeners;
					}
					return mockSocket;
				};

				mockSocket.off = (event?: string, handler?: Function) => {
					if (event && handler && listeners[event]) {
						listeners[event] = listeners[event]!.filter((h) => h !== handler);
					}
					return mockSocket;
				};

				const machine = chatMachine.provide({});

				const actor = createActor(machine, { input: { socket: mockSocket } });
				actor.start();

				actor.send({ type: 'WEBSOCKET_CONNECTED' });
				actor.send({ type: 'CREATE_SESSION' });

				await new Promise((resolve) => setTimeout(resolve, 100));

				expect(actor.getSnapshot().value).toBe('idle');

				actor.stop();
			});

			test('should return to idle state after failed creation', async () => {
				const mockSocket = createMockSocket();

				mockSocket.emit = (event: string, data: unknown) => {
					if (event === 'session:create') {
						const payload = data as { requestId: string };
						setTimeout(() => {
							const listeners = (mockSocket as any)._listeners?.['session:error'] || [];
							listeners.forEach((listener: Function) => {
								listener({
									type: 'session:error',
									payload: {
										requestId: payload.requestId,
										message: 'Creation failed',
									},
								});
							});
						}, 10);
					}
					return mockSocket;
				};

				const listeners: Record<string, Function[]> = {};
				mockSocket.on = (event?: string, handler?: Function) => {
					if (event && handler) {
						if (!listeners[event]) listeners[event] = [];
						listeners[event]!.push(handler);
						(mockSocket as any)._listeners = listeners;
					}
					return mockSocket;
				};

				mockSocket.off = (event?: string, handler?: Function) => {
					if (event && handler && listeners[event]) {
						listeners[event] = listeners[event]!.filter((h) => h !== handler);
					}
					return mockSocket;
				};

				const machine = chatMachine.provide({});

				const actor = createActor(machine, { input: { socket: mockSocket } });
				actor.start();

				actor.send({ type: 'WEBSOCKET_CONNECTED' });
				actor.send({ type: 'CREATE_SESSION' });

				await new Promise((resolve) => setTimeout(resolve, 100));

				expect(actor.getSnapshot().value).toBe('idle');

				actor.stop();
			});
		});

		describe('AC-3: additional error scenarios', () => {
			test.skip('should throw error immediately when socket is null', async () => {
				const machine = chatMachine.provide({});

				const actor = createActor(machine, { input: { socket: null as any } });
				actor.start();

				actor.send({ type: 'WEBSOCKET_CONNECTED' });
				actor.send({ type: 'CREATE_SESSION' });

				await new Promise((resolve) => setTimeout(resolve, 100));

				const snapshot = actor.getSnapshot();
				expect(snapshot.value).toBe('idle');
				expect(snapshot.context.error).toBeTruthy();

				actor.stop();
			});

			test('should handle malformed server response gracefully', async () => {
				const mockSocket = createMockSocket();
				let capturedRequestId: string | null = null;

				mockSocket.emit = (event: string, data: unknown) => {
					if (event === 'session:create') {
						const payload = data as { requestId: string };
						capturedRequestId = payload.requestId;

						setTimeout(() => {
							const listeners = (mockSocket as any)._listeners?.['session:created'] || [];
							// First send malformed response — should be ignored
							listeners.forEach((listener: Function) => {
								listener({ type: 'session:created', payload: {} });
							});

							// Then send valid response
							setTimeout(() => {
								listeners.forEach((listener: Function) => {
									listener({
										type: 'session:created',
										payload: {
											requestId: capturedRequestId,
											id: 'recovery-session',
											model: 'haiku',
											createdAt: new Date().toISOString(),
										},
									});
								});
							}, 10);
						}, 10);
					}
					return mockSocket;
				};

				const listeners: Record<string, Function[]> = {};
				mockSocket.on = (event?: string, handler?: Function) => {
					if (event && handler) {
						if (!listeners[event]) listeners[event] = [];
						listeners[event]!.push(handler);
						(mockSocket as any)._listeners = listeners;
					}
					return mockSocket;
				};

				mockSocket.off = (event?: string, handler?: Function) => {
					if (event && handler && listeners[event]) {
						listeners[event] = listeners[event]!.filter((h) => h !== handler);
					}
					return mockSocket;
				};

				const machine = chatMachine.provide({});

				const actor = createActor(machine, { input: { socket: mockSocket } });
				actor.start();

				actor.send({ type: 'WEBSOCKET_CONNECTED' });
				actor.send({ type: 'CREATE_SESSION' });

				await new Promise((resolve) => setTimeout(resolve, 100));

				const snapshot = actor.getSnapshot();
				expect(snapshot.value).toBe('idle');
				expect(snapshot.context.sessions).toHaveLength(1);
				expect(snapshot.context.sessions[0]!.id).toBe('recovery-session');

				actor.stop();
			});

			test('should handle multiple rapid session creation requests with unique requestIds', async () => {
				const mockSocket = createMockSocket();
				const emittedRequestIds: string[] = [];

				mockSocket.emit = (event: string, data: unknown) => {
					if (event === 'session:create') {
						const payload = data as { requestId: string };
						emittedRequestIds.push(payload.requestId);

						setTimeout(() => {
							const currentListeners =
								(mockSocket as any)._listeners?.['session:created'] || [];
							const listenersCopy = [...currentListeners];
							listenersCopy.forEach((listener: Function) => {
								listener({
									type: 'session:created',
									payload: {
										requestId: payload.requestId,
										id: `session-${emittedRequestIds.length}`,
										model: 'haiku',
										createdAt: new Date().toISOString(),
									},
								});
							});
						}, 10);
					}
					return mockSocket;
				};

				const listeners: Record<string, Function[]> = {};
				mockSocket.on = (event?: string, handler?: Function) => {
					if (event && handler) {
						if (!listeners[event]) listeners[event] = [];
						listeners[event]!.push(handler);
						(mockSocket as any)._listeners = listeners;
					}
					return mockSocket;
				};

				mockSocket.off = (event?: string, handler?: Function) => {
					if (event && handler && listeners[event]) {
						listeners[event] = listeners[event]!.filter((h) => h !== handler);
					}
					return mockSocket;
				};

				const machine = chatMachine.provide({});

				const actor = createActor(machine, { input: { socket: mockSocket } });
				actor.start();

				actor.send({ type: 'WEBSOCKET_CONNECTED' });

				actor.send({ type: 'CREATE_SESSION' });
				await new Promise((resolve) => setTimeout(resolve, 150));

				actor.send({ type: 'CREATE_SESSION' });
				await new Promise((resolve) => setTimeout(resolve, 150));

				actor.send({ type: 'CREATE_SESSION' });
				await new Promise((resolve) => setTimeout(resolve, 150));

				expect(emittedRequestIds.length).toBe(3);
				const uniqueIds = new Set(emittedRequestIds);
				expect(uniqueIds.size).toBe(3);

				expect(actor.getSnapshot().context.sessions.length).toBe(3);

				actor.stop();
			});
		});
	});
});
