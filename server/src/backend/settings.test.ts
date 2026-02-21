import { describe, test, expect } from 'vitest';
import { validateBaseDir } from './settings';

describe('validateBaseDir', () => {
	test('accepts a simple subdirectory name', () => {
		expect(validateBaseDir('dev')).toBe('dev');
	});

	test('accepts a nested relative path', () => {
		expect(validateBaseDir('work/projects')).toBe('work/projects');
	});

	test('rejects empty string', () => {
		expect(() => validateBaseDir('')).toThrow();
	});

	test('rejects whitespace-only string', () => {
		expect(() => validateBaseDir('   ')).toThrow();
	});

	test('rejects "."', () => {
		expect(() => validateBaseDir('.')).toThrow();
	});

	test('rejects "~"', () => {
		expect(() => validateBaseDir('~')).toThrow();
	});

	test('rejects ".."', () => {
		expect(() => validateBaseDir('..')).toThrow();
	});

	test('rejects path with ".." traversal', () => {
		expect(() => validateBaseDir('dev/../etc')).toThrow();
	});

	test('rejects absolute path', () => {
		expect(() => validateBaseDir('/home/user/dev')).toThrow();
	});

	test('rejects non-string', () => {
		expect(() => validateBaseDir(null)).toThrow();
		expect(() => validateBaseDir(42)).toThrow();
		expect(() => validateBaseDir(undefined)).toThrow();
	});
});
