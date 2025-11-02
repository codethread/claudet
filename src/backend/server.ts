import index from '../frontend/index.html';
import qrcode from 'qrcode-terminal';
import { networkInterfaces } from 'node:os';
import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { RealClaudeCodeService } from './services';
import type { ClaudeCodeService } from './services/ClaudeCodeService';
import { SessionManager } from './SessionManager';
import type { ClaudeResponse } from './claudeRunner';
import { Server as Engine } from '@socket.io/bun-engine';
import { Server } from 'socket.io';
import { ChatSendSchema, SessionListSchema, SessionCreateSchema } from '../shared/messages';
import type { ClaudeModel } from './services/ClaudeCodeService';

// Get local network IP address
function getLocalIP(): string {
	const nets = networkInterfaces();

	for (const name of Object.keys(nets)) {
		const interfaces = nets[name];
		if (!interfaces) continue;

		for (const net of interfaces) {
			// Skip internal (localhost) and non-IPv4 addresses
			const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
			if (net.family === familyV4Value && !net.internal) {
				return net.address;
			}
		}
	}

	return 'localhost';
}

// Module-level session manager
let sessionManager: SessionManager;
const sessionReaders = new Map<string, boolean>(); // Track which sessions are being read

function initializeSessionManager(service: ClaudeCodeService) {
	sessionManager = new SessionManager(service);
	// Create a default session
	const defaultSession = sessionManager.createSession();
	defaultSession.actor.send({ type: 'START_PROCESS' });
	console.log(`🤖 Default Claude session created: ${defaultSession.id}`);

	// Start reading output for this session
	setTimeout(() => {
		readSessionOutput(defaultSession.id);
	}, 100);
}

// Initialize with default production service
initializeSessionManager(new RealClaudeCodeService());

// Start reading Claude output for a specific session
async function readSessionOutput(sessionId: string) {
	if (sessionReaders.get(sessionId)) {
		console.log(`Already reading output for session ${sessionId}, skipping...`);
		return;
	}

	sessionReaders.set(sessionId, true);

	try {
		const session = sessionManager.getSession(sessionId);
		if (!session) {
			console.error(`Session ${sessionId} not found`);
			sessionReaders.delete(sessionId);
			return;
		}

		// Wait a bit for process handle to be ready
		await new Promise((resolve) => setTimeout(resolve, 200));

		const context = session.actor.getSnapshot().context;
		if (!context.processHandle) {
			console.error(`No process handle available for session ${sessionId}`);
			sessionReaders.delete(sessionId);
			return;
		}

		const reader = context.processHandle.stdout.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');

			// Keep the last incomplete line in the buffer
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (!line.trim()) continue;

				console.log(`[Session ${sessionId.substring(0, 8)}] ${line.substring(0, 100)}...`);

				// Send the output line to the state machine
				session.actor.send({ type: 'OUTPUT_LINE', line });
			}
		}
	} catch (error) {
		console.error(`Error reading output for session ${sessionId}:`, error);
		const session = sessionManager.getSession(sessionId);
		if (session) {
			session.actor.send({ type: 'PROCESS_ERROR', error: String(error) });
		}
	} finally {
		sessionReaders.delete(sessionId);
	}
}

// Function to send a message to a specific Claude session
async function sendToClaude(sessionId: string, message: string): Promise<ClaudeResponse> {
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

// Transcription configuration
const WHISPER_MODEL = join(homedir(), 'dev/models/ggml-medium.bin');

// Transcribe audio file using whisper-cli
async function transcribeAudioFile(audioPath: string): Promise<string> {
	// Check file size (must be > 1000 bytes like PersonalConfigs script)
	const audioFile = Bun.file(audioPath);
	const fileSize = audioFile.size;

	if (fileSize < 1000) {
		throw new Error('Recording too short or empty');
	}

	// Check if whisper model exists
	if (!existsSync(WHISPER_MODEL)) {
		throw new Error(`Whisper model not found at ${WHISPER_MODEL}`);
	}

	// Convert WebM to WAV using ffmpeg
	const wavPath = audioPath.replace(/\.\w+$/, '.wav');
	const ffmpegProc = Bun.spawn(
		[
			'ffmpeg',
			'-i',
			audioPath,
			'-ar',
			'16000', // 16kHz sample rate
			'-ac',
			'1', // mono
			'-f',
			'wav',
			wavPath,
		],
		{
			stdout: 'pipe',
			stderr: 'pipe',
		},
	);

	await ffmpegProc.exited;

	if (ffmpegProc.exitCode !== 0) {
		throw new Error('Failed to convert audio to WAV format');
	}

	// Run whisper-cli transcription
	const whisperProc = Bun.spawn(['whisper-cli', '-m', WHISPER_MODEL, '-nt', '-np', wavPath], {
		stdout: 'pipe',
		stderr: 'pipe',
	});

	// Collect transcription output
	const transcription = await new Response(whisperProc.stdout).text();

	await whisperProc.exited;

	if (whisperProc.exitCode !== 0) {
		throw new Error('Whisper transcription failed');
	}

	// Clean up WAV file
	await unlink(wavPath).catch(() => {});

	return transcription.trim();
}

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

	// Socket.IO connection handler
	io.on('connection', (socket) => {
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
				const { response, logs } = await sendToClaude(sessionId, message);

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
					readSessionOutput(session.id);
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
