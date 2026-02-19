import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
	StyleSheet,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
	useColorScheme,
	type NativeSyntheticEvent,
	type NativeScrollEvent,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SERVER_URL, fetchSessions, fetchModels, createSession, sendChat, fetchSessionMessages } from './api';
import { ChatArea } from './components/ChatArea';
import { Header } from './components/Header';
import { InputBar } from './components/InputBar';
import { SettingsDrawer } from './components/SettingsDrawer';
import type { Message, Session } from './types';

export default function App() {
	return (
		<SafeAreaProvider>
			<AppContent />
		</SafeAreaProvider>
	);
}

function AppContent() {
	const isDark = useColorScheme() === 'dark';
	const insets = useSafeAreaInsets();

	const [sessions, setSessions] = useState<Session[]>([]);
	const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
	const [messagesBySession, setMessagesBySession] = useState<Map<string, Message[]>>(new Map());
	const [selectedModel, setSelectedModel] = useState<string>('haiku');
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [connected, setConnected] = useState(false);
	const [showScrollButton, setShowScrollButton] = useState(false);
	const [loadingMessages, setLoadingMessages] = useState(false);

	const scrollRef = useRef<ScrollView>(null);
	const fetchedSessionsRef = useRef<Set<string>>(new Set());
	const isNearBottomRef = useRef(true);

	const currentMessages: Message[] = currentSessionId
		? (messagesBySession.get(currentSessionId) ?? [])
		: [];

	const appendMessage = (sessionId: string, message: Message) => {
		setMessagesBySession((prev) => {
			const next = new Map(prev);
			next.set(sessionId, [...(prev.get(sessionId) ?? []), message]);
			return next;
		});
	};

	const handleNewSession = useCallback(async () => {
		try {
			const session = await createSession(selectedModel);
			setSessions((prev) => [session, ...prev]);
			setCurrentSessionId(session.id);
			setError(null);
		} catch (e) {
			setError(`Failed to create session: ${e instanceof Error ? e.message : 'Unknown error'}`);
		}
	}, [selectedModel]);

	// On mount: load models + sessions, auto-create if none
	useEffect(() => {
		let cancelled = false;

		async function init() {
			try {
				const [modelsData, existingSessions] = await Promise.all([fetchModels(), fetchSessions()]);

				if (cancelled) return;

				setSelectedModel(modelsData.default);
				setConnected(true);

				if (existingSessions.length > 0) {
					setSessions(existingSessions);
					setCurrentSessionId(existingSessions[0]?.id ?? null);
				} else {
					const session = await createSession(modelsData.default);
					if (!cancelled) {
						setSessions([session]);
						setCurrentSessionId(session.id);
					}
				}
			} catch (e) {
				if (!cancelled) {
					setError(
						`Failed to connect to ${SERVER_URL}: ${e instanceof Error ? e.message : 'Unknown error'}`,
					);
					setConnected(false);
				}
			}
		}

		void init();
		return () => {
			cancelled = true;
		};
	}, []);

	// Fetch message history from server when switching to a session we haven't loaded yet
	useEffect(() => {
		if (!currentSessionId) return;
		if (fetchedSessionsRef.current.has(currentSessionId)) return;

		fetchedSessionsRef.current.add(currentSessionId);
		setLoadingMessages(true);

		fetchSessionMessages(currentSessionId)
			.then((messages) => {
				if (messages.length > 0) {
					setMessagesBySession((prev) => {
						const next = new Map(prev);
						next.set(currentSessionId, messages);
						return next;
					});
				}
			})
			.catch(() => {
				// Silently ignore — server may not have history yet
			})
			.finally(() => setLoadingMessages(false));
	}, [currentSessionId]);

	const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
		const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
		const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
		const near = distanceFromBottom < 80;
		isNearBottomRef.current = near;
		if (near) setShowScrollButton(false);
	};

	const send = async () => {
		if (!input.trim() || !currentSessionId || loading) return;

		const userMessage = input.trim();
		setInput('');
		appendMessage(currentSessionId, { role: 'user', content: userMessage });
		isNearBottomRef.current = true;
		setLoading(true);
		setError(null);

		try {
			const response = await sendChat(currentSessionId, userMessage);
			appendMessage(currentSessionId, { role: 'assistant', content: response });
		} catch (e) {
			setError(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
		} finally {
			setLoading(false);
			if (isNearBottomRef.current) {
				setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
			} else {
				setShowScrollButton(true);
			}
		}
	};

	const hour = new Date().getHours();
	const greeting =
		hour < 12 ? 'Good morning, Adam' : hour < 18 ? 'Good afternoon, Adam' : 'Good evening, Adam';

	return (
		<KeyboardAvoidingView
			style={[styles.container, { backgroundColor: isDark ? '#000' : '#f5f5f5' }]}
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
		>
			<StatusBar style={isDark ? 'light' : 'dark'} />

			<Header
				greeting={greeting}
				onOpenSettings={() => setSettingsOpen(true)}
				onNewSession={handleNewSession}
			/>

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
				onScroll={handleScroll}
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

			<SettingsDrawer
				visible={settingsOpen}
				onClose={() => setSettingsOpen(false)}
				sessions={sessions}
				currentSessionId={currentSessionId}
				selectedModel={selectedModel}
				connected={connected}
				onSelectSession={(id) => setCurrentSessionId(id)}
				onNewSession={handleNewSession}
				onSelectModel={(model) => setSelectedModel(model)}
			/>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
