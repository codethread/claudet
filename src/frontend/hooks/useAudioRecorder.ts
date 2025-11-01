import { useCallback, useRef, useState } from 'react';

type RecordingState = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'error';

interface UseAudioRecorderReturn {
	state: RecordingState;
	error: string | null;
	startRecording: () => Promise<void>;
	stopRecording: () => Promise<string>;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
	const [state, setState] = useState<RecordingState>('idle');
	const [error, setError] = useState<string | null>(null);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);

	const startRecording = useCallback(async () => {
		try {
			setError(null);

			// Request microphone access
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;

			// Create MediaRecorder with WebM/Opus (Chromium default)
			const mediaRecorder = new MediaRecorder(stream, {
				mimeType: 'audio/webm;codecs=opus',
			});
			mediaRecorderRef.current = mediaRecorder;

			// Reset chunks
			chunksRef.current = [];

			// Collect audio chunks
			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					chunksRef.current.push(event.data);
				}
			};

			// Start recording
			mediaRecorder.start();
			setState('recording');
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to start recording';
			setError(message);
			setState('error');
			throw err;
		}
	}, []);

	const stopRecording = useCallback(async (): Promise<string> => {
		return new Promise((resolve, reject) => {
			const mediaRecorder = mediaRecorderRef.current;
			if (!mediaRecorder || mediaRecorder.state === 'inactive') {
				reject(new Error('No active recording'));
				return;
			}

			// Handle recording stop
			mediaRecorder.onstop = async () => {
				try {
					// Cleanup media stream
					if (streamRef.current) {
						streamRef.current.getTracks().forEach((track) => {
							track.stop();
						});
						streamRef.current = null;
					}

					// Create audio blob
					const audioBlob = new Blob(chunksRef.current, {
						type: 'audio/webm',
					});

					// Check file size (must be > 1000 bytes like PersonalConfigs script)
					if (audioBlob.size < 1000) {
						throw new Error('Recording too short or empty');
					}

					// Upload and transcribe
					setState('uploading');

					const formData = new FormData();
					formData.append('audio', audioBlob, 'recording.webm');

					const response = await fetch('/api/transcribe', {
						method: 'POST',
						body: formData,
					});

					if (!response.ok) {
						throw new Error(`Transcription failed: ${response.status} ${response.statusText}`);
					}

					setState('transcribing');
					const data = await response.json();

					setState('idle');
					resolve(data.text);
				} catch (err) {
					const message = err instanceof Error ? err.message : 'Transcription failed';
					setError(message);
					setState('error');
					reject(err);
				}
			};

			// Stop recording
			mediaRecorder.stop();
		});
	}, []);

	return {
		state,
		error,
		startRecording,
		stopRecording,
	};
}
