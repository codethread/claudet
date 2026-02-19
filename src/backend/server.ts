import { getLocalIP } from './utils/network';
import { createSession, listSessions, sendMessage } from './claude';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

function corsJson(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: CORS_HEADERS });
}

export function startServer() {
	const server = Bun.serve({
		hostname: '0.0.0.0',
		port: 3001,

		routes: {
			'/api/models': {
				OPTIONS(_req) {
					return new Response(null, { status: 204, headers: CORS_HEADERS });
				},
				GET(_req) {
					return corsJson({
						models: ['haiku', 'sonnet'],
						default: process.env.NODE_ENV === 'production' ? 'sonnet' : 'haiku',
					});
				},
			},

			'/api/sessions': {
				OPTIONS(_req) {
					return new Response(null, { status: 204, headers: CORS_HEADERS });
				},
				GET(_req) {
					const sessions = listSessions().map((s) => ({
						id: s.id,
						model: s.model,
						createdAt: s.createdAt.toISOString(),
					}));
					return corsJson({ sessions });
				},
				async POST(_req) {
					const body = (await _req.json().catch(() => ({}))) as { model?: string };
					const model = body.model === 'sonnet' ? 'sonnet' : 'haiku';
					const session = createSession(model);
					return corsJson({
						id: session.id,
						model: session.model,
						createdAt: session.createdAt.toISOString(),
					});
				},
			},

			'/api/chat': {
				OPTIONS(_req) {
					return new Response(null, { status: 204, headers: CORS_HEADERS });
				},
				async POST(req) {
					try {
						const body = (await req.json()) as { message?: string; sessionId?: string };
						const { message, sessionId } = body;

						if (!message || typeof message !== 'string') {
							return corsJson({ error: 'message is required' }, 400);
						}
						if (!sessionId || typeof sessionId !== 'string') {
							return corsJson({ error: 'sessionId is required' }, 400);
						}

						const response = await sendMessage(sessionId, message);
						return corsJson({ response });
					} catch (error) {
						console.error('Error in /api/chat:', error);
						return corsJson(
							{ error: error instanceof Error ? error.message : 'Unknown error' },
							500,
						);
					}
				},
			},
		},

		fetch(req) {
			if (req.method === 'OPTIONS') {
				return new Response(null, { status: 204, headers: CORS_HEADERS });
			}
			return new Response('Not found', { status: 404, headers: CORS_HEADERS });
		},
	});

	const localIP = getLocalIP();

	console.log(`\n${'='.repeat(50)}`);
	console.log('🚀 Claudet API server running!');
	console.log('='.repeat(50));
	console.log(`\n📍 Local:   http://localhost:${server.port}`);
	console.log(`📱 Network: http://${localIP}:${server.port}`);
	console.log('\n📲 Start the Expo app in mobile/ and point it to the above URL');
	console.log(`${'='.repeat(50)}\n`);

	return server;
}
