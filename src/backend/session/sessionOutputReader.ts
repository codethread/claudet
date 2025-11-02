import type { SessionManager } from '../SessionManager';

/**
 * Start reading Claude output for a specific session
 * Reads stdout line by line and forwards to the session's state machine
 */
export async function readSessionOutput(
	sessionManager: SessionManager,
	sessionReaders: Map<string, boolean>,
	sessionId: string,
) {
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
