import index from '../frontend/index.html';
import qrcode from 'qrcode-terminal';
import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { RealClaudeCodeService } from './services';
import type { ClaudeCodeService } from './services/ClaudeCodeService';
import { Server as Engine } from '@socket.io/bun-engine';
import { Server } from 'socket.io';
import { getLocalIP } from './utils/network';
import {
	initializeSessionManager,
	getSessionManager,
	getSessionReaders,
} from './session/sessionInitializer';
import { transcribeAudioFile } from './audio/transcription';
import { setupSocketHandlers } from './socket/handlers';

// Initialize with default production service
initializeSessionManager(new RealClaudeCodeService());

export interface StartServerOptions {
	/**
	 * Optional ClaudeCodeService for dependency injection (testing)
	 */
	service?: ClaudeCodeService;
}

export function startServer(options: StartServerOptions = {}) {
	// If a custom service is provided, reinitialize the session manager
	if (options.service) {
		initializeSessionManager(options.service);
	}

	// Check if certificates exist
	if (!existsSync('./certs/localhost+3.pem') || !existsSync('./certs/localhost+3-key.pem')) {
		console.error('\n❌ HTTPS certificates not found!');
		console.error('📋 Run the following command to generate them:\n');
		console.error('   bun run setup\n');
		console.error('   (or just: bun run generate:certs if you only need certificates)\n');
		process.exit(1);
	}

	// Initialize Socket.IO with Bun engine
	const io = new Server();
	const engine = new Engine({ path: '/socket.io/' });
	io.bind(engine);

	// Setup Socket.IO event handlers
	setupSocketHandlers(io, getSessionManager(), getSessionReaders());

	const server = Bun.serve({
		// Integrate Socket.IO engine with Bun.serve first
		...engine.handler(),

		// Override with our specific settings
		hostname: '0.0.0.0', // Listen on all network interfaces
		port: 3000,
		idleTimeout: 120, // 120 seconds to allow for longer Claude responses
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

			// Serve index.html for all unmatched routes.
			'/*': index,

			'/api/models': {
				async GET(_req) {
					const { getDefaultModel } = await import('./services/ClaudeCodeService');
					return Response.json({
						models: ['haiku', 'sonnet'],
						default: getDefaultModel(),
					});
				},
			},

			'/api/transcribe': {
				async POST(req) {
					let tempAudioPath: string | null = null;

					try {
						// Parse FormData
						const formData = await req.formData();
						const audioFile = formData.get('audio') as File | null;

						if (!audioFile) {
							return Response.json({ error: 'No audio file provided' }, { status: 400 });
						}

						// Save to temp file
						const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
						const ext = audioFile.name.split('.').pop() || 'webm';
						tempAudioPath = join('/tmp', `recording_${timestamp}.${ext}`);

						await Bun.write(tempAudioPath, audioFile);

						// Transcribe the audio
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
						// Clean up temp audio file
						if (tempAudioPath) {
							await unlink(tempAudioPath).catch(() => {});
						}
					}
				},
			},
		},

		development: process.env.NODE_ENV !== 'production' && {
			// Enable browser hot reloading in development
			hmr: true,

			// Echo console logs from the browser to the server
			console: true,
		},
	});

	const localIP = getLocalIP();
	const port = server.port;

	console.log(`\n${'='.repeat(50)}`);
	console.log('🚀 Server running!');
	console.log('='.repeat(50));
	console.log(`\n📍 Local:   ${server.url}`);
	console.log(`📱 Network: https://${localIP}:${port}\n`);

	// Generate QR code for the network URL
	const networkURL = `https://${localIP}:${port}`;
	console.log('📱 Scan QR code to open on your phone:\n');
	qrcode.generate(networkURL, { small: true });

	console.log(`\n${'='.repeat(50)}\n`);

	return server;
}
