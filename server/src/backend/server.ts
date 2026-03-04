import express from 'express';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getLocalIP } from './utils/network';
import {
	createSession,
	deleteSession,
	getSession,
	listSessions,
	renameSession,
	sendMessage,
	setSessionPermissionMode,
} from './claude';
import { excludeProject, loadSettings, saveSettings, validateBaseDir } from './settings';
import { discoverProjects } from './projects';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

export function startServer() {
	const app = express();
	app.use(express.json());

	// Apply CORS headers and handle OPTIONS preflight on all routes
	app.use((_req, res, next) => {
		for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
		if (_req.method === 'OPTIONS') return res.status(204).end();
		next();
	});

	app.get('/health', (_req, res) => res.json({ ok: true }));

	const SUPPORTED_MODELS = ['haiku', 'sonnet', 'opus'] as const;
	const DEFAULT_MODEL = process.env.NODE_ENV === 'production' ? 'sonnet' : 'haiku';

	app.get('/api/models', (_req, res) => {
		res.json({ models: SUPPORTED_MODELS, default: DEFAULT_MODEL });
	});

	app.get('/api/settings', (_req, res) => {
		res.json(loadSettings());
	});

	app.post('/api/settings', (req, res) => {
		try {
			const body = req.body as { baseDir?: unknown };
			const baseDir = validateBaseDir(body.baseDir);
			const current = loadSettings();
			const settings = { baseDir, excludedProjects: current.excludedProjects };
			saveSettings(settings);
			res.json({ baseDir });
		} catch (error) {
			res
				.status(400)
				.json({ error: error instanceof Error ? error.message : 'Invalid request' });
		}
	});

	app.get('/api/projects', (_req, res) => {
		const { baseDir, excludedProjects } = loadSettings();
		if (!baseDir) return res.json({ projects: [] });
		const basePath = join(homedir(), baseDir);
		const projects = discoverProjects(basePath, excludedProjects);
		return res.json({ projects });
	});

	app.delete('/api/projects', (req, res) => {
		const body = req.body as { id?: unknown };
		if (!body.id || typeof body.id !== 'string') {
			return res.status(400).json({ error: 'id is required' });
		}
		excludeProject(body.id);
		return res.json({ success: true });
	});

	app.get('/api/sessions', (req, res) => {
		const projectPath = (req.query.projectPath as string | undefined) ?? undefined;
		const sessions = listSessions(projectPath).map((s) => ({
			id: s.id,
			model: s.model,
			createdAt: s.createdAt.toISOString(),
			projectPath: s.projectPath,
			permissionMode: s.permissionMode,
			name: s.name,
		}));
		res.json({ sessions });
	});

	app.post('/api/sessions', (req, res) => {
		const body = req.body as {
			model?: string;
			projectPath?: unknown;
			permissionMode?: unknown;
		};
		if (!body.projectPath || typeof body.projectPath !== 'string') {
			return res.status(400).json({ error: 'projectPath is required' });
		}
		const model = SUPPORTED_MODELS.includes(body.model as (typeof SUPPORTED_MODELS)[number])
			? (body.model as (typeof SUPPORTED_MODELS)[number])
			: DEFAULT_MODEL;
		const permissionMode =
			body.permissionMode === 'dangerouslySkipPermissions'
				? ('dangerouslySkipPermissions' as const)
				: ('allowEdits' as const);
		const session = createSession(model, body.projectPath, permissionMode);
		return res.json({
			id: session.id,
			model: session.model,
			createdAt: session.createdAt.toISOString(),
			projectPath: session.projectPath,
			permissionMode: session.permissionMode,
			name: session.name,
		});
	});

	app.get('/api/sessions/:id/messages', (req, res) => {
		const session = getSession(req.params.id as string);
		if (!session) return res.status(404).json({ error: 'Session not found' });
		return res.json({ messages: session.messages });
	});

	app.patch('/api/sessions/:id', (req, res) => {
		const id = req.params.id as string;
		const body = req.body as { permissionMode?: unknown; name?: unknown };

		if (body.permissionMode !== undefined) {
			const mode =
				body.permissionMode === 'dangerouslySkipPermissions'
					? ('dangerouslySkipPermissions' as const)
					: ('allowEdits' as const);
			setSessionPermissionMode(id, mode);
		}

		if (typeof body.name === 'string' && body.name.trim()) {
			renameSession(id, body.name.trim());
		}

		const session = getSession(id);
		if (!session) return res.status(404).json({ error: 'Session not found' });
		return res.json({
			id: session.id,
			model: session.model,
			createdAt: session.createdAt.toISOString(),
			projectPath: session.projectPath,
			permissionMode: session.permissionMode,
			name: session.name,
		});
	});

	app.delete('/api/sessions/:id', (req, res) => {
		const deleted = deleteSession(req.params.id as string);
		if (!deleted) return res.status(404).json({ error: 'Session not found' });
		return res.json({ success: true });
	});

	app.post('/api/chat', async (req, res) => {
		try {
			const body = req.body as { message?: string; sessionId?: string };
			const { message, sessionId } = body;

			if (!message || typeof message !== 'string') {
				return res.status(400).json({ error: 'message is required' });
			}
			if (!sessionId || typeof sessionId !== 'string') {
				return res.status(400).json({ error: 'sessionId is required' });
			}

			const response = await sendMessage(sessionId, message);
			return res.json({ response });
		} catch (error) {
			console.error('Error in /api/chat:', error);
			return res
				.status(500)
				.json({ error: error instanceof Error ? error.message : 'Unknown error' });
		}
	});

	const port = 3001;
	// dual-stack: accepts IPv4 and IPv6; ipv6Only:false is the Linux default but stated explicitly for portability
	const server = app.listen({ port, host: '::', ipv6Only: false }, () => {
		const localIP = getLocalIP();
		console.log(`\n${'='.repeat(50)}`);
		console.log('🚀 Claudet API server running!');
		console.log('='.repeat(50));
		console.log(`\n📍 Local:   http://localhost:${port}`);
		console.log(`📱 Network: http://${localIP}:${port}`);
		console.log('\n📲 Start the Expo app in mobile/ and point it to the above URL');
		console.log(`${'='.repeat(50)}\n`);
	});

	return server;
}
