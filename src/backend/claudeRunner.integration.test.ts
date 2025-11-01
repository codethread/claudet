/**
 * Integration test for Real Claude Code CLI
 *
 * This test verifies that our mock (FakeClaudeCodeService) behaves
 * similarly to the real Claude Code CLI.
 *
 * Run with: bun test claudeRunner.integration.test.ts
 *
 * Note: This test requires the `claude` CLI to be installed and will
 * make actual API calls to Claude.
 */

import { test, expect, describe } from 'bun:test';
import { createActor } from 'xstate';
import { createClaudeRunnerMachine } from './claudeRunner';
import { RealClaudeCodeService } from './services/RealClaudeCodeService';

describe('Integration: Real Claude Code CLI', () => {
	test(
		'should get deterministic response from real Claude CLI',
		async () => {
			// Create machine with real service
			const realService = new RealClaudeCodeService();
			const machine = createClaudeRunnerMachine(realService);
			const actor = createActor(machine);

			actor.start();
			actor.send({ type: 'START_PROCESS' });

			// Wait for process to start
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Set up promise to capture response
			const responsePromise = new Promise<{
				response: string;
				logs: string[];
			}>((resolve, reject) => {
				const messageId = crypto.randomUUID();

				// Send a very deterministic message
				actor.send({
					type: 'SEND_MESSAGE',
					message: 'What is 2 + 2? Respond with ONLY the number, no explanation.',
					messageId,
				});

				// Set up promise handlers
				const context = actor.getSnapshot().context;
				const request = context.pendingRequests.get(messageId);
				if (request) {
					request.resolve = resolve;
					request.reject = reject;
				} else {
					reject(new Error('Failed to create request'));
				}

				// Timeout after 30 seconds
				setTimeout(() => {
					reject(new Error('Integration test timeout'));
				}, 30000);
			});

			// Start reading output
			const readOutput = async () => {
				const context = actor.getSnapshot().context;
				if (!context.processHandle) return;

				const reader = context.processHandle.stdout.getReader();
				const decoder = new TextDecoder();
				let buffer = '';

				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() || '';

						for (const line of lines) {
							if (!line.trim()) continue;
							actor.send({ type: 'OUTPUT_LINE', line });
						}
					}
				} catch (error) {
					console.error('Error reading output:', error);
				}
			};

			readOutput();

			// Wait for response
			const result = await responsePromise;

			// Verify we got a response
			expect(result.response).toBeDefined();
			expect(result.response.length).toBeGreaterThan(0);

			// Verify the response contains "4" (the answer to 2+2)
			expect(result.response).toMatch(/4/);

			// Verify logs were captured
			expect(result.logs.length).toBeGreaterThan(0);

			// Verify the logs contain expected message types
			const logsString = result.logs.join('\n');
			expect(logsString).toMatch(/"type":"system"/);
			expect(logsString).toMatch(/"type":"assistant"/);
			expect(logsString).toMatch(/"type":"result"/);

			// Stop the actor
			actor.stop();

			console.log('✅ Integration test passed!');
			console.log(`Response: ${result.response}`);
			console.log(`Logs captured: ${result.logs.length} lines`);
		},
		{ timeout: 35000 },
	);

	test(
		'should handle session IDs correctly',
		async () => {
			const realService = new RealClaudeCodeService();
			const machine = createClaudeRunnerMachine(realService);
			const actor = createActor(machine);

			actor.start();
			actor.send({ type: 'START_PROCESS' });

			await new Promise((resolve) => setTimeout(resolve, 500));

			let capturedSessionId: string | undefined;

			const responsePromise = new Promise<void>((resolve, reject) => {
				const messageId = crypto.randomUUID();

				actor.send({
					type: 'SEND_MESSAGE',
					message: 'Say hello',
					messageId,
				});

				const context = actor.getSnapshot().context;
				const request = context.pendingRequests.get(messageId);
				if (request) {
					request.resolve = (value) => {
						// Capture session ID from logs
						const sessionIdMatch = value.logs.join('\n').match(/"session_id":"([^"]+)"/);
						capturedSessionId = sessionIdMatch?.[1];
						resolve();
					};
					request.reject = reject;
				} else {
					reject(new Error('Failed to create request'));
				}

				setTimeout(() => reject(new Error('Timeout')), 30000);
			});

			// Read output
			const readOutput = async () => {
				const context = actor.getSnapshot().context;
				if (!context.processHandle) return;

				const reader = context.processHandle.stdout.getReader();
				const decoder = new TextDecoder();
				let buffer = '';

				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() || '';

						for (const line of lines) {
							if (!line.trim()) continue;
							actor.send({ type: 'OUTPUT_LINE', line });
						}
					}
				} catch (error) {
					console.error('Error reading output:', error);
				}
			};

			readOutput();
			await responsePromise;

			// Verify session ID was captured
			expect(capturedSessionId).toBeDefined();
			expect(capturedSessionId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
			);

			actor.stop();

			console.log('✅ Session ID test passed!');
			console.log(`Captured session ID: ${capturedSessionId}`);
		},
		{ timeout: 35000 },
	);
});
