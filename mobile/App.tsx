import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
	type ScrollView,
	type NativeSyntheticEvent,
	type NativeScrollEvent,
	useColorScheme,
	Text,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
	fetchSessions,
	fetchModels,
	fetchSettings,
	saveSettings as apiSaveSettings,
	updateSession as apiUpdateSession,
	fetchProjects,
	createSession,
	sendChat,
	fetchSessionMessages,
	SERVER_URL,
} from './api';
import { AppContext } from './AppContext';
import { SessionsScreen } from './screens/SessionsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import type { Message, PermissionMode, Project, Session } from './types';

const Tab = createBottomTabNavigator();

function AppStateProvider({ children }: { children: React.ReactNode }) {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
	const [messagesBySession, setMessagesBySession] = useState<Map<string, Message[]>>(new Map());
	const [selectedModel, setSelectedModel] = useState<string>('haiku');
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [connected, setConnected] = useState(false);
	const [showScrollButton, setShowScrollButton] = useState(false);
	const [loadingMessages, setLoadingMessages] = useState(false);

	const [baseDir, setBaseDir] = useState<string | null>(null);
	const [projects, setProjects] = useState<Project[]>([]);
	const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

	const scrollRef = useRef<ScrollView>(null);
	const fetchedSessionsRef = useRef<Set<string>>(new Set());
	const isNearBottomRef = useRef(true);

	const appendMessage = (sessionId: string, message: Message) => {
		setMessagesBySession((prev) => {
			const next = new Map(prev);
			next.set(sessionId, [...(prev.get(sessionId) ?? []), message]);
			return next;
		});
	};

	const handleSelectProject = useCallback((id: string) => {
		setCurrentProjectId(id);
		setCurrentSessionId(null);
	}, []);

	const handleNewSession = useCallback(async () => {
		if (!currentProjectId) return;
		try {
			const session = await createSession(selectedModel, currentProjectId);
			setSessions((prev) => [session, ...prev]);
			setCurrentSessionId(session.id);
			setError(null);
		} catch (e) {
			setError(`Failed to create session: ${e instanceof Error ? e.message : 'Unknown error'}`);
		}
	}, [selectedModel, currentProjectId]);

	const handleSaveBaseDir = useCallback(async (value: string) => {
		const settings = await apiSaveSettings(value);
		setBaseDir(settings.baseDir);
		if (settings.baseDir) {
			const discovered = await fetchProjects();
			setProjects(discovered);
		}
	}, []);

	const handleSetSessionPermissionMode = useCallback(
		async (mode: PermissionMode) => {
			if (!currentSessionId) return;
			const updated = await apiUpdateSession(currentSessionId, { permissionMode: mode });
			setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
		},
		[currentSessionId],
	);

	// On mount: load models + settings in parallel; if baseDir set, also load projects + sessions
	useEffect(() => {
		let cancelled = false;

		async function init() {
			try {
				const [modelsData, settings] = await Promise.all([fetchModels(), fetchSettings()]);

				if (cancelled) return;

				setSelectedModel(modelsData.default);
				setConnected(true);
				setBaseDir(settings.baseDir);

				if (settings.baseDir) {
					const [discovered, existingSessions] = await Promise.all([
						fetchProjects(),
						fetchSessions(),
					]);

					if (cancelled) return;

					setProjects(discovered);
					setSessions(existingSessions);
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

	// Fetch message history when switching to a session we haven't loaded yet
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

	const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
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

	return (
		<AppContext.Provider
			value={{
				sessions,
				currentSessionId,
				messagesBySession,
				selectedModel,
				input,
				loading,
				error,
				connected,
				showScrollButton,
				loadingMessages,
				baseDir,
				projects,
				currentProjectId,
				setInput,
				setCurrentSessionId,
				setSelectedModel,
				handleSelectProject,
				handleNewSession,
				handleSaveBaseDir,
				handleSetSessionPermissionMode,
				send,
				scrollRef,
				setShowScrollButton,
				onScroll,
			}}
		>
			{children}
		</AppContext.Provider>
	);
}

function TabBar() {
	const isDark = useColorScheme() === 'dark';

	return (
		<Tab.Navigator
			screenOptions={{
				headerShown: false,
				tabBarStyle: {
					backgroundColor: isDark ? '#1c1c1e' : '#fff',
					borderTopColor: isDark ? '#3a3a3c' : '#e0e0e0',
				},
				tabBarActiveTintColor: isDark ? '#fff' : '#007AFF',
				tabBarInactiveTintColor: isDark ? '#8e8e93' : '#8e8e93',
				tabBarLabelStyle: {
					fontSize: 12,
					fontWeight: '500',
				},
			}}
		>
			<Tab.Screen
				name="Sessions"
				component={SessionsScreen}
				options={{
					tabBarLabel: 'Sessions',
					tabBarIcon: ({ color }: { color: string }) => (
						<Text style={{ fontSize: 20, color }}>💬</Text>
					),
				}}
			/>
			<Tab.Screen
				name="Settings"
				component={SettingsScreen}
				options={{
					tabBarLabel: 'Settings',
					tabBarIcon: ({ color }: { color: string }) => (
						<Text style={{ fontSize: 20, color }}>⚙️</Text>
					),
				}}
			/>
		</Tab.Navigator>
	);
}

export default function App() {
	const isDark = useColorScheme() === 'dark';

	return (
		<SafeAreaProvider>
			<AppStateProvider>
				<NavigationContainer>
					<StatusBar style={isDark ? 'light' : 'dark'} />
					<TabBar />
				</NavigationContainer>
			</AppStateProvider>
		</SafeAreaProvider>
	);
}
