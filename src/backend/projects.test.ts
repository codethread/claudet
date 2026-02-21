import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverProjects } from './projects';

const BASE = join(tmpdir(), `claudet-projects-test-${Date.now()}`);

function mkdir(path: string) {
	mkdirSync(path, { recursive: true });
}

function mkgit(path: string) {
	mkdir(join(path, '.git'));
}

beforeAll(() => {
	// Structure:
	// BASE/
	//   alpha/          ← depth 1 repo
	//     .git/
	//   beta/           ← depth 1 repo
	//     .git/
	//   node_modules/   ← skipped
	//     inside/
	//       .git/       ← should not be found
	//   nested/
	//     child/        ← depth 2 repo
	//       .git/
	//     deep/
	//       level3/     ← depth 3 repo
	//         .git/
	//       level3_sub/
	//         level4/   ← depth 4 — should NOT be found
	//           .git/

	mkdir(BASE);

	// Depth 1 repos
	mkgit(join(BASE, 'alpha'));
	mkgit(join(BASE, 'beta'));

	// Skipped dir
	mkdir(join(BASE, 'node_modules', 'inside'));
	mkgit(join(BASE, 'node_modules', 'inside'));

	// Depth 2 repo
	mkgit(join(BASE, 'nested', 'child'));

	// Depth 3 repo
	mkgit(join(BASE, 'nested', 'deep', 'level3'));

	// Depth 4 — should NOT be found (3 levels below basePath = max)
	mkgit(join(BASE, 'nested', 'deep', 'level3_sub', 'level4'));
});

afterAll(() => {
	rmSync(BASE, { recursive: true, force: true });
});

test('finds repos at depth 1', () => {
	const projects = discoverProjects(BASE);
	const names = projects.map((p) => p.name);
	expect(names).toContain('alpha');
	expect(names).toContain('beta');
});

test('finds repos at depth 2', () => {
	const projects = discoverProjects(BASE);
	const names = projects.map((p) => p.name);
	expect(names).toContain('child');
});

test('finds repos at depth 3', () => {
	const projects = discoverProjects(BASE);
	const names = projects.map((p) => p.name);
	expect(names).toContain('level3');
});

test('does not find repos at depth 4', () => {
	const projects = discoverProjects(BASE);
	const names = projects.map((p) => p.name);
	expect(names).not.toContain('level4');
});

test('skips node_modules', () => {
	const projects = discoverProjects(BASE);
	const names = projects.map((p) => p.name);
	expect(names).not.toContain('inside');
});

test('does not recurse into repos already found', () => {
	// alpha has .git, so we should not recurse into it even if it had subdirs
	const projects = discoverProjects(BASE);
	const paths = projects.map((p) => p.path);
	// No path should be a child of alpha's path
	const alphaPath = join(BASE, 'alpha');
	const childOfAlpha = paths.find((p) => p.startsWith(`${alphaPath}/`));
	expect(childOfAlpha).toBeUndefined();
});

test('returns projects sorted alphabetically by name', () => {
	const projects = discoverProjects(BASE);
	const names = projects.map((p) => p.name);
	const sorted = [...names].sort((a, b) => a.localeCompare(b));
	expect(names).toEqual(sorted);
});

test('returns empty array for non-existent base path', () => {
	const projects = discoverProjects('/non/existent/path/xyz');
	expect(projects).toEqual([]);
});

describe('project shape', () => {
	test('id equals path', () => {
		const projects = discoverProjects(BASE);
		for (const p of projects) {
			expect(p.id).toBe(p.path);
		}
	});
});
