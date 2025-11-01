import { createActor, type Actor } from 'xstate';
import { createClaudeRunnerMachine, type ClaudeRunnerMachine } from './claudeRunner';
import type { ClaudeCodeService } from './services';
import type { ClaudeModel } from './services/ClaudeCodeService';
import { getDefaultModel } from './services/ClaudeCodeService';
import { randomUUID } from 'node:crypto';

export interface Session {
	id: string;
	actor: Actor<ClaudeRunnerMachine>;
	model: ClaudeModel;
	createdAt: Date;
}

export class SessionManager {
	private sessions = new Map<string, Session>();

	constructor(private service: ClaudeCodeService) {}

	/**
	 * Creates a new Claude CLI session
	 * @param model - Optional model to use (defaults to environment-based default)
	 */
	createSession(model?: ClaudeModel): Session {
		const id = randomUUID();
		const selectedModel = model || getDefaultModel();
		const machine = createClaudeRunnerMachine(this.service, id, selectedModel);
		const actor = createActor(machine);
		actor.start();

		const session: Session = {
			id,
			actor,
			model: selectedModel,
			createdAt: new Date(),
		};

		this.sessions.set(id, session);
		return session;
	}

	/**
	 * Gets a session by ID
	 */
	getSession(id: string): Session | undefined {
		return this.sessions.get(id);
	}

	/**
	 * Lists all sessions
	 */
	listSessions(): Array<{ id: string; model: ClaudeModel; createdAt: Date }> {
		return Array.from(this.sessions.values()).map((session) => ({
			id: session.id,
			model: session.model,
			createdAt: session.createdAt,
		}));
	}

	/**
	 * Deletes a session and stops its actor
	 */
	deleteSession(id: string): boolean {
		const session = this.sessions.get(id);
		if (!session) {
			return false;
		}

		session.actor.stop();
		this.sessions.delete(id);
		return true;
	}

	/**
	 * Gets the default session (creates one if none exist)
	 */
	getOrCreateDefaultSession(): Session {
		const sessions = this.listSessions();
		if (sessions.length === 0) {
			return this.createSession();
		}
		// Return the oldest session as default
		const sorted = sessions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
		const oldestSessionId = sorted[0]!.id;
		const session = this.sessions.get(oldestSessionId);
		if (!session) {
			throw new Error(`Session ${oldestSessionId} not found`);
		}
		return session;
	}
}
