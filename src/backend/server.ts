import index from '../frontend/index.html';
import qrcode from 'qrcode-terminal';
import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Server as Engine } from '@socket.io/bun-engine';
import { Server } from 'socket.io';
import { getLocalIP } from './utils/network';
import { createSession, sendMessage } from './claude';
import { setupSocketHandlers } from './socket/handlers';
import { transcribeAudioFile } from './audio/transcription';

export function startServer() {
	// Check if certificates exist
	if (!existsSync('./certs/localhost+3.pem') || !existsSync('./certs/localhost+3-key.pem')) {
		console.error('\n❌ HTTPS certificates not found!');
		console.error('📋 Run the following command to generate them:\n');
		console.error('   bun run setup\n');
		console.error('   (or just: bun run generate:certs if you only need certificates)\n');
		process.exit(1);
	}

	// Create a default session on startup
	const defaultSession = createSession();
	console.log(`🤖 Default Claude session created: ${defaultSession.id}`);

	// Initialize Socket.IO with Bun engine
	const io = new Server();
	const engine = new Engine({ path: '/socket.io/' });
	io.bind(engine);

	setupSocketHandlers(io);

	const server = Bun.serve({
		// Integrate Socket.IO engine with Bun.serve first
		...engine.handler(),

		hostname: '0.0.0.0',
		port: 3000,
		idleTimeout: 120,
		tls: {
			cert: Bun.file('./certs/localhost+3.pem'),
			key: Bun.file('./certs/localhost+3-key.pem'),
		},

		routes: {
			'/logo.svg': Bun.file('./src/frontend/assets/logo.svg'),

			// PWA Routes
			'/sw.js': Bun.file('./src/frontend/sw.js'),
			'/manifest.json': Bun.file('./src/frontend/manifest.json'),
			'/icon-180.png': Bun.file('./src/frontend/assets/icon-180.png'),
			'/icon-192.png': Bun.file('./src/frontend/assets/icon-192.png'),
			'/icon-512.png': Bun.file('./src/frontend/assets/icon-512.png'),
			'/apple-touch-icon.png': Bun.file('./src/frontend/assets/icon-180.png'),
			'/assets/gen/icon-180.png': Bun.file('./src/frontend/assets/gen/icon-180.png'),
			'/assets/gen/icon-192.png': Bun.file('./src/frontend/assets/gen/icon-192.png'),
			'/assets/gen/icon-512.png': Bun.file('./src/frontend/assets/gen/icon-512.png'),

			// Serve index.html for all unmatched routes
			'/*': index,

			'/api/models': {
				async GET(_req) {
					return Response.json({
						models: ['haiku', 'sonnet'],
						default: process.env.NODE_ENV === 'production' ? 'sonnet' : 'haiku',
					});
				},
			},

			'/api/transcribe': {
				async POST(req) {
					let tempAudioPath: string | null = null;

					try {
						const formData = await req.formData();
						const audioFile = formData.get('audio') as File | null;

						if (!audioFile) {
							return Response.json({ error: 'No audio file provided' }, { status: 400 });
						}

						const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
						const ext = audioFile.name.split('.').pop() || 'webm';
						tempAudioPath = join('/tmp', `recording_${timestamp}.${ext}`);

						await Bun.write(tempAudioPath, audioFile);

						const transcription = await transcribeAudioFile(tempAudioPath);

						return Response.json({ text: transcription });
					} catch (error) {
						console.error('Error in /api/transcribe:', error);
						return Response.json(
							{
								error: error instanceof Error ? error.message : 'Transcription failed',
							},
							{ status: 500 },
						);
					} finally {
						if (tempAudioPath) {
							await unlink(tempAudioPath).catch(() => {});
						}
					}
				},
			},
		},

		development: process.env.NODE_ENV !== 'production' && {
			hmr: true,
			console: true,
		},
	});

	// Mobile HTTP API server (plain HTTP for React Native dev without cert issues)
	const mobileServer = Bun.serve({
		hostname: '0.0.0.0',
		port: 3001,
		routes: {
			'/api/chat': {
				async POST(req) {
					try {
						const body = (await req.json()) as { message?: string; sessionId?: string };
						const { message, sessionId } = body;

						if (!message || typeof message !== 'string') {
							return Response.json({ error: 'message is required' }, { status: 400 });
						}
						if (!sessionId || typeof sessionId !== 'string') {
							return Response.json({ error: 'sessionId is required' }, { status: 400 });
						}

						const response = await sendMessage(sessionId, message);
						return Response.json({ response });
					} catch (error) {
						console.error('Error in mobile /api/chat:', error);
						return Response.json(
							{ error: error instanceof Error ? error.message : 'Unknown error' },
							{ status: 500 },
						);
					}
				},
			},
			'/api/sessions': {
				async POST(_req) {
					const session = createSession('haiku');
					return Response.json({ id: session.id, model: session.model });
				},
			},
		},
		fetch(req) {
			return new Response('Not found', { status: 404 });
		},
	});

	const localIP = getLocalIP();
	const port = server.port;

	console.log(`\n${'='.repeat(50)}`);
	console.log('🚀 Server running!');
	console.log('='.repeat(50));
	console.log(`\n📍 Local:   ${server.url}`);
	console.log(`📱 Network: https://${localIP}:${port}\n`);
	console.log(`📡 Mobile HTTP API: http://${localIP}:${mobileServer.port} (no TLS)\n`);

	const networkURL = `https://${localIP}:${port}`;
	console.log('📱 Scan QR code to open on your phone:\n');
	qrcode.generate(networkURL, { small: true });

	console.log(`\n${'='.repeat(50)}\n`);

	return server;
}
