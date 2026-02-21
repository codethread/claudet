import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Transcription configuration
export const WHISPER_MODEL = join(homedir(), 'dev/models/ggml-medium.bin');

/**
 * Transcribe audio file using whisper-cli
 * Converts WebM to WAV format and runs whisper transcription
 */
export async function transcribeAudioFile(audioPath: string): Promise<string> {
	const fileSize = statSync(audioPath).size;

	if (fileSize < 1000) {
		throw new Error('Recording too short or empty');
	}

	// Check if whisper model exists
	if (!existsSync(WHISPER_MODEL)) {
		throw new Error(`Whisper model not found at ${WHISPER_MODEL}`);
	}

	const runProc = (cmd: string, args: string[]): Promise<{ stdout: string; exitCode: number }> =>
		new Promise((resolve) => {
			const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
			const chunks: Buffer[] = [];
			proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
			proc.on('close', (code) =>
				resolve({ stdout: Buffer.concat(chunks).toString('utf8'), exitCode: code ?? 1 }),
			);
		});

	// Convert WebM to WAV using ffmpeg
	const wavPath = audioPath.replace(/\.\w+$/, '.wav');
	const ffmpeg = await runProc('ffmpeg', [
		'-i', audioPath,
		'-ar', '16000', // 16kHz sample rate
		'-ac', '1',    // mono
		'-f', 'wav',
		wavPath,
	]);

	if (ffmpeg.exitCode !== 0) {
		throw new Error('Failed to convert audio to WAV format');
	}

	// Run whisper-cli transcription
	const whisper = await runProc('whisper-cli', ['-m', WHISPER_MODEL, '-nt', '-np', wavPath]);

	// Clean up WAV file
	await unlink(wavPath).catch(() => {});

	if (whisper.exitCode !== 0) {
		throw new Error('Whisper transcription failed');
	}

	return whisper.stdout.trim();
}
