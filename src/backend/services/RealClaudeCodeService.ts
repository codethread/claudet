import type { ClaudeCodeService, ClaudeProcessHandle } from "./ClaudeCodeService";

/**
 * RealClaudeCodeService - Production implementation using actual Claude CLI
 *
 * Spawns the Claude Code CLI with appropriate flags for JSON streaming.
 */
export class RealClaudeCodeService implements ClaudeCodeService {
  spawn(): ClaudeProcessHandle {
    const process = Bun.spawn(
      [
        "claude",
        "--print",
        "--verbose",
        "--input-format=stream-json",
        "--output-format=stream-json",
        "--model=haiku",
      ],
      {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    return {
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
    };
  }
}
