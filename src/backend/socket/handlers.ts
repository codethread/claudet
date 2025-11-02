import type { Server, Socket } from 'socket.io';
import type { SessionManager } from '../SessionManager';
import type { ClaudeResponse } from '../claudeRunner';
import { ChatSendSchema, SessionListSchema, SessionCreateSchema } from '../../shared/messages';
import type { ClaudeModel } from '../services/ClaudeCodeService';
import { readSessionOutput } from '../session/sessionOutputReader';

/**
 * Send a message to a specific Claude session and get the response
 */
async function sendToClaude(
	sessionManager: SessionManager,
	sessionId: string,
	message: string,
): Promise<ClaudeResponse> {
	const session = sessionManager.getSession(sessionId);
	if (!session) {
		throw new Error(`Session ${sessionId} not found`);
	}

	const messageId = crypto.randomUUID();

	return new Promise((resolve, reject) => {
		// Send the message first so the state machine creates the pending request
		session.actor.send({
			type: 'SEND_MESSAGE',
			message,
			messageId,
		});

		// Poll for the request to be created (XState actions run synchronously)
		const maxAttempts = 10;
		let attempts = 0;

		const checkRequest = () => {
			const context = session.actor.getSnapshot().context;
			const request = context.pendingRequests.get(messageId);

			if (request) {
				request.resolve = resolve;
				request.reject = reject;
			} else if (attempts < maxAttempts) {
				attempts++;
				setTimeout(checkRequest, 10);
			} else {
				reject(
					new Error('Failed to create request - pending request not found after multiple attempts'),
				);
			}
		};

		// Start checking immediately
		checkRequest();

		// Set a timeout
		setTimeout(() => {
			const currentContext = session.actor.getSnapshot().context;
			if (currentContext.pendingRequests.has(messageId)) {
				currentContext.pendingRequests.delete(messageId);
				reject(new Error('Request timeout'));
			}
		}, 60000); // 60 second timeout
	});
}

/**
 * Setup Socket.IO event handlers
 */
export function setupSocketHandlers(
	io: Server,
	sessionManager: SessionManager,
	sessionReaders: Map<string, boolean>,
) {
	io.on('connection', (socket: Socket) => {
		console.log('✅ Socket.IO client connected:', socket.id);

		// Register this client with all sessions
		const sessions = sessionManager.listSessions();
		for (const { id } of sessions) {
			const session = sessionManager.getSession(id);
			if (session) {
				session.actor.send({ type: 'REGISTER_WS_CLIENT', client: socket });
			}
		}

		// Send connection confirmation with list of sessions
		socket.emit('connection', {
			type: 'connection',
			payload: {
				status: 'connected',
				sessions: sessions.map((s) => ({
					id: s.id,
					model: s.model,
					createdAt: s.createdAt,
				})),
			},
		});

		// Handle chat:send
		socket.on('chat:send', async (data) => {
			try {
				// Validate the incoming message
				const validated = ChatSendSchema.parse({ type: 'chat:send', payload: data });
				const { message, sessionId, requestId } = validated.payload;

				console.log(`📨 Socket.IO received chat:send (requestId: ${requestId})`);

				// Send message to Claude
				const { response, logs } = await sendToClaude(sessionManager, sessionId, message);

				// Emit response with requestId correlation
				socket.emit('chat:response', {
					type: 'chat:response',
					payload: {
						response,
						logs: logs || [],
						sessionId,
						requestId,
					},
				});
			} catch (error) {
				console.error('Error handling chat:send:', error);

				// Extract requestId if possible
				const requestId =
					typeof data === 'object' && data && 'requestId' in data
						? String(data.requestId)
						: crypto.randomUUID();

				socket.emit('chat:error', {
					type: 'chat:error',
					payload: {
						message: error instanceof Error ? error.message : 'Unknown error',
						requestId,
					},
				});
			}
		});

		// Handle session:list
		socket.on('session:list', async (data) => {
			try {
				// Validate the incoming message
				const validated = SessionListSchema.parse({ type: 'session:list', payload: data });
				const { requestId } = validated.payload;

				console.log(`📨 Socket.IO received session:list (requestId: ${requestId})`);

				const sessions = sessionManager.listSessions();

				// Emit response with requestId correlation
				socket.emit('session:list', {
					type: 'session:list',
					payload: {
						sessions: sessions.map((s) => ({
							id: s.id,
							model: s.model,
							createdAt: s.createdAt,
						})),
						requestId,
					},
				});
			} catch (error) {
				console.error('Error handling session:list:', error);

				// Extract requestId if possible
				const requestId =
					typeof data === 'object' && data && 'requestId' in data
						? String(data.requestId)
						: crypto.randomUUID();

				socket.emit('session:error', {
					type: 'session:error',
					payload: {
						message: error instanceof Error ? error.message : 'Unknown error',
						requestId,
					},
				});
			}
		});

		// Handle session:create
		socket.on('session:create', async (data) => {
			try {
				// Validate the incoming message
				const validated = SessionCreateSchema.parse({ type: 'session:create', payload: data });
				const { model, requestId } = validated.payload;

				console.log(`📨 Socket.IO received session:create (requestId: ${requestId})`);

				// Validate model is a valid ClaudeModel
				let validModel: ClaudeModel | undefined;
				if (model) {
					if (model !== 'haiku' && model !== 'sonnet') {
						throw new Error(`Invalid model: ${model}. Must be 'haiku' or 'sonnet'`);
					}
					validModel = model as ClaudeModel;
				}

				const session = sessionManager.createSession(validModel);
				session.actor.send({ type: 'START_PROCESS' });
				console.log(`🤖 New Claude session created: ${session.id} (model: ${session.model})`);

				// Start reading output for this new session
				setTimeout(() => {
					readSessionOutput(sessionManager, sessionReaders, session.id);
				}, 100);

				// Emit response with requestId correlation
				socket.emit('session:created', {
					type: 'session:created',
					payload: {
						id: session.id,
						model: session.model,
						createdAt: session.createdAt,
						requestId,
					},
				});
			} catch (error) {
				console.error('Error handling session:create:', error);

				// Extract requestId if possible
				const requestId =
					typeof data === 'object' && data && 'requestId' in data
						? String(data.requestId)
						: crypto.randomUUID();

				socket.emit('session:error', {
					type: 'session:error',
					payload: {
						message: error instanceof Error ? error.message : 'Unknown error',
						requestId,
					},
				});
			}
		});

		// Handle disconnection
		socket.on('disconnect', (reason) => {
			console.log('❌ Socket.IO client disconnected:', socket.id, reason);

			// Unregister from all sessions
			const sessions = sessionManager.listSessions();
			for (const { id } of sessions) {
				const session = sessionManager.getSession(id);
				if (session) {
					session.actor.send({ type: 'UNREGISTER_WS_CLIENT', client: socket });
				}
			}
		});
	});
}
