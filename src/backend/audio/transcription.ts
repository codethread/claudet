import { existsSync } from 'node:fs';
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
	// Check file size (must be > 1000 bytes like PersonalConfigs script)
	const audioFile = Bun.file(audioPath);
	const fileSize = audioFile.size;

	if (fileSize < 1000) {
		throw new Error('Recording too short or empty');
	}

	// Check if whisper model exists
	if (!existsSync(WHISPER_MODEL)) {
		throw new Error(`Whisper model not found at ${WHISPER_MODEL}`);
	}

	// Convert WebM to WAV using ffmpeg
	const wavPath = audioPath.replace(/\.\w+$/, '.wav');
	const ffmpegProc = Bun.spawn(
		[
			'ffmpeg',
			'-i',
			audioPath,
			'-ar',
			'16000', // 16kHz sample rate
			'-ac',
			'1', // mono
			'-f',
			'wav',
			wavPath,
		],
		{
			stdout: 'pipe',
			stderr: 'pipe',
		},
	);

	await ffmpegProc.exited;

	if (ffmpegProc.exitCode !== 0) {
		throw new Error('Failed to convert audio to WAV format');
	}

	// Run whisper-cli transcription
	const whisperProc = Bun.spawn(['whisper-cli', '-m', WHISPER_MODEL, '-nt', '-np', wavPath], {
		stdout: 'pipe',
		stderr: 'pipe',
	});

	// Collect transcription output
	const transcription = await new Response(whisperProc.stdout).text();

	await whisperProc.exited;

	if (whisperProc.exitCode !== 0) {
		throw new Error('Whisper transcription failed');
	}

	// Clean up WAV file
	await unlink(wavPath).catch(() => {});

	return transcription.trim();
}
