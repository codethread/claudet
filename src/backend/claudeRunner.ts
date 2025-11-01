import { z } from 'zod';
import { assign, fromPromise, setup } from 'xstate';
import type {
	ClaudeCodeService,
	ClaudeModel,
	ClaudeProcessHandle,
} from './services/ClaudeCodeService';
import type { Socket } from 'socket.io';

// Zod Schemas for runtime validation
export const ClaudeResponseSchema = z.object({
	response: z.string(),
	logs: z.array(z.string()),
});

export const ClaudeMessageDataSchema = z.object({
	type: z.string(),
	subtype: z.string().optional(),
	session_id: z.string().optional(),
	message: z
		.object({
			content: z
				.array(
					z.object({
						text: z.string().optional(),
					}),
				)
				.optional(),
		})
		.optional(),
	result: z.string().optional(),
	is_error: z.boolean().optional(),
});

// TypeScript types inferred from Zod schemas
export type ClaudeResponse = z.infer<typeof ClaudeResponseSchema>;
export type ClaudeMessageData = z.infer<typeof ClaudeMessageDataSchema>;

// Machine context
export interface ClaudeRunnerContext {
	sessionId?: string; // Optional session ID for tracking multiple sessions
	model: ClaudeModel; // The Claude model to use
	processHandle: ClaudeProcessHandle | null;
	pendingRequests: Map<
		string,
		{
			resolve: (value: ClaudeResponse) => void;
			reject: (error: Error) => void;
			buffer: string;
			sessionId?: string;
			logs: string[];
		}
	>;
	sessionLogs: Map<string, string[]>;
	logClients: Set<Socket>;
	error: string | null;
}

// Machine events
export type ClaudeRunnerEvent =
	| { type: 'START_PROCESS' }
	| { type: 'PROCESS_STARTED'; handle: ClaudeProcessHandle }
	| { type: 'PROCESS_ERROR'; error: string }
	| { type: 'SEND_MESSAGE'; message: string; messageId: string }
	| { type: 'MESSAGE_SENT' }
	| { type: 'OUTPUT_LINE'; line: string }
	| { type: 'REGISTER_WS_CLIENT'; client: Socket }
	| { type: 'UNREGISTER_WS_CLIENT'; client: Socket }
	| { type: 'STOP' };

// Factory function for creating the process starter actor
// This allows dependency injection of the ClaudeCodeService
const createStartClaudeProcessActor = (service: ClaudeCodeService) =>
	fromPromise(async ({ input }: { input: { model: ClaudeModel } }) => {
		return service.spawn(input.model);
	});

/**
 * Factory function to create the Claude runner machine with dependency injection
 * @param service - The ClaudeCodeService implementation (real or fake)
 * @param sessionId - Optional session ID for tracking
 * @param model - The Claude model to use
 */
export function createClaudeRunnerMachine(
	service: ClaudeCodeService,
	sessionId?: string,
	model: ClaudeModel = 'haiku',
) {
	return setup({
		types: {
			context: {} as ClaudeRunnerContext,
			events: {} as ClaudeRunnerEvent,
		},
		actors: {
			startProcess: createStartClaudeProcessActor(service),
		},
	}).createMachine({
		id: 'claudeRunner',
		initial: 'idle',
		context: {
			sessionId,
			model,
			processHandle: null,
			pendingRequests: new Map(),
			sessionLogs: new Map(),
			logClients: new Set(),
			error: null,
		},
		states: {
			idle: {
				on: {
					START_PROCESS: {
						target: 'starting',
					},
				},
			},
			starting: {
				invoke: {
					id: 'startProcess',
					src: 'startProcess',
					input: ({ context }) => ({ model: context.model }),
					onDone: {
						target: 'running',
						actions: assign({
							processHandle: ({ event }) => {
								console.log('✅ Claude process started successfully');
								return event.output;
							},
							error: null,
						}),
					},
					onError: {
						target: 'error',
						actions: assign({
							error: ({ event }) => {
								const errorMsg = String(event.error);
								console.error('❌ Claude process failed to start:', errorMsg);
								return errorMsg;
							},
						}),
					},
				},
			},
			running: {
				on: {
					SEND_MESSAGE: {
						actions: ({ context, event }) => {
							if (!context.processHandle) return;

							const request = {
								resolve: (_value: ClaudeResponse) => {},
								reject: (_error: Error) => {},
								buffer: '',
								logs: [] as string[],
							};

							context.pendingRequests.set(event.messageId, request);

							// Send message in stream-json format
							const input = `${JSON.stringify({
								type: 'user',
								message: {
									role: 'user',
									content: event.message,
								},
							})}\n`;

							// Use Bun's FileSink write method
							context.processHandle.stdin.write(input);
						},
					},
					OUTPUT_LINE: {
						actions: ({ context, event }) => {
							const line = event.line;

							// Broadcast to Socket.IO clients with session ID
							for (const client of context.logClients) {
								try {
									// Socket.IO: emit as JSON object (no need to stringify)
									// For backward compatibility with WebSocket clients, also support .send()
									if (typeof client.emit === 'function') {
										// Socket.IO client
										client.emit('log', {
											type: 'log',
											sessionId: context.sessionId,
											data: line,
										});
									} else if (typeof client.send === 'function') {
										// Native WebSocket client (backward compatibility)
										const message = JSON.stringify({
											type: 'log',
											sessionId: context.sessionId,
											data: line,
										});
										client.send(message);
									}
								} catch (e) {
									console.error('Failed to send to client:', e);
									context.logClients.delete(client);
								}
							}

							try {
								const data = ClaudeMessageDataSchema.parse(JSON.parse(line));

								// Store logs for this session
								if (data.session_id) {
									if (!context.sessionLogs.has(data.session_id)) {
										context.sessionLogs.set(data.session_id, []);
									}
									context.sessionLogs.get(data.session_id)!.push(line);
								}

								// Handle assistant message response
								if (data.type === 'assistant' && data.session_id) {
									const requests = Array.from(context.pendingRequests.values());
									const pending = requests.find((r) => r.sessionId === data.session_id);

									if (pending && data.message?.content?.[0]?.text) {
										pending.buffer += data.message.content[0].text;
									}
								}
								// Handle result message (final)
								else if (data.type === 'result' && data.session_id) {
									const requests = Array.from(context.pendingRequests.entries());
									const entry = requests.find(([_, r]) => r.sessionId === data.session_id);

									if (entry) {
										const [messageId, pending] = entry;

										// Attach logs from this session
										const logs = context.sessionLogs.get(data.session_id) || [];
										pending.logs = logs;

										if (data.is_error) {
											pending.reject(new Error(data.result || 'Unknown error'));
										} else {
											pending.resolve({
												response: pending.buffer || data.result || '',
												logs: pending.logs,
											});
										}

										context.pendingRequests.delete(messageId);
										// Clean up session logs
										context.sessionLogs.delete(data.session_id);
									}
								}
								// Store session ID from init message
								else if (data.type === 'system' && data.subtype === 'init' && data.session_id) {
									// Find the most recent pending request without a session ID
									for (const pending of context.pendingRequests.values()) {
										if (!pending.sessionId) {
											pending.sessionId = data.session_id;
											break;
										}
									}
								}
							} catch (e) {
								console.error('Failed to parse Claude output:', line, e);
							}
						},
					},
					REGISTER_WS_CLIENT: {
						actions: assign({
							logClients: ({ context, event }) => {
								context.logClients.add(event.client);
								return context.logClients;
							},
						}),
					},
					UNREGISTER_WS_CLIENT: {
						actions: assign({
							logClients: ({ context, event }) => {
								context.logClients.delete(event.client);
								return context.logClients;
							},
						}),
					},
					STOP: {
						target: 'stopped',
					},
					PROCESS_ERROR: {
						target: 'error',
						actions: assign({
							error: ({ event }) => event.error,
						}),
					},
				},
			},
			error: {
				on: {
					START_PROCESS: {
						target: 'starting',
					},
				},
			},
			stopped: {
				type: 'final',
			},
		},
	});
}

// Type for the created machine
export type ClaudeRunnerMachine = ReturnType<typeof createClaudeRunnerMachine>;

// Default machine using RealClaudeCodeService (for backwards compatibility)
// This is used in production when not explicitly injecting a service
import { RealClaudeCodeService } from './services/RealClaudeCodeService';
export const claudeRunnerMachine = createClaudeRunnerMachine(new RealClaudeCodeService());
