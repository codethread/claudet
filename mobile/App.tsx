import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
	Animated,
	StyleSheet,
	Text,
	View,
	TextInput,
	Pressable,
	ScrollView,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	useColorScheme,
	type NativeSyntheticEvent,
	type NativeScrollEvent,
} from 'react-native';
import { SERVER_URL, fetchSessions, fetchModels, createSession, sendChat } from './api';
import { ChatMessage } from './components/ChatMessage';
import { SettingsDrawer } from './components/SettingsDrawer';
import type { Message, Session } from './types';

export default function App() {
	const colorScheme = useColorScheme();
	const isDark = colorScheme === 'dark';

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

	const scrollRef = useRef<ScrollView>(null);
	const isNearBottomRef = useRef(true);
	const bounceAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!showScrollButton) return;
		bounceAnim.setValue(0);
		Animated.sequence([
			Animated.timing(bounceAnim, { toValue: 7, duration: 140, useNativeDriver: true }),
			Animated.timing(bounceAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
			Animated.timing(bounceAnim, { toValue: 4, duration: 110, useNativeDriver: true }),
			Animated.timing(bounceAnim, { toValue: 0, duration: 110, useNativeDriver: true }),
		]).start();
	}, [showScrollButton, bounceAnim]);

	const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
		const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
		const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
		const near = distanceFromBottom < 80;
		isNearBottomRef.current = near;
		if (near) setShowScrollButton(false);
	};

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
					// Auto-create first session
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

	const send = async () => {
		if (!input.trim() || !currentSessionId || loading) return;

		const userMessage = input.trim();
		setInput('');
		appendMessage(currentSessionId, { role: 'user', content: userMessage });
		isNearBottomRef.current = true; // user just sent, always scroll
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

	const bg = isDark ? '#000' : '#f5f5f5';
	const headerBg = isDark ? '#1c1c1e' : '#fff';
	const headerBorder = isDark ? '#3a3a3c' : '#e0e0e0';
	const headerText = isDark ? '#fff' : '#000';
	const inputBg = isDark ? '#2c2c2e' : '#f0f0f0';
	const inputText = isDark ? '#fff' : '#000';
	const inputBorder = isDark ? '#3a3a3c' : '#e0e0e0';

	const hour = new Date().getHours();
	const greeting =
		hour < 12 ? 'Good morning, Adam' : hour < 18 ? 'Good afternoon, Adam' : 'Good evening, Adam';

	return (
		<KeyboardAvoidingView
			style={[styles.container, { backgroundColor: bg }]}
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
		>
			<StatusBar style={isDark ? 'light' : 'dark'} />

			{/* Header */}
			<View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
				<Pressable style={styles.headerButton} onPress={() => setSettingsOpen(true)} hitSlop={8}>
					<Text style={[styles.headerIcon, { color: headerText }]}>☰</Text>
				</Pressable>
				<Text style={[styles.headerTitle, { color: headerText }]} numberOfLines={1}>
					{greeting}
				</Text>
				<Pressable style={styles.headerButton} onPress={handleNewSession} hitSlop={8}>
					<Text style={[styles.headerIcon, { color: headerText }]}>＋</Text>
				</Pressable>
			</View>

			{/* Chat area */}
			<ScrollView
				ref={scrollRef}
				style={styles.messages}
				contentContainerStyle={styles.messagesContent}
				keyboardShouldPersistTaps="handled"
				onScroll={handleScroll}
				scrollEventThrottle={100}
			>
				{currentMessages.length === 0 && !error && (
					<Text style={styles.emptyText}>Send a message to start chatting</Text>
				)}
				{currentMessages.map((msg, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: messages are append-only, index is stable
					<ChatMessage key={i} message={msg} />
				))}
				{loading && (
					<View style={styles.loadingRow}>
						<ActivityIndicator size="small" color="#666" />
						<Text style={styles.loadingText}>Thinking...</Text>
					</View>
				)}
				{error && <Text style={styles.errorText}>{error}</Text>}
			</ScrollView>

			{showScrollButton && (
				<Animated.View
					style={[styles.scrollButtonWrap, { transform: [{ translateY: bounceAnim }] }]}
				>
					<Pressable
						style={styles.scrollButton}
						onPress={() => {
							scrollRef.current?.scrollToEnd({ animated: true });
							setShowScrollButton(false);
						}}
					>
						<Text style={styles.scrollButtonText}>↓</Text>
					</Pressable>
				</Animated.View>
			)}

			{/* Input row */}
			<View style={[styles.inputRow, { backgroundColor: headerBg, borderTopColor: inputBorder }]}>
				<TextInput
					style={[styles.input, { backgroundColor: inputBg, color: inputText }]}
					value={input}
					onChangeText={setInput}
					placeholder="Type a message..."
					placeholderTextColor={isDark ? '#636366' : '#999'}
					multiline
					editable={!!currentSessionId && !loading}
				/>
				<Pressable
					style={[
						styles.sendButton,
						(!currentSessionId || loading || !input.trim()) && styles.sendButtonDisabled,
					]}
					onPress={send}
					disabled={!currentSessionId || loading || !input.trim()}
				>
					<Text style={styles.sendButtonText}>→</Text>
				</Pressable>
			</View>

			{/* Settings drawer */}
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
	header: {
		paddingTop: 56,
		paddingBottom: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	headerButton: {
		padding: 4,
		minWidth: 36,
		alignItems: 'center',
	},
	headerIcon: {
		fontSize: 22,
		fontWeight: '500',
	},
	headerTitle: {
		fontSize: 17,
		fontWeight: '600',
		flex: 1,
		textAlign: 'center',
	},
	messages: {
		flex: 1,
	},
	messagesContent: {
		padding: 16,
		gap: 4,
	},
	emptyText: {
		textAlign: 'center',
		color: '#999',
		marginTop: 40,
		fontSize: 15,
	},
	loadingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingVertical: 4,
		alignSelf: 'flex-start',
	},
	loadingText: {
		color: '#666',
		fontSize: 14,
	},
	errorText: {
		color: '#cc0000',
		fontSize: 13,
		paddingVertical: 4,
	},
	inputRow: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		padding: 12,
		gap: 8,
		borderTopWidth: 1,
	},
	input: {
		flex: 1,
		minHeight: 40,
		maxHeight: 120,
		borderRadius: 20,
		paddingHorizontal: 16,
		paddingVertical: 10,
		fontSize: 15,
	},
	sendButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#007AFF',
		justifyContent: 'center',
		alignItems: 'center',
	},
	sendButtonDisabled: {
		backgroundColor: '#ccc',
	},
	sendButtonText: {
		color: '#fff',
		fontSize: 18,
		fontWeight: '700',
	},
	scrollButtonWrap: {
		position: 'absolute',
		bottom: 76,
		left: 0,
		right: 0,
		alignItems: 'center',
	},
	scrollButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#007AFF',
		justifyContent: 'center',
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	scrollButtonText: {
		color: '#fff',
		fontSize: 20,
		fontWeight: '700',
		lineHeight: 24,
	},
});
