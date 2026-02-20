import { useState } from 'react';
import {
	StyleSheet,
	KeyboardAvoidingView,
	Platform,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../AppContext';
import { ChatArea } from '../components/ChatArea';
import { EmptyProjectView } from '../components/EmptyProjectView';
import { Header } from '../components/Header';
import { InputBar } from '../components/InputBar';
import { SessionActionModal } from '../components/SessionActionModal';
import { SessionStrip } from '../components/SessionStrip';
import type { Session } from '../types';

export function SessionsScreen() {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const [actionSession, setActionSession] = useState<Session | null>(null);

	const {
		sessions,
		currentSessionId,
		messagesBySession,
		input,
		loading,
		error,
		loadingMessages,
		showScrollButton,
		baseDir,
		projects,
		currentProjectId,
		scrollRef,
		setInput,
		setCurrentSessionId,
		setShowScrollButton,
		handleSelectProject,
		handleNewSession,
		handleRenameSession,
		handleDeleteSession,
		dismissError,
		send,
		onScroll,
	} = useAppContext();

	const currentMessages = currentSessionId
		? (messagesBySession.get(currentSessionId) ?? [])
		: [];

	const currentSession = sessions.find((s) => s.id === currentSessionId) ?? null;
	const isDangerousMode = currentSession?.permissionMode === 'dangerouslySkipPermissions';

	const projectSessions = currentProjectId
		? sessions.filter((s) => s.projectPath === currentProjectId)
		: [];

	const hour = new Date().getHours();
	const greeting =
		hour < 12 ? 'Good morning, Adam' : hour < 18 ? 'Good afternoon, Adam' : 'Good evening, Adam';

	return (
		<KeyboardAvoidingView
			style={[styles.container, { backgroundColor: theme.colors.background }]}
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
		>
			<Header
				greeting={greeting}
				onNewSession={handleNewSession}
				dangerousMode={isDangerousMode}
			/>

			{currentProjectId ? (
				<>
					<SessionStrip
						sessions={projectSessions}
						currentSessionId={currentSessionId}
						onSelectSession={setCurrentSessionId}
						onNewSession={handleNewSession}
						onLongPressSession={(s) => setActionSession(s)}
					/>

					<ChatArea
						messages={currentMessages}
						loading={loading}
						loadingMessages={loadingMessages}
						error={error}
						onDismissError={dismissError}
						scrollRef={scrollRef}
						showScrollButton={showScrollButton}
						onScrollToBottom={() => {
							scrollRef.current?.scrollToEnd({ animated: true });
							setShowScrollButton(false);
						}}
						onScroll={onScroll}
						bottomOffset={76 + insets.bottom}
					/>

					<InputBar
						input={input}
						onChangeInput={setInput}
						onSend={send}
						editable={!!currentSessionId && !loading}
						canSend={!!currentSessionId && !loading && !!input.trim()}
						bottomInset={insets.bottom}
					/>
				</>
			) : (
				<EmptyProjectView
					baseDir={baseDir}
					projects={projects}
					onOpenSettings={() => {}}
					onSelectProject={handleSelectProject}
				/>
			)}

			<SessionActionModal
				session={actionSession}
				onClose={() => setActionSession(null)}
				onRename={handleRenameSession}
				onDelete={handleDeleteSession}
			/>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
