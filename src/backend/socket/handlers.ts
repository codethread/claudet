import type { Server, Socket } from 'socket.io';
import { sendMessage, createSession, listSessions } from '../claude';
import type { ClaudeModel } from '../claude';
import { ChatSendSchema, SessionListSchema, SessionCreateSchema } from '../../shared/messages';

/**
 * Setup Socket.IO event handlers
 */
export function setupSocketHandlers(io: Server) {
	io.on('connection', (socket: Socket) => {
		console.log('✅ Socket.IO client connected:', socket.id);

		const sessions = listSessions();

		// Send connection confirmation with list of sessions
		socket.emit('connection', {
			type: 'connection',
			payload: {
				status: 'connected',
				sessions: sessions.map((s) => ({
					id: s.id,
					model: s.model,
					createdAt: s.createdAt.toISOString(),
				})),
			},
		});

		// Handle chat:send
		socket.on('chat:send', async (data) => {
			try {
				const validated = ChatSendSchema.parse({ type: 'chat:send', payload: data });
				const { message, sessionId, requestId } = validated.payload;

				console.log(`📨 chat:send (requestId: ${requestId})`);

				const response = await sendMessage(sessionId, message);

				socket.emit('chat:response', {
					type: 'chat:response',
					payload: { response, sessionId, requestId },
				});
			} catch (error) {
				console.error('Error handling chat:send:', error);

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
				const validated = SessionListSchema.parse({ type: 'session:list', payload: data });
				const { requestId } = validated.payload;

				const sessions = listSessions();

				socket.emit('session:list', {
					type: 'session:list',
					payload: {
						sessions: sessions.map((s) => ({
							id: s.id,
							model: s.model,
							createdAt: s.createdAt.toISOString(),
						})),
						requestId,
					},
				});
			} catch (error) {
				console.error('Error handling session:list:', error);

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
				const validated = SessionCreateSchema.parse({ type: 'session:create', payload: data });
				const { model, requestId } = validated.payload;

				const validModel: ClaudeModel = model === 'sonnet' ? 'sonnet' : 'haiku';
				const session = createSession(validModel);

				console.log(`🤖 New Claude session created: ${session.id} (model: ${session.model})`);

				socket.emit('session:created', {
					type: 'session:created',
					payload: {
						id: session.id,
						model: session.model,
						createdAt: session.createdAt.toISOString(),
						requestId,
					},
				});
			} catch (error) {
				console.error('Error handling session:create:', error);

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
		});
	});
}
