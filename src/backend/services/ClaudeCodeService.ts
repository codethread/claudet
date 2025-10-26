/**
 * ClaudeCodeService - Abstraction for Claude Code CLI process
 *
 * This interface allows dependency injection for testing purposes.
 * In production, we use RealClaudeCodeService which spawns actual Claude CLI.
 * In tests, we use FakeClaudeCodeService which provides controllable mock streams.
 */

export interface ClaudeProcessHandle {
  stdin: WritableStreamDefaultWriter | { write: (data: string) => void };
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
}

export type ClaudeModel = "haiku" | "sonnet";

export interface ClaudeCodeService {
  /**
   * Spawn a Claude Code CLI process (or mock equivalent)
   * Returns handles to stdin, stdout, stderr streams
   * @param model - The Claude model to use (haiku, sonnet, or opus)
   */
  spawn(model: ClaudeModel): ClaudeProcessHandle;
}

/**
 * Get the default model based on NODE_ENV
 * Production: sonnet (more capable)
 * Development: haiku (faster, cheaper)
 */
export function getDefaultModel(): ClaudeModel {
  return process.env.NODE_ENV === "production" ? "sonnet" : "haiku";
}
