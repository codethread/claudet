import { randomUUID } from 'node:crypto';

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
}

const sessions = new Map<string, Session>();

export function createSession(model: ClaudeModel = 'haiku', projectPath: string): Session {
	const id = randomUUID();
	const session: Session = {
		id,
		model,
		createdAt: new Date(),
		messageCount: 0,
		messages: [],
		projectPath,
	};
	sessions.set(id, session);
	return session;
}

export function getSession(id: string): Session | undefined {
	return sessions.get(id);
}

export function listSessions(projectPath?: string): Session[] {
	const all = Array.from(sessions.values());
	if (projectPath === undefined) return all;
	return all.filter((s) => s.projectPath === projectPath);
}

export async function sendMessage(sessionId: string, message: string): Promise<string> {
	const session = sessions.get(sessionId);
	if (!session) throw new Error(`Session ${sessionId} not found`);

	// Fake mode for E2E testing — avoids real Claude CLI calls
	if (process.env.CLAUDE_TEST_FAKE === 'true') {
		await new Promise((r) => setTimeout(r, 300));
		session.messageCount++;
		const echoResponse = `Echo: ${message.substring(0, 100)}`;
		session.messages.push({ role: 'user', content: message });
		session.messages.push({ role: 'assistant', content: echoResponse });
		return echoResponse;
	}

	const isFirstMessage = session.messageCount === 0;
	const args: string[] = isFirstMessage
		? ['--session-id', sessionId, '--model', session.model, '--print', message]
		: ['--resume', sessionId, '--print', message];

	session.messageCount++;
	session.messages.push({ role: 'user', content: message });

	// CLAUDE_DIR overrides project path (keeps dev:test script working)
	const cwd = process.env.CLAUDE_DIR ?? session.projectPath;

	// Strip CLAUDECODE from the environment so nested sessions don't get blocked
	const { CLAUDECODE: _, ...safeEnv } = process.env;

	const proc = Bun.spawn(['claude', ...args], {
		stdout: 'pipe',
		stderr: 'pipe',
		env: safeEnv,
		cwd,
	});

	const [output, errText] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		// Roll back the user message we optimistically pushed
		session.messages.pop();
		throw new Error(`Claude exited with code ${exitCode}: ${errText.trim()}`);
	}

	const response = output.trim();
	session.messages.push({ role: 'assistant', content: response });
	return response;
}
