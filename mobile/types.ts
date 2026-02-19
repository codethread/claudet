export type Message = { role: 'user' | 'assistant'; content: string };
export type Session = { id: string; model: string; createdAt: string; projectPath: string };
export type Project = { id: string; name: string; path: string };
export type Settings = { baseDir: string | null };
