import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
	dbAppendMessage,
	dbCreateSession,
	dbDeleteSession,
	dbGetSession,
	dbListSessions,
	dbUpdateMessageCount,
	dbUpdateSession,
} from './db';

export type PermissionMode = 'allowEdits' | 'dangerouslySkipPermissions';

export type ClaudeModel = 'haiku' | 'sonnet';

export interface SessionMessage {
	role: 'user' | 'assistant';
	content: string;
}

export interface Session {
	id: string;
	model: ClaudeModel;
	createdAt: Date;
	messageCount: number;
	messages: SessionMessage[];
	projectPath: string;
	permissionMode: PermissionMode;
	name?: string;
}

export function createSession(
	model: ClaudeModel = 'haiku',
	projectPath: string,
	permissionMode: PermissionMode = 'allowEdits',
): Session {
	const id = randomUUID();
	const session: Session = {
		id,
		model,
		createdAt: new Date(),
		messageCount: 0,
		messages: [],
		projectPath,
		permissionMode,
	};
	dbCreateSession(session);
	return session;
}

export function setSessionPermissionMode(id: string, mode: PermissionMode): Session | undefined {
	const session = dbGetSession(id);
	if (!session) return undefined;
	dbUpdateSession(id, { permissionMode: mode });
	session.permissionMode = mode;
	return session;
}

export function renameSession(id: string, name: string): Session | undefined {
	const session = dbGetSession(id);
	if (!session) return undefined;
	dbUpdateSession(id, { name });
	return { ...session, name };
}

export function deleteSession(id: string): boolean {
	const session = dbGetSession(id);
	if (!session) return false;
	dbDeleteSession(id);
	return true;
}

export function getSession(id: string): Session | undefined {
	return dbGetSession(id);
}

export function listSessions(projectPath?: string): Session[] {
	return dbListSessions(projectPath);
}

export async function sendMessage(sessionId: string, message: string): Promise<string> {
	const session = dbGetSession(sessionId);
	if (!session) throw new Error(`Session ${sessionId} not found`);

	// Fake mode for E2E testing — avoids real Claude CLI calls
	if (process.env.CLAUDE_TEST_FAKE === 'true') {
		await new Promise((r) => setTimeout(r, 300));
		const echoResponse = `Echo: ${message.substring(0, 100)}`;
		dbAppendMessage(sessionId, { role: 'user', content: message });
		dbAppendMessage(sessionId, { role: 'assistant', content: echoResponse });
		dbUpdateMessageCount(sessionId, session.messageCount + 2);
		return echoResponse;
	}

	const isFirstMessage = session.messageCount === 0;
	const permArgs =
		session.permissionMode === 'dangerouslySkipPermissions'
			? ['--dangerously-skip-permissions']
			: ['--allowedTools', 'Bash', 'Edit', 'Write', 'MultiEdit', 'Read', 'Glob', 'Grep'];
	const args: string[] = isFirstMessage
		? ['--session-id', sessionId, '--model', session.model, ...permArgs, '--print', message]
		: ['--resume', sessionId, ...permArgs, '--print', message];

	// Write user message to DB before spawn (matches original optimistic behavior)
	dbAppendMessage(sessionId, { role: 'user', content: message });
	dbUpdateMessageCount(sessionId, session.messageCount + 1);

	// CLAUDE_DIR overrides project path (keeps dev:test script working)
	const cwd = process.env.CLAUDE_DIR ?? session.projectPath;

	// Strip CLAUDECODE from the environment so nested sessions don't get blocked
	const { CLAUDECODE: _, ...safeEnv } = process.env;

	const proc = spawn('claude', args, {
		stdio: ['ignore', 'pipe', 'pipe'],
		env: safeEnv as NodeJS.ProcessEnv,
		cwd,
	});

	const collectStream = (stream: NodeJS.ReadableStream): Promise<string> =>
		new Promise((resolve) => {
			const chunks: Buffer[] = [];
			stream.on('data', (chunk: Buffer) => chunks.push(chunk));
			stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		});

	const [output, errText, exitCode] = await Promise.all([
		collectStream(proc.stdout!),
		collectStream(proc.stderr!),
		new Promise<number>((resolve) => proc.on('close', (code) => resolve(code ?? 1))),
	]);

	if (exitCode !== 0) {
		// User message stays in DB — this is acceptable behavior (user did send that message)
		throw new Error(`Claude exited with code ${exitCode}: ${errText.trim()}`);
	}

	const response = output.trim();
	dbAppendMessage(sessionId, { role: 'assistant', content: response });
	return response;
}
