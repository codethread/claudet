export type Message = { role: 'user' | 'assistant'; content: string };
export type PermissionMode = 'allowEdits' | 'dangerouslySkipPermissions';
export type Session = {
	id: string;
	model: string;
	createdAt: string;
	projectPath: string;
	permissionMode: PermissionMode;
};
export type Project = { id: string; name: string; path: string };
export type Settings = { baseDir: string | null };
