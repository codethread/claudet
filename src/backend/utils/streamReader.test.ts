import { test, expect, describe, mock, beforeEach, afterEach } from 'bun:test';
import { readStreamLines } from './streamReader';

/**
 * Helper to create a ReadableStream from string chunks
 *
 * Simulates streaming by converting each chunk string to Uint8Array
 * and yielding it through a ReadableStream
 */
function createStream(chunks: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	let currentIndex = 0;

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			if (currentIndex < chunks.length) {
				controller.enqueue(encoder.encode(chunks[currentIndex]));
				currentIndex++;
			} else {
				controller.close();
			}
		},
	});
}

/**
 * Helper to create a stream that throws an error
 */
function createErrorStream(errorMessage: string): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		async pull() {
			throw new Error(errorMessage);
		},
	});
}

describe('readStreamLines', () => {
	describe('Basic Functionality', () => {
		test('should read simple complete lines', async () => {
			const stream = createStream(['line1\nline2\nline3\n']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['line1', 'line2', 'line3']);
		});

		test('should handle empty stream', async () => {
			const stream = createStream([]);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual([]);
		});

		test('should handle single line without newline', async () => {
			const stream = createStream(['single line']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['single line']);
		});

		test('should handle single line with newline', async () => {
			const stream = createStream(['single line\n']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['single line']);
		});

		test('should handle multiple lines in single chunk', async () => {
			const stream = createStream(['line1\nline2\nline3\nline4\n']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['line1', 'line2', 'line3', 'line4']);
		});
	});

	describe('Line Buffering', () => {
		test('should handle incomplete lines split across chunks', async () => {
			const stream = createStream(['first par', 't\nsecond par', 't\n']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['first part', 'second part']);
		});

		test('should handle last line without trailing newline', async () => {
			const stream = createStream(['line1\nline2\nlast line']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['line1', 'line2', 'last line']);
		});

		test('should handle mixed complete and incomplete chunks', async () => {
			const stream = createStream([
				'complete1\npartial',
				'_complete2\ncomplet',
				'e3\npartial_',
				'end',
			]);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['complete1', 'partial_complete2', 'complete3', 'partial_end']);
		});

		test('should handle chunks ending with newline', async () => {
			const stream = createStream(['line1\n', 'line2\n', 'line3\n']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['line1', 'line2', 'line3']);
		});

		test('should handle very small chunks (char by char)', async () => {
			const stream = createStream(['h', 'e', 'l', 'l', 'o', '\n', 'w', 'o', 'r', 'l', 'd']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['hello', 'world']);
		});
	});

	describe('Empty Line Filtering', () => {
		test('should filter out lines with only whitespace', async () => {
			const stream = createStream(['line1\n   \nline2\n\t\t\nline3\n']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['line1', 'line2', 'line3']);
		});

		test('should process lines with content and whitespace', async () => {
			const stream = createStream(['  content1  \n\tcontent2\t\n']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['  content1  ', '\tcontent2\t']);
		});

		test('should filter empty lines between content', async () => {
			const stream = createStream(['line1\n\nline2\n\n\nline3\n']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['line1', 'line2', 'line3']);
		});

		test('should handle stream with only empty lines', async () => {
			const stream = createStream(['\n\n\n   \n\t\n']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual([]);
		});

		test('should not filter final buffer with only whitespace', async () => {
			const stream = createStream(['line1\n   ']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			// Final buffer should be trimmed and filtered
			expect(lines).toEqual(['line1']);
		});
	});

	describe('Unicode and Special Characters', () => {
		test('should handle multi-byte characters (emojis)', async () => {
			const stream = createStream(['Hello 👋\nWorld 🌍\n']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['Hello 👋', 'World 🌍']);
		});

		test('should handle multi-byte characters split across chunks', async () => {
			// Split emoji across chunks - emoji is 4 bytes: F0 9F 91 8B
			const encoder = new TextEncoder();
			const emojiBytes = encoder.encode('Hello 👋 World');

			// Split in the middle of the emoji (after 2 bytes)
			const chunk1Bytes = emojiBytes.slice(0, 8); // "Hello " + first 2 bytes of emoji
			const chunk2Bytes = emojiBytes.slice(8); // rest of emoji + " World"

			const stream = new ReadableStream<Uint8Array>({
				async pull(controller) {
					controller.enqueue(chunk1Bytes);
					controller.enqueue(chunk2Bytes);
					controller.close();
				},
			});

			const lines: string[] = [];
			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['Hello 👋 World']);
		});

		test('should handle various unicode characters', async () => {
			const stream = createStream([
				'English\n',
				'日本語\n', // Japanese
				'Español\n', // Spanish with accent
				'العربية\n', // Arabic
				'🎉🎊🎈\n', // Multiple emojis
			]);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['English', '日本語', 'Español', 'العربية', '🎉🎊🎈']);
		});

		test('should handle tabs and special whitespace', async () => {
			const stream = createStream(['col1\tcol2\tcol3\n']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['col1\tcol2\tcol3']);
		});

		test('should handle carriage returns (Windows line endings)', async () => {
			const stream = createStream(['line1\r\nline2\r\nline3\r\n']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			// \r becomes part of the line content
			expect(lines).toEqual(['line1\r', 'line2\r', 'line3\r']);
		});
	});

	describe('Options Testing', () => {
		let consoleLogMock: ReturnType<typeof mock>;

		beforeEach(() => {
			consoleLogMock = mock(() => {});
			console.log = consoleLogMock;
		});

		afterEach(() => {
			mock.restore();
		});

		test('should log with prefix when logPrefix is provided', async () => {
			const stream = createStream(['line1\nline2\n']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line), {
				logPrefix: '[TEST]',
			});

			expect(lines).toEqual(['line1', 'line2']);
			expect(consoleLogMock).toHaveBeenCalledTimes(2);
			expect(consoleLogMock.mock.calls[0]?.[0]).toBe('[TEST] line1...');
			expect(consoleLogMock.mock.calls[1]?.[0]).toBe('[TEST] line2...');
		});

		test('should truncate long lines in logs to 100 chars', async () => {
			const longLine = 'a'.repeat(150);
			const stream = createStream([`${longLine}\n`]);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line), {
				logPrefix: '[TEST]',
			});

			expect(lines).toEqual([longLine]);
			expect(consoleLogMock).toHaveBeenCalledTimes(1);
			// Should truncate to 100 chars + "..."
			expect(consoleLogMock.mock.calls[0]?.[0]).toBe(`[TEST] ${'a'.repeat(100)}...`);
		});

		test('should not log when logPrefix is not provided', async () => {
			const stream = createStream(['line1\nline2\n']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['line1', 'line2']);
			expect(consoleLogMock).not.toHaveBeenCalled();
		});

		test('should log final buffer with prefix', async () => {
			const stream = createStream(['line1\nlast']);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line), {
				logPrefix: '[TEST]',
			});

			expect(lines).toEqual(['line1', 'last']);
			expect(consoleLogMock).toHaveBeenCalledTimes(2);
			expect(consoleLogMock.mock.calls[1]?.[0]).toBe('[TEST] last...');
		});
	});

	describe('Error Handling', () => {
		test('should call custom error handler when provided', async () => {
			const errorStream = createErrorStream('Test error');
			const lines: string[] = [];
			const errorHandler = mock(() => {});

			await readStreamLines(errorStream, (line) => lines.push(line), {
				onError: errorHandler,
			});

			expect(errorHandler).toHaveBeenCalledTimes(1);
			const calls = errorHandler.mock.calls as unknown[][];
			const error = calls[0]?.[0];
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toBe('Test error');
		});

		test('should log to console.error when no error handler provided', async () => {
			const errorStream = createErrorStream('Test error');
			const lines: string[] = [];
			const consoleErrorMock = mock(() => {});
			console.error = consoleErrorMock;

			await readStreamLines(errorStream, (line) => lines.push(line));

			expect(consoleErrorMock).toHaveBeenCalledTimes(1);
			const calls = consoleErrorMock.mock.calls as unknown[][];
			expect(calls[0]?.[0]).toBe('Error reading stream:');
			const error = calls[0]?.[1];
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toBe('Test error');

			mock.restore();
		});

		test('should not call onLine callback when stream errors', async () => {
			const errorStream = createErrorStream('Test error');
			const onLineMock = mock(() => {});
			const errorHandler = mock(() => {});

			await readStreamLines(errorStream, onLineMock, {
				onError: errorHandler,
			});

			expect(onLineMock).not.toHaveBeenCalled();
			expect(errorHandler).toHaveBeenCalledTimes(1);
		});

		test('should handle error after processing some lines', async () => {
			// Create a stream that yields some data then errors
			const encoder = new TextEncoder();
			let pullCount = 0;

			const stream = new ReadableStream<Uint8Array>({
				async pull(controller) {
					if (pullCount === 0) {
						controller.enqueue(encoder.encode('line1\nline2\n'));
						pullCount++;
					} else {
						throw new Error('Error after some data');
					}
				},
			});

			const lines: string[] = [];
			const errorHandler = mock(() => {});

			await readStreamLines(stream, (line) => lines.push(line), {
				onError: errorHandler,
			});

			expect(lines).toEqual(['line1', 'line2']);
			expect(errorHandler).toHaveBeenCalledTimes(1);
		});
	});

	describe('Integration Scenarios', () => {
		test('should handle realistic CLI output simulation', async () => {
			const stream = createStream([
				'Starting process...\n',
				'',
				'Step 1: Loading config\n',
				'Step 2: Con',
				'necting to server\n',
				'\n',
				'  Progress: 50%  \n',
				'  Progress: 100%  \n',
				'\n',
				'Complete!',
			]);

			const lines: string[] = [];
			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual([
				'Starting process...',
				'Step 1: Loading config',
				'Step 2: Connecting to server',
				'  Progress: 50%  ',
				'  Progress: 100%  ',
				'Complete!',
			]);
		});

		test('should handle JSON streaming', async () => {
			const jsonChunks = [
				'{"name":"test",',
				'"value":123,',
				'"items":[1,2,3]}\n',
				'{"name":"test2",',
				'"value":456}\n',
			];

			const stream = createStream(jsonChunks);
			const lines: string[] = [];

			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual([
				'{"name":"test","value":123,"items":[1,2,3]}',
				'{"name":"test2","value":456}',
			]);

			// Verify we can parse the JSON
			const parsed = lines.map((line) => JSON.parse(line));
			expect(parsed).toEqual([
				{ name: 'test', value: 123, items: [1, 2, 3] },
				{ name: 'test2', value: 456 },
			]);
		});

		test('should handle binary data chunks with text content', async () => {
			const encoder = new TextEncoder();
			const stream = new ReadableStream<Uint8Array>({
				async pull(controller) {
					controller.enqueue(encoder.encode('line1\n'));
					controller.enqueue(encoder.encode('line2\n'));
					controller.enqueue(encoder.encode('line3'));
					controller.close();
				},
			});

			const lines: string[] = [];
			await readStreamLines(stream, (line) => lines.push(line));

			expect(lines).toEqual(['line1', 'line2', 'line3']);
		});
	});
});
