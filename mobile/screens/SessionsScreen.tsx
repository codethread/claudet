import {
	StyleSheet,
	KeyboardAvoidingView,
	Platform,
	useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../AppContext';
import { ChatArea } from '../components/ChatArea';
import { EmptyProjectView } from '../components/EmptyProjectView';
import { Header } from '../components/Header';
import { InputBar } from '../components/InputBar';

export function SessionsScreen() {
	const isDark = useColorScheme() === 'dark';
	const insets = useSafeAreaInsets();

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
		send,
		onScroll,
	} = useAppContext();

	const currentMessages = currentSessionId
		? (messagesBySession.get(currentSessionId) ?? [])
		: [];

	const currentSession = sessions.find((s) => s.id === currentSessionId) ?? null;
	const isDangerousMode = currentSession?.permissionMode === 'dangerouslySkipPermissions';

	const hour = new Date().getHours();
	const greeting =
		hour < 12 ? 'Good morning, Adam' : hour < 18 ? 'Good afternoon, Adam' : 'Good evening, Adam';

	return (
		<KeyboardAvoidingView
			style={[styles.container, { backgroundColor: isDark ? '#000' : '#f5f5f5' }]}
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
		>
			<Header
				greeting={greeting}
				onNewSession={handleNewSession}
				dangerousMode={isDangerousMode}
			/>

			{currentProjectId ? (
				<>
					<ChatArea
						messages={currentMessages}
						loading={loading}
						loadingMessages={loadingMessages}
						error={error}
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
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
