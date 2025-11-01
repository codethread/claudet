import { Loader2, Mic, Square } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MicButtonProps {
	onTranscribe: (text: string) => void;
	disabled?: boolean;
}

export function MicButton({ onTranscribe, disabled }: MicButtonProps) {
	const { state, error, startRecording, stopRecording } = useAudioRecorder();

	const isRecording = state === "recording";
	const isProcessing = state === "uploading" || state === "transcribing";
	const isIdle = state === "idle";

	const handleClick = async () => {
		try {
			if (isRecording) {
				// Stop recording and get transcription
				const text = await stopRecording();
				onTranscribe(text);
			} else if (isIdle) {
				// Start recording
				await startRecording();
			}
		} catch (err) {
			console.error("Recording error:", err);
		}
	};

	return (
		<div className="flex flex-col gap-1">
			<Button
				type="button"
				variant="outline"
				size="icon"
				onClick={handleClick}
				disabled={disabled || isProcessing}
				className={cn(
					isRecording &&
						"bg-red-500 hover:bg-red-600 border-red-600 text-white animate-pulse",
				)}
				aria-label={
					isRecording
						? "Stop recording"
						: isProcessing
							? "Processing audio"
							: "Start recording"
				}
			>
				{isProcessing ? (
					<Loader2 className="animate-spin" />
				) : isRecording ? (
					<Square />
				) : (
					<Mic />
				)}
			</Button>
			{error && (
				<span className="text-xs text-red-500 dark:text-red-400 absolute -bottom-6 left-0 whitespace-nowrap">
					{error}
				</span>
			)}
		</div>
	);
}
