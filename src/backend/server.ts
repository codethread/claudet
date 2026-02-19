import { homedir } from 'node:os';
import { join } from 'node:path';
import { getLocalIP } from './utils/network';
import {
	createSession,
	getSession,
	listSessions,
	sendMessage,
	setSessionPermissionMode,
} from './claude';
import { loadSettings, saveSettings, validateBaseDir } from './settings';
import { discoverProjects } from './projects';

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

			'/api/settings': {
				OPTIONS(_req) {
					return new Response(null, { status: 204, headers: CORS_HEADERS });
				},
				GET(_req) {
					const settings = loadSettings();
					return corsJson(settings);
				},
				async POST(req) {
					try {
						const body = (await req.json().catch(() => ({}))) as { baseDir?: unknown };
						const baseDir = validateBaseDir(body.baseDir);
						const settings = { baseDir };
						saveSettings(settings);
						return corsJson(settings);
					} catch (error) {
						return corsJson(
							{ error: error instanceof Error ? error.message : 'Invalid request' },
							400,
						);
					}
				},
			},

			'/api/projects': {
				OPTIONS(_req) {
					return new Response(null, { status: 204, headers: CORS_HEADERS });
				},
				GET(_req) {
					const { baseDir } = loadSettings();
					if (!baseDir) return corsJson({ projects: [] });
					const basePath = join(homedir(), baseDir);
					const projects = discoverProjects(basePath);
					return corsJson({ projects });
				},
			},

			'/api/sessions': {
				OPTIONS(_req) {
					return new Response(null, { status: 204, headers: CORS_HEADERS });
				},
				GET(req) {
					const url = new URL(req.url);
					const projectPath = url.searchParams.get('projectPath') ?? undefined;
					const sessions = listSessions(projectPath).map((s) => ({
						id: s.id,
						model: s.model,
						createdAt: s.createdAt.toISOString(),
						projectPath: s.projectPath,
						permissionMode: s.permissionMode,
					}));
					return corsJson({ sessions });
				},
				async POST(req) {
					const body = (await req.json().catch(() => ({}))) as {
						model?: string;
						projectPath?: unknown;
						permissionMode?: unknown;
					};
					if (!body.projectPath || typeof body.projectPath !== 'string') {
						return corsJson({ error: 'projectPath is required' }, 400);
					}
					const model = body.model === 'sonnet' ? 'sonnet' : 'haiku';
					const permissionMode =
						body.permissionMode === 'dangerouslySkipPermissions'
							? ('dangerouslySkipPermissions' as const)
							: ('allowEdits' as const);
					const session = createSession(model, body.projectPath, permissionMode);
					return corsJson({
						id: session.id,
						model: session.model,
						createdAt: session.createdAt.toISOString(),
						projectPath: session.projectPath,
						permissionMode: session.permissionMode,
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

		async fetch(req) {
			if (req.method === 'OPTIONS') {
				return new Response(null, { status: 204, headers: CORS_HEADERS });
			}

			const url = new URL(req.url);

			// GET /api/sessions/:id/messages
			const messagesMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/);
			if (messagesMatch?.[1] && req.method === 'GET') {
				const session = getSession(messagesMatch[1]);
				if (!session) return corsJson({ error: 'Session not found' }, 404);
				return corsJson({ messages: session.messages });
			}

			// PATCH /api/sessions/:id
			const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
			if (sessionMatch?.[1] && req.method === 'PATCH') {
				const body = (await req.json().catch(() => ({}))) as { permissionMode?: unknown };
				const mode =
					body.permissionMode === 'dangerouslySkipPermissions'
						? ('dangerouslySkipPermissions' as const)
						: ('allowEdits' as const);
				const session = setSessionPermissionMode(sessionMatch[1], mode);
				if (!session) return corsJson({ error: 'Session not found' }, 404);
				return corsJson({
					id: session.id,
					model: session.model,
					createdAt: session.createdAt.toISOString(),
					projectPath: session.projectPath,
					permissionMode: session.permissionMode,
				});
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
