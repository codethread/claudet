import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type Project = { id: string; name: string; path: string };

const SKIP_DIRS = new Set([
	'node_modules',
	'dist',
	'build',
	'target',
	'.next',
	'vendor',
	'.git',
]);

export function discoverProjects(basePath: string, maxDepth = 3): Project[] {
	const projects: Project[] = [];
	walk(basePath, 0, maxDepth, projects);
	return projects.sort((a, b) => a.name.localeCompare(b.name));
}

function isDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

function walk(currentPath: string, depth: number, maxDepth: number, projects: Project[]): void {
	let entries: string[];
	try {
		entries = readdirSync(currentPath);
	} catch {
		return;
	}

	// If this directory (not the basePath root at depth 0) contains a .git entry, it's a project
	if (depth > 0 && entries.includes('.git')) {
		const name = currentPath.split('/').pop() ?? currentPath;
		projects.push({ id: currentPath, name, path: currentPath });
		// Don't recurse into a git repo
		return;
	}

	if (depth >= maxDepth) return;

	for (const entry of entries) {
		if (SKIP_DIRS.has(entry)) continue;
		const childPath = join(currentPath, entry);
		if (!isDirectory(childPath)) continue;
		walk(childPath, depth + 1, maxDepth, projects);
	}
}
