import Constants from 'expo-constants';
import type { Message, PermissionMode, Project, Session, Settings } from './types';

function getServerUrl(): string {
	const hostUri =
		Constants.expoConfig?.hostUri ??
		// biome-ignore lint/suspicious/noExplicitAny: expo manifest v2 shape
		(Constants as any).manifest2?.extra?.expoClient?.hostUri;
	const host = hostUri ? hostUri.split(':')[0] : 'localhost';
	return `http://${host}:3001`;
}

export const SERVER_URL = getServerUrl();

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`${SERVER_URL}${path}`, options);
	const data = (await res.json()) as T & { error?: string };
	if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
	return data;
}

export async function fetchSettings(): Promise<Settings> {
	return apiFetch<Settings>('/api/settings');
}

export async function saveSettings(baseDir: string): Promise<Settings> {
	return apiFetch<Settings>('/api/settings', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ baseDir }),
	});
}

export async function updateSession(
	sessionId: string,
	updates: { permissionMode: PermissionMode },
): Promise<Session> {
	return apiFetch<Session>(`/api/sessions/${sessionId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(updates),
	});
}

export async function fetchProjects(): Promise<Project[]> {
	const data = await apiFetch<{ projects: Project[] }>('/api/projects');
	return data.projects;
}

export async function fetchSessions(projectPath?: string): Promise<Session[]> {
	const query = projectPath ? `?projectPath=${encodeURIComponent(projectPath)}` : '';
	const data = await apiFetch<{ sessions: Session[] }>(`/api/sessions${query}`);
	return data.sessions;
}

export async function fetchModels(): Promise<{ models: string[]; default: string }> {
	return apiFetch<{ models: string[]; default: string }>('/api/models');
}

export async function createSession(model: string, projectPath: string): Promise<Session> {
	return apiFetch<Session>('/api/sessions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ model, projectPath }),
	});
}

export async function sendChat(sessionId: string, message: string): Promise<string> {
	const data = await apiFetch<{ response: string }>('/api/chat', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ sessionId, message }),
	});
	return data.response;
}

export async function fetchSessionMessages(sessionId: string): Promise<Message[]> {
	const data = await apiFetch<{ messages: Message[] }>(`/api/sessions/${sessionId}/messages`);
	return data.messages;
}
