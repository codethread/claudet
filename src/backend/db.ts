import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { PermissionMode, Session, SessionMessage } from './claude';

const dbDir = join(homedir(), '.claudet');
const dbPath = join(dbDir, 'claudet.db');

mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);

db.run('PRAGMA journal_mode=WAL');
db.run('PRAGMA foreign_keys=ON');

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    created_at TEXT NOT NULL,
    project_path TEXT NOT NULL,
    permission_mode TEXT NOT NULL DEFAULT 'allowEdits',
    message_count INTEGER NOT NULL DEFAULT 0
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL
  )
`);

export { db };

// Prepared statements for performance
const stmtInsertSession = db.prepare(`
  INSERT INTO sessions (id, model, created_at, project_path, permission_mode, message_count)
  VALUES ($id, $model, $created_at, $project_path, $permission_mode, $message_count)
`);

const stmtGetSession = db.prepare(`
  SELECT id, model, created_at, project_path, permission_mode, message_count
  FROM sessions WHERE id = $id
`);

const stmtGetMessages = db.prepare(`
  SELECT role, content FROM messages WHERE session_id = $session_id ORDER BY id ASC
`);

const stmtListSessions = db.prepare(`
  SELECT id, model, created_at, project_path, permission_mode, message_count
  FROM sessions ORDER BY created_at DESC
`);

const stmtListSessionsByProject = db.prepare(`
  SELECT id, model, created_at, project_path, permission_mode, message_count
  FROM sessions WHERE project_path = $project_path ORDER BY created_at DESC
`);

const stmtUpdatePermissionMode = db.prepare(`
  UPDATE sessions SET permission_mode = $permission_mode WHERE id = $id
`);

const stmtUpdateMessageCount = db.prepare(`
  UPDATE sessions SET message_count = $message_count WHERE id = $id
`);

const stmtInsertMessage = db.prepare(`
  INSERT INTO messages (session_id, role, content) VALUES ($session_id, $role, $content)
`);

interface SessionRow {
	id: string;
	model: string;
	created_at: string;
	project_path: string;
	permission_mode: string;
	message_count: number;
}

interface MessageRow {
	role: string;
	content: string;
}

function rowToSession(row: SessionRow, messages: SessionMessage[] = []): Session {
	return {
		id: row.id,
		model: row.model as Session['model'],
		createdAt: new Date(row.created_at),
		messageCount: row.message_count,
		messages,
		projectPath: row.project_path,
		permissionMode: row.permission_mode as PermissionMode,
	};
}

export function dbCreateSession(session: Session): void {
	stmtInsertSession.run({
		$id: session.id,
		$model: session.model,
		$created_at: session.createdAt.toISOString(),
		$project_path: session.projectPath,
		$permission_mode: session.permissionMode,
		$message_count: session.messageCount,
	});
}

export function dbGetSession(id: string): Session | undefined {
	const row = stmtGetSession.get({ $id: id }) as SessionRow | undefined;
	if (!row) return undefined;

	const messageRows = stmtGetMessages.all({ $session_id: id }) as MessageRow[];
	const messages: SessionMessage[] = messageRows.map((m) => ({
		role: m.role as SessionMessage['role'],
		content: m.content,
	}));

	return rowToSession(row, messages);
}

export function dbListSessions(projectPath?: string): Session[] {
	const rows =
		projectPath !== undefined
			? (stmtListSessionsByProject.all({ $project_path: projectPath }) as SessionRow[])
			: (stmtListSessions.all() as SessionRow[]);

	return rows.map((row) => rowToSession(row, []));
}

export function dbUpdateSession(
	id: string,
	fields: Partial<Pick<Session, 'messageCount' | 'permissionMode'>>,
): void {
	if (fields.permissionMode !== undefined) {
		stmtUpdatePermissionMode.run({ $permission_mode: fields.permissionMode, $id: id });
	}
	if (fields.messageCount !== undefined) {
		stmtUpdateMessageCount.run({ $message_count: fields.messageCount, $id: id });
	}
}

export function dbAppendMessage(sessionId: string, msg: SessionMessage): void {
	stmtInsertMessage.run({ $session_id: sessionId, $role: msg.role, $content: msg.content });
}

export function dbUpdateMessageCount(sessionId: string, count: number): void {
	stmtUpdateMessageCount.run({ $message_count: count, $id: sessionId });
}
