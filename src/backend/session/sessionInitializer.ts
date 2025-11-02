import { SessionManager } from '../SessionManager';
import type { ClaudeCodeService } from '../services/ClaudeCodeService';
import { readSessionOutput } from './sessionOutputReader';

// Module-level session manager and tracking
let sessionManager: SessionManager;
const sessionReaders = new Map<string, boolean>();

/**
 * Initialize the session manager with a Claude service
 * Creates a default session and starts reading its output
 */
export function initializeSessionManager(service: ClaudeCodeService) {
	sessionManager = new SessionManager(service);
	// Create a default session
	const defaultSession = sessionManager.createSession();
	defaultSession.actor.send({ type: 'START_PROCESS' });
	console.log(`🤖 Default Claude session created: ${defaultSession.id}`);

	// Start reading output for this session
	setTimeout(() => {
		readSessionOutput(sessionManager, sessionReaders, defaultSession.id);
	}, 100);
}

/**
 * Get the current session manager instance
 */
export function getSessionManager(): SessionManager {
	return sessionManager;
}

/**
 * Get the session readers map
 */
export function getSessionReaders(): Map<string, boolean> {
	return sessionReaders;
}
