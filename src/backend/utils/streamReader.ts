/**
 * Utility for reading lines from ReadableStream<Uint8Array>
 *
 * This module provides a reusable stream reader that:
 * - Decodes Uint8Array chunks to text
 * - Buffers incomplete lines across chunks
 * - Splits on newlines and filters empty lines
 * - Invokes a callback for each complete line
 * - Handles the final buffer content after stream ends
 *
 * Used for processing Claude CLI output streams in tests and production.
 */

/**
 * Options for configuring stream reader behavior
 */
export interface StreamReaderOptions {
	/**
	 * Custom error handler. If not provided, errors are logged to console.error
	 */
	onError?: (error: unknown) => void;

	/**
	 * Optional prefix for debug logging. If provided, each line will be logged
	 * with this prefix (truncated to 100 chars for readability)
	 */
	logPrefix?: string;
}

/**
 * Reads lines from a ReadableStream<Uint8Array> and invokes callback for each line
 *
 * This function:
 * - Uses TextDecoder with streaming mode to handle multi-byte characters
 * - Buffers incomplete lines between chunks
 * - Splits on newlines (\n) and filters empty lines
 * - Optionally logs each line with a prefix
 * - Processes any remaining buffer content after stream ends
 *
 * @param stream - The ReadableStream to read from
 * @param onLine - Callback invoked for each non-empty line
 * @param options - Optional configuration for error handling and logging
 *
 * @example
 * ```typescript
 * await readStreamLines(
 *   processHandle.stdout,
 *   (line) => console.log('Got line:', line),
 *   { logPrefix: '[Process]' }
 * );
 * ```
 */
export async function readStreamLines(
	stream: ReadableStream<Uint8Array>,
	onLine: (line: string) => void,
	options?: StreamReaderOptions,
): Promise<void> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			// Decode chunk with stream mode to handle multi-byte characters across chunks
			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');

			// Keep the last incomplete line in the buffer
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (!line.trim()) continue;

				// Optional debug logging
				if (options?.logPrefix) {
					console.log(`${options.logPrefix} ${line.substring(0, 100)}...`);
				}

				onLine(line);
			}
		}

		// Process any remaining content in buffer after stream ends
		if (buffer.trim()) {
			if (options?.logPrefix) {
				console.log(`${options.logPrefix} ${buffer.substring(0, 100)}...`);
			}
			onLine(buffer);
		}
	} catch (error) {
		if (options?.onError) {
			options.onError(error);
		} else {
			console.error('Error reading stream:', error);
		}
	}
}
