import type { SessionManager } from '../SessionManager';
import { readStreamLines } from '../utils/streamReader';

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

		await readStreamLines(
			context.processHandle.stdout,
			(line) => session.actor.send({ type: 'OUTPUT_LINE', line }),
			{
				logPrefix: `[Session ${sessionId.substring(0, 8)}]`,
			},
		);
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
