import type { ClaudeCodeService, ClaudeProcessHandle, ClaudeModel } from "./ClaudeCodeService";

/**
 * RealClaudeCodeService - Production implementation using actual Claude CLI
 *
 * Spawns the Claude Code CLI with appropriate flags for JSON streaming.
 * Respects CLAUDE_DIR environment variable to set working directory.
 */
export class RealClaudeCodeService implements ClaudeCodeService {
  spawn(model: ClaudeModel): ClaudeProcessHandle {
    const claudeDir = process.env.CLAUDE_DIR;

    const claudeProcess = Bun.spawn(
      [
        "claude",
        "--print",
        "--verbose",
        "--input-format=stream-json",
        "--output-format=stream-json",
        `--model=${model}`,
      ],
      {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        ...(claudeDir && { cwd: claudeDir }),
      },
    );

    return {
      stdin: claudeProcess.stdin,
      stdout: claudeProcess.stdout,
      stderr: claudeProcess.stderr,
    };
  }
}
