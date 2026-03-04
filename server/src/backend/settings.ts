import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type Settings = { baseDir: string | null; excludedProjects: string[] };

const CONFIG_DIR = join(homedir(), '.claudet');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function loadSettings(): Settings {
	try {
		const raw = readFileSync(CONFIG_FILE, 'utf8');
		const parsed = JSON.parse(raw) as unknown;
		if (parsed && typeof parsed === 'object' && 'baseDir' in parsed) {
			const { baseDir, excludedProjects } = parsed as {
				baseDir: unknown;
				excludedProjects: unknown;
			};
			return {
				baseDir: typeof baseDir === 'string' ? baseDir : null,
				excludedProjects: Array.isArray(excludedProjects)
					? excludedProjects.filter((p): p is string => typeof p === 'string')
					: [],
			};
		}
	} catch {
		// File missing or unreadable — return defaults
	}
	return { baseDir: null, excludedProjects: [] };
}

export function saveSettings(s: Settings): void {
	mkdirSync(CONFIG_DIR, { recursive: true });
	writeFileSync(CONFIG_FILE, JSON.stringify(s, null, 2), 'utf8');
}

export function excludeProject(projectPath: string): void {
	const settings = loadSettings();
	if (!settings.excludedProjects.includes(projectPath)) {
		settings.excludedProjects.push(projectPath);
		saveSettings(settings);
	}
}

export function validateBaseDir(raw: unknown): string {
	if (typeof raw !== 'string' || raw.trim() === '') {
		throw new Error('baseDir must be a non-empty string');
	}
	const value = raw.trim();
	if (value === '.' || value === '~') {
		throw new Error(`baseDir cannot be "${value}"`);
	}
	if (value.includes('..')) {
		throw new Error('baseDir must not contain ".."');
	}
	if (value.startsWith('/')) {
		throw new Error('baseDir must be a relative path (no leading slash)');
	}
	// Verify it resolves to a real subdirectory under home
	const home = homedir();
	const resolved = join(home, value);
	if (resolved === home) {
		throw new Error('baseDir must be a subdirectory of home, not home itself');
	}
	return value;
}
